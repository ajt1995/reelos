import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { pythonBin } from "./test-python.mjs";
import {
  FIXTURE_LAPTOP_16GB,
  FIXTURE_LAPTOP_32GB,
  FIXTURE_TINY_4GB,
  SMALL_MEM_KB,
  boxIsSmall,
  hardwareLimits,
  hardwareProfile,
  importChunkSize,
  getAdaptiveMemoryCeiling,
} from "./reelos-box-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
}

function py(args, extra = {}) {
  return spawnSync(pythonBin(), args, { encoding: "utf8", cwd: root, ...extra });
}

test("tiny + SSD keeps 768M RAM cap but scales folders with nproc", () => {
  const tinySsd = hardwareProfile({ ramKb: 3_383_440, cpus: 4, diskKind: "ssd", diskFreeGb: 200 });
  const lim = hardwareLimits(tinySsd);
  assert.equal(tinySsd.tiny, true);
  assert.equal(lim.catchupMemoryMax, "768M");
  assert.equal(lim.jellyfinMem, null);
  assert.ok(lim.importFolderCapCatchup > 6);
  assert.ok(lim.importChunkCatchup >= 8);
});

test("selfheal defers catch-up while ffprobe is D-state", () => {
  const heal = read("daemon/reelos-selfheal.sh");
  assert.match(heal, /library catch-up deferred/);
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
  const call = heal.indexOf('log "library catch-up deferred');
  const start = heal.indexOf("start_library_catchup");
  assert.ok(call > start, "defer gate must wrap the start");
});

test("4GB fixture keeps today's conservative path", () => {
  assert.equal(SMALL_MEM_KB, 4_718_592);
  assert.equal(boxIsSmall(FIXTURE_TINY_4GB.ramKb), true);
  assert.equal(boxIsSmall(FIXTURE_LAPTOP_16GB.ramKb), false);
  const tiny = hardwareProfile(FIXTURE_TINY_4GB);
  const lim = hardwareLimits(tiny);
  assert.equal(tiny.tiny, true);
  assert.equal(lim.catchupMemoryMax, "768M");
  assert.equal(lim.jellyfinMem, null);
  assert.equal(lim.sonarrMem, null);
  assert.equal(lim.importFolderCapCatchup, 6);
  assert.equal(lim.importFolderCapProvision, 12);
  assert.equal(lim.importChunkCatchup, 8);
  assert.equal(lim.dBackoffLimit, 1);
  assert.equal(importChunkSize(tiny, { catchUp: true, dState: 0 }), 8);
});

test("16–32GB laptop is not stuck on 768M / 4G / Pi folder caps", () => {
  const p16 = hardwareProfile(FIXTURE_LAPTOP_16GB);
  const p32 = hardwareProfile(FIXTURE_LAPTOP_32GB);
  const l16 = hardwareLimits(p16);
  const l32 = hardwareLimits(p32);
  assert.equal(p16.tiny, false);
  assert.equal(p32.tiny, false);
  assert.equal(l16.catchupMemoryMax, "2G");
  assert.equal(l32.catchupMemoryMax, "8G");
  assert.notEqual(l16.catchupMemoryMax, "768M");
  assert.equal(l16.jellyfinMem, "5G");
  const jelly32 = Number(String(l32.jellyfinMem).replace("G", ""));
  assert.ok(jelly32 > 4, `32GB jellyfin mem ${l32.jellyfinMem}`);
  assert.ok(l16.importFolderCapCatchup > 16);
  assert.ok(l32.importFolderCapCatchup > l16.importFolderCapCatchup);
  assert.ok(l16.importChunkCatchup > 8);
});

test("high ffprobe D-state is I/O backpressure — concurrency 0 on any hardware", () => {
  const tiny = hardwareProfile(FIXTURE_TINY_4GB);
  const laptop = hardwareProfile(FIXTURE_LAPTOP_16GB);
  assert.equal(importChunkSize(tiny, { catchUp: true, dState: 1 }), 0);
  assert.equal(importChunkSize(laptop, { catchUp: true, dState: 12 }), 0);
  assert.ok(importChunkSize(laptop, { catchUp: true, dState: 0 }) > 0);
});

test("python hardware module matches JS fixtures and applies drop-ins", () => {
  const self = py([join(root, "daemon/reelos_hardware.py"), "--self-test"]);
  assert.equal(self.status, 0, self.stdout + self.stderr);
  const tiny = py([join(root, "daemon/reelos_hardware.py"), "--fixture", "tiny", "--catchup-memory"]);
  assert.equal((tiny.stdout || "").trim(), "768M");
  const big = py([join(root, "daemon/reelos_hardware.py"), "--fixture", "laptop-32", "--catchup-memory"]);
  assert.equal((big.stdout || "").trim(), "8G");
  const dir = mkdtempSync(join(tmpdir(), "reelos-hw-"));
  try {
    const dropin = join(dir, "hardware.conf");
    const apply = py([join(root, "daemon/reelos_hardware.py"), "--fixture", "laptop-16", "--apply"], {
      env: {
        ...process.env,
        REELOS_ROOT: dir,
        REELOS_STATE: dir,
        REELOS_CATCHUP_DROPIN: dropin,
      },
    });
    assert.equal(apply.status, 0, apply.stdout + apply.stderr);
    const text = readFileSync(dropin, "utf8");
    assert.match(text, /MemoryMax=2G/);
    const yml = readFileSync(join(dir, "compose/compose.override.yml"), "utf8");
    assert.match(yml, /mem_limit: 5G/);
    const profile = JSON.parse(readFileSync(join(dir, "hardware-profile.json"), "utf8"));
    assert.equal(profile.ram_gb, 16);
    assert.equal(profile.catchup_memory_max, "2G");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mailman logs hardware profile; catch-up default MemoryMax stays 768M for tiny", () => {
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /hardware profile/);
  assert.match(updater, /reelos_hardware.py" --apply/);
  assert.match(updater, /vite build skipped — 4GB box/);
  assert.match(updater, /4GB box never compiles/);
  assert.match(read("install/systemd/reelos-library-catchup.service"), /MemoryMax=768M/);
  assert.equal(read("daemon/reelos_hardware.py"), read("install/bin/reelos_hardware.py"));
  assert.equal(read("daemon/reelos-library-catchup.sh"), read("install/bin/reelos-library-catchup.sh"));
  const catchup = read("daemon/reelos-library-catchup.sh");
  assert.match(catchup, /reelos_hardware.py/);
  assert.doesNotMatch(catchup, /box_is_small/);
  assert.match(read("daemon/wire-engines.parts/06.part"), /def box_is_small/);
  assert.match(read("daemon/wire-engines.parts/06.part"), /if box_is_small\(\):\n        return True/);
  assert.match(read("daemon/sonarr_manual_import.py"), /concurrency 0/);
  assert.match(read("daemon/reelos_hardware.py"), /not a Pi/);
  assert.match(read("daemon/reelos_hardware.py"), /cgroup_hiding/);
  assert.doesNotMatch(updater, /enable reelos-firstboot/);
  assert.doesNotMatch(updater, /umount -l \/media/);
});

test("getAdaptiveMemoryCeiling: respects Law 1 100% RAM dedicated appliance allocation and shared stealth floor", () => {
  // 1. Dedicated appliance potato (4GB RAM) -> preserves 1GB video headroom
  const potatoAppliance = getAdaptiveMemoryCeiling({
    isDedicated: true,
    totalMem: 4 * 1024 * 1024 * 1024,
    freeMem: 2 * 1024 * 1024 * 1024,
  });
  assert.equal(potatoAppliance.mode, "dedicated_appliance");
  assert.equal(potatoAppliance.videoHeadroomMb, 1024);
  assert.equal(potatoAppliance.targetMemoryMb, 4096 - 1024); // 3072MB allocated
  assert.equal(potatoAppliance.allowEvictionOnPressure, false);

  // 2. Dedicated appliance 16GB RAM -> uses Total - 256MB
  const bigAppliance = getAdaptiveMemoryCeiling({
    isDedicated: true,
    totalMem: 16 * 1024 * 1024 * 1024,
    freeMem: 10 * 1024 * 1024 * 1024,
  });
  assert.equal(bigAppliance.mode, "dedicated_appliance");
  assert.equal(bigAppliance.videoHeadroomMb, 256);
  assert.equal(bigAppliance.targetMemoryMb, 16384 - 256);

  // 3. Shared PC baseline idle (Windows, 32GB RAM, 16GB free) -> 128MB–256MB baseline
  const sharedIdle = getAdaptiveMemoryCeiling({
    isDedicated: false,
    platform: "win32",
    totalMem: 32 * 1024 * 1024 * 1024,
    freeMem: 16 * 1024 * 1024 * 1024,
  });
  assert.equal(sharedIdle.mode, "elastic_windows");
  assert.equal(sharedIdle.targetMemoryMb, 256); // Capped at 256MB
  assert.equal(sharedIdle.allowEvictionOnPressure, true);

  // 4. Shared PC in gaming / creator stealth yield -> collapses to 32MB floor
  const sharedStealth = getAdaptiveMemoryCeiling({
    isDedicated: false,
    platform: "win32",
    isStealth: true,
    totalMem: 32 * 1024 * 1024 * 1024,
    freeMem: 8 * 1024 * 1024 * 1024,
  });
  assert.equal(sharedStealth.mode, "stealth_yield");
  assert.equal(sharedStealth.targetMemoryMb, 32);
  assert.equal(sharedStealth.stealthMemoryFloorMb, 32);
});
