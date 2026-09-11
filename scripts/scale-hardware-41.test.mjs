import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  FIXTURE_LAPTOP_16GB,
  FIXTURE_LAPTOP_32GB,
  FIXTURE_TINY_4GB,
  SMALL_MEM_KB,
  boxIsSmall,
  hardwareLimits,
  hardwareProfile,
  importChunkSize,
} from "./reelos-box-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function py(args, extra = {}) {
  return spawnSync("python3", args, { encoding: "utf8", cwd: root, ...extra });
}

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
  assert.doesNotMatch(updater, /enable reelos-firstboot/);
  assert.doesNotMatch(updater, /umount -l \/media/);
});
