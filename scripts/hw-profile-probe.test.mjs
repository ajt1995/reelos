import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  FIXTURE_TINY_4GB,
  cpuShort,
  hardwareLimits,
  hardwareProfile,
  hardwareProfilePath,
  loadSavedHardware,
  publicHardware,
  summaryFromProfile,
} from "./reelos-box-scale.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("house HP fixture summary is 4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal", () => {
  const hp = hardwareProfile({
    ramKb: 3_383_440,
    cpus: 4,
    diskKind: "rotational",
    diskFreeGb: 410,
    cpuModel: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    product: "HP Laptop 15-bs0xx",
    rootOnUsb: false,
    kdumpReservedKb: 524_288,
  });
  assert.equal(hp.summary, "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal");
  assert.equal(hp.splashTune, "Tuning for 4GB HDD…");
  assert.equal(cpuShort("Intel(R) Pentium(R) CPU N3710 @ 1.60GHz", 4), "4c Pentium N3710");
  const lim = hardwareLimits(hp);
  assert.equal(lim.fuseCount, 1);
  assert.equal(lim.skipDumpFfprobe, true);
  assert.equal(lim.zram, true);
  assert.equal(lim.disableKdump, true);
  assert.equal(lim.searchParallelism, 1);
  assert.equal(lim.indexerParallelism, 1);
  assert.equal(lim.lowPerf, true);
  assert.equal(lim.catchupMemoryMax, "768M");
});

test("saved profile is source of truth; 4.5Gi fallback if probe has not run", () => {
  const fallback = publicHardware(null, 3_383_440);
  assert.equal(fallback.probed, false);
  assert.equal(fallback.tiny, true);
  assert.match(fallback.summary, /4Gi RAM/);
  const dir = mkdtempSync(join(tmpdir(), "reelos-hw-json-"));
  try {
    const path = join(dir, "hardware-profile.json");
    writeFileSync(
      path,
      JSON.stringify({
        ram_kb: 3_383_440,
        ram_gb: 3.23,
        cpus: 4,
        disk_kind: "rotational",
        tiny: true,
        cpu_model: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
        summary: "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal",
        probe_version: 2,
        probed_at: "2026-09-12T00:00:00Z",
        knobs: { fuse_count: 1, skip_dump_ffprobe: true, zram: true, disable_kdump: true, splash_tune: "Tuning for 4GB HDD…" },
      }) + "\n",
    );
    const saved = loadSavedHardware({ path });
    const view = publicHardware(saved, 16 * 1024 * 1024);
    assert.equal(view.probed, true);
    assert.equal(view.summary, "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal");
    assert.equal(view.knobs.fuseCount, 1);
    assert.equal(view.knobs.skipDumpFfprobe, true);
    assert.equal(view.tiny, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unprobed 16Gi cloud VM does not mix live RAM with a 4.5Gi guess", () => {
  const cloud = publicHardware(null, 16 * 1024 * 1024);
  assert.equal(cloud.probed, false);
  assert.equal(cloud.tiny, false);
  assert.equal(cloud.ramGb, 0);
  assert.match(cloud.summary, /Not measured yet/);
  assert.doesNotMatch(cloud.summary, /16Gi/);
  assert.doesNotMatch(cloud.summary, /4\.5Gi|4Gi RAM/);
});

test("loadSavedHardware follows REELOS_STATE, not a hardcoded /var/lib path", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-hw-state-"));
  try {
    const path = join(dir, "hardware-profile.json");
    writeFileSync(
      path,
      JSON.stringify({
        ram_kb: 3_383_440,
        ram_gb: 3.23,
        cpus: 4,
        disk_kind: "rotational",
        tiny: true,
        summary: "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal",
        probe_version: 2,
        probed_at: "2026-09-12T00:00:00Z",
      }) + "\n",
    );
    const prev = process.env.REELOS_STATE;
    process.env.REELOS_STATE = dir;
    try {
      assert.equal(hardwareProfilePath(), path);
      const saved = loadSavedHardware();
      const view = publicHardware(saved, 16 * 1024 * 1024);
      assert.equal(view.probed, true);
      assert.equal(view.summary, "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal");
      assert.equal(view.ramGb, 3.23);
    } finally {
      if (prev == null) delete process.env.REELOS_STATE;
      else process.env.REELOS_STATE = prev;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("python probe persists JSON; second ensure is a no-op", () => {
  const self = spawnSync("python3", [join(root, "daemon/reelos_hardware.py"), "--self-test"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(self.status, 0, self.stdout + self.stderr);
  const dir = mkdtempSync(join(tmpdir(), "reelos-hw-ensure-"));
  try {
    const env = {
      ...process.env,
      REELOS_ROOT: dir,
      REELOS_STATE: dir,
      REELOS_CATCHUP_DROPIN: join(dir, "hardware.conf"),
    };
    const first = spawnSync(
      "python3",
      [join(root, "daemon/reelos_hardware.py"), "--fixture", "tiny", "--ensure"],
      { encoding: "utf8", cwd: root, env },
    );
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const profile = JSON.parse(readFileSync(join(dir, "hardware-profile.json"), "utf8"));
    assert.equal(profile.summary, "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal");
    assert.equal(profile.knobs.fuse_count, 1);
    assert.equal(profile.knobs.skip_dump_ffprobe, true);
    const mtime = spawnSync("stat", ["-c", "%Y%N", join(dir, "hardware-profile.json")], { encoding: "utf8" });
    const second = spawnSync(
      "python3",
      [join(root, "daemon/reelos_hardware.py"), "--fixture", "tiny", "--ensure"],
      { encoding: "utf8", cwd: root, env },
    );
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /"skipped": true/);
    const mtime2 = spawnSync("stat", ["-c", "%Y%N", join(dir, "hardware-profile.json")], { encoding: "utf8" });
    assert.equal(mtime2.stdout, mtime.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("UI and API surface the saved profile; wizard stays 7 steps", () => {
  assert.match(read("src/components/settings-panels.tsx"), /This is what I detected/);
  assert.match(read("src/components/settings-panels.tsx"), /\/api\/hardware/);
  assert.match(read("src/components/settings-view.tsx"), /HardwareDetectedCard/);
  assert.match(read("src/components/splash.tsx"), /\/api\/hardware/);
  assert.match(read("src/components/splash.tsx"), /Updating ReelOS/);
  assert.match(read("src/components/splash.tsx"), /Update failed, still on previous/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /\/api\/hardware/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /this is what I detected/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /hardwareProfilePath/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /runHardwareEnsure/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /this is what I detected/);
  assert.match(read("scripts/reelos-box-scale.mjs"), /function hardwareProfilePath/);
  assert.match(read("src/components/wizard.tsx"), /TOTAL = 7/);
  assert.doesNotMatch(read("src/components/wizard.tsx"), /hardware profile step/i);
  const panels = read("src/components/settings-panels.tsx");
  assert.match(panels, /A 4\.5Gi RAM guess is used until the probe runs/);
  assert.match(panels, /if \(!didProbe\)/);
  assert.match(panels, /setDetail\(""\)/);
  assert.doesNotMatch(panels, /This computer/);
});

test("re-probe hooks: firstboot, OTA before cleaner, door start, USB udev", () => {
  const install = read("daemon/install.sh");
  assert.match(install, /reelos_hardware.py" --ensure/);
  assert.match(install, /99-reelos-hw-probe.rules/);
  assert.equal(install, read("install/reelos-install.sh"));
  const updater = read("daemon/reelos-update.sh");
  const hw = updater.indexOf('python3 "$ROOT/bin/reelos_hardware.py" --apply');
  const clean = updater.indexOf('log "OTA cleaner — leftover nonsense');
  assert.ok(hw > 0 && clean > hw, "probe before cleaner");
  assert.match(read("daemon/reelos-ota-clean.sh"), /reelos_hardware.py" --ensure/);
  assert.match(read("firstboot/reelos.service"), /reelos_hardware.py --ensure/);
  assert.match(read("install/systemd/reelos.service"), /reelos_hardware.py --ensure/);
  assert.match(read("scripts/reelos-box.mjs"), /ensureHardwareProfile/);
  assert.match(read("install/udev/99-reelos-hw-probe.rules"), /reelos-hw-probe.service/);
  assert.match(read("install/systemd/reelos-hw-probe.service"), /--ensure/);
  assert.match(updater, /reelos-hw-probe.service/);
  assert.equal(read("daemon/reelos_hardware.py"), read("install/bin/reelos_hardware.py"));
  assert.equal(read("daemon/reelos-ota-clean.sh"), read("install/bin/reelos-ota-clean.sh"));
  assert.equal(read("daemon/reelos_os_tune.py"), read("install/bin/reelos_os_tune.py"));
  assert.equal(read("daemon/reelos-update.sh"), read("install/bin/reelos-update.sh"));
  assert.doesNotMatch(updater, /rm -rf \/media/);
  assert.doesNotMatch(updater, /rm .*ota\.lock/);
});

test("tiny HDD knobs stay 1 FUSE / skip dump ffprobe vs 16GB SSD", () => {
  const tiny = hardwareLimits(hardwareProfile(FIXTURE_TINY_4GB));
  const big = hardwareLimits(
    hardwareProfile({ ramKb: 16 * 1024 * 1024, cpus: 8, diskKind: "ssd", diskFreeGb: 200 }),
  );
  assert.equal(tiny.fuseCount, 1);
  assert.equal(tiny.skipDumpFfprobe, true);
  assert.equal(tiny.searchParallelism, 1);
  assert.equal(big.skipDumpFfprobe, false);
  assert.ok(big.searchParallelism >= 4);
  assert.equal(summaryFromProfile({ ram_gb: 16, cpus: 8, cpu_model: "Ryzen 7 5800H", disk_kind: "ssd" }).includes("SSD"), true);
});
