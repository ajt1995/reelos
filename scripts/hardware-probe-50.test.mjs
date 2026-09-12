import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  FIXTURE_TINY_4GB,
  hardwareLimits,
  hardwareProfile,
  publicHardware,
  summaryFromProfile,
} from "./reelos-box-scale.mjs";
import { applyFailed } from "./reelos-ota-status.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("house HP fixture summary is visible English, not a Pi", () => {
  const tiny = hardwareProfile({
    ...FIXTURE_TINY_4GB,
    cpuModel: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    product: "HP Laptop 15-bs0xx",
    rootOnUsb: false,
  });
  assert.equal(tiny.tiny, true);
  assert.equal(tiny.summary, "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal");
  assert.equal(summaryFromProfile(tiny), tiny.summary);
  const view = publicHardware(
    {
      ram_kb: 3_383_440,
      ram_gb: 3.23,
      cpus: 4,
      cpu_model: "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
      disk_kind: "rotational",
      product: "HP Laptop 15-bs0xx",
      root_on_usb: false,
      tiny: true,
      summary: tiny.summary,
      probed_at: "2026-09-12T00:00:00Z",
      probe_version: 2,
      knobs: { fuse_count: 1, skip_dump_ffprobe: true, zram: true, disable_kdump: true },
    },
    3_383_440,
  );
  assert.equal(view.probed, true);
  assert.equal(view.summary, tiny.summary);
  assert.equal(view.rootOnUsb, false);
  assert.equal(view.knobs.fuseCount, 1);
  assert.equal(view.knobs.skipDumpFfprobe, true);
  const lim = hardwareLimits(tiny);
  assert.equal(lim.fuseCount, 1);
  assert.equal(lim.skipDumpFfprobe, true);
  assert.equal(lim.searchParallelism, 1);
  assert.equal(lim.zram, true);
  assert.equal(lim.disableKdump, true);
  const big = hardwareLimits(
    hardwareProfile({ ramKb: 16 * 1024 * 1024, cpus: 8, diskKind: "ssd", diskFreeGb: 200 }),
  );
  assert.equal(big.skipDumpFfprobe, false);
  assert.ok(big.searchParallelism >= 4);
});

test("python probe persists, skips unchanged, re-probes USB-root", () => {
  const self = spawnSync("python3", [join(root, "daemon/reelos_hardware.py"), "--self-test"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(self.status, 0, self.stdout + self.stderr);
  const tune = spawnSync("python3", [join(root, "daemon/reelos_os_tune.py"), "--self-test"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(tune.status, 0, tune.stdout + tune.stderr);
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

test("Settings and splash show this is what I detected; splash stays Not a percent", () => {
  assert.match(read("src/components/settings-panels.tsx"), /This is what I detected/);
  assert.match(read("src/components/settings-view.tsx"), /HardwareDetectedCard/);
  assert.match(read("src/components/splash.tsx"), /Not a percent/);
  assert.match(read("src/components/splash.tsx"), /Updating ReelOS/);
  assert.match(read("src/components/splash.tsx"), /\/api\/hardware/);
  assert.match(read("src/components/splash.tsx"), /Update failed, still on previous/);
  assert.match(read("src/components/gate.tsx"), /Splash failed/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /\/api\/hardware/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /this is what I detected/);
  assert.doesNotMatch(read("src/components/settings-panels.tsx"), /Geekbench|fio |benchmark/);
});

test("OTA/install/door re-probe; skip if unchanged; never wipe media or ota.lock", () => {
  const updater = read("daemon/reelos-update.sh");
  const applyAt = updater.indexOf('python3 "$ROOT/bin/reelos_hardware.py" --apply');
  const cleanerAt = updater.indexOf('log "OTA cleaner — leftover nonsense');
  assert.ok(applyAt > 0 && cleanerAt > applyAt, "probe before leftover-nonsense cleaner");
  assert.match(updater, /systemd-inhibit/);
  assert.match(updater, /update failed, still on previous/);
  assert.match(updater, /hardware-profile.json/);
  assert.match(read("daemon/reelos-ota-clean.sh"), /reelos_hardware\.py" --ensure/);
  assert.match(read("scripts/reelos-box.mjs"), /ensureHardwareProfile/);
  assert.match(read("install/reelos-install.sh"), /reelos_hardware\.py" --ensure/);
  assert.match(read("firstboot/reelos.service"), /reelos_hardware.py --ensure/);
  assert.match(read("install/systemd/reelos.service"), /reelos_hardware.py --ensure/);
  assert.match(read("install/udev/99-reelos-hw-probe.rules"), /reelos-hw-probe.service/);
  assert.match(read("install/systemd/reelos-hw-probe.service"), /--ensure/);
  assert.match(read("daemon/reelos_hardware.py"), /identity_unchanged/);
  assert.match(read("daemon/reelos_hardware.py"), /root_on_usb/);
  assert.match(read("src/components/wizard.tsx"), /TOTAL = 7/);
  assert.doesNotMatch(updater, /rm -rf \/media/);
  assert.doesNotMatch(updater, /rm -f "\$STATE\/ota\.lock"/);
  assert.equal(read("daemon/reelos_hardware.py"), read("install/bin/reelos_hardware.py"));
  assert.equal(read("daemon/reelos-update.sh"), read("install/bin/reelos-update.sh"));
  assert.equal(read("daemon/reelos-ota-clean.sh"), read("install/bin/reelos-ota-clean.sh"));
  assert.equal(read("daemon/install.sh"), read("install/reelos-install.sh"));
  assert.equal(read("daemon/wire-engines.parts/06.part"), read("install/bin/wire-engines.parts/06.part"));
  assert.equal(read("daemon/wire-engines.parts/07.part"), read("install/bin/wire-engines.parts/07.part"));
});

test("applyFailed is honest: restore without stamp, not an old applied line", () => {
  const fail =
    "ReelOS 1.2.50.48 → 1.2.50.50\nprobe failed — restoring previous app\nrestore after failure\nupdate failed, still on previous\n";
  assert.equal(applyFailed(fail), true);
  assert.equal(applyFailed(fail + "ReelOS 1.2.50.50 applied.\n"), false);
  const priorOkThenFail =
    "ReelOS 1.2.50.47 → 1.2.50.48\nReelOS 1.2.50.48 applied.\nReelOS 1.2.50.48 → 1.2.50.50\nrestore after failure\nupdate failed, still on previous\n";
  assert.equal(applyFailed(priorOkThenFail), true);
});

test("1.2.50.50 tarball is not Arena/Books, not 49, not TV indexer seeds", () => {
  assert.equal(read("VERSION").trim(), "1.2.50.50");
  const channel = JSON.parse(read("channel.json"));
  assert.equal(channel.version, "1.2.50.50");
  assert.match(channel.tarball, /main.tar.gz/);
  assert.doesNotMatch(read("src/components/settings-view.tsx"), /Arena chrome/);
  assert.doesNotMatch(read("src/routes/__root.tsx"), /\/arena/);
  assert.doesNotMatch(read("daemon/public_indexers.py"), /Knaben/);
  assert.doesNotMatch(read("channel.json"), /1\.2\.50\.49/);
});
