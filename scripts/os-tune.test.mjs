import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { killOrphanPortPids } from "./reelos-box.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function py(args, extra = {}) {
  return spawnSync("python3", args, { encoding: "utf8", cwd: root, ...extra });
}

test("os tune twins and self-test: zram on HDD, no 512M kdump on 4GB", () => {
  assert.equal(read("install/bin/reelos_os_tune.py"), read("daemon/reelos_os_tune.py"));
  const self = py([join(root, "daemon/reelos_os_tune.py"), "--self-test"]);
  assert.equal(self.status, 0, self.stdout + self.stderr);
  const tiny = py([join(root, "daemon/reelos_os_tune.py"), "--fixture", "tiny", "--plan"]);
  assert.equal(tiny.status, 0, tiny.stderr);
  const plan = JSON.parse(tiny.stdout);
  assert.equal(plan.zram, true);
  assert.equal(plan.disable_kdump, true);
  assert.equal(plan.crashkernel, "no");
  assert.match(plan.reason, /4GB \+ HDD/);
  assert.match(plan.wait_fuse_busy, /TorBox filesystem busy/);
  assert.equal(plan.wait_apply, "swapping the app");
  const ssd = py([join(root, "daemon/reelos_os_tune.py"), "--fixture", "laptop-16", "--plan"]);
  const big = JSON.parse(ssd.stdout);
  assert.equal(big.zram, false);
  assert.equal(big.disable_kdump, false);
});

test("os tune --apply-files writes zram + crashkernel=no without touching /media", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-os-"));
  try {
    const apply = py([join(root, "daemon/reelos_os_tune.py"), "--fixture", "tiny", "--apply"], {
      env: {
        ...process.env,
        REELOS_ZRAM_CONF: join(dir, "zram.conf"),
        REELOS_GRUB_DROPIN: join(dir, "grub.d", "reelos-nokdump.cfg"),
        REELOS_KDUMP_DEFAULT: join(dir, "kdump-tools"),
        REELOS_OS_TUNE_STAMP: join(dir, "os-tune-plan.json"),
        REELOS_STATE: dir,
      },
    });
    assert.equal(apply.status, 0, apply.stdout + apply.stderr);
    const zram = readFileSync(join(dir, "zram.conf"), "utf8");
    assert.match(zram, /\[zram0\]/);
    assert.match(zram, /zstd/);
    assert.match(readFileSync(join(dir, "grub.d", "reelos-nokdump.cfg"), "utf8"), /crashkernel=no/);
    assert.equal(readFileSync(join(dir, "kdump-tools"), "utf8"), "USE_KDUMP=0\n");
    assert.doesNotMatch(apply.stdout, /\/media/);
    assert.doesNotMatch(apply.stdout, /ota\.lock/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installer and USB seed bake OS tune; wizard stays 7 steps", () => {
  const install = read("install/reelos-install.sh");
  assert.equal(install, read("daemon/install.sh"));
  assert.match(install, /reelos_os_tune\.py/);
  assert.match(install, /reelos_hardware\.py/);
  assert.doesNotMatch(install, /rm -rf \/media/);
  assert.doesNotMatch(install, /rm .*ota\.lock/);
  assert.match(install, /Never delete ota.lock/);
  const seed = read("scripts/install-reelos.sh");
  assert.match(seed, /zram on rotational/);
  assert.match(seed, /512M kdump/);
  assert.match(seed, /crashkernel=no/);
  assert.match(seed, /7-step wizard/);
  const usb = read("scripts/reelos-make-usb.sh");
  assert.match(usb, /reelos_os_tune\.py/);
  assert.match(read("autoinstall/user-data"), /zram on rotational disk/);
  assert.match(read("src/components/wizard.tsx"), /const TOTAL = 7/);
  assert.equal(read("install/systemd/reelos.service").includes("fuser -k 8080/tcp"), true);
  assert.equal(read("firstboot/reelos.service").includes("fuser -k 8080/tcp"), true);
});

test("honest wait copy: Apply vs library vs FUSE busy", () => {
  assert.match(read("src/components/applying-bar.tsx"), /Updating ReelOS/);
  assert.match(read("src/components/library-catchup-bar.tsx"), /TorBox filesystem busy/);
  assert.match(read("src/components/settings-updates.tsx"), /Full-screen splash stays until browse and request work/);
  assert.match(read("src/lib/library-catchup.ts"), /WAIT_FUSE_BUSY/);
  assert.match(read("src/lib/library-catchup.ts"), /updateLocksUi/);
  assert.match(read("scripts/reelos-ota-status.mjs"), /WAIT_APPLY/);
  assert.match(read("daemon/reelos-library-catchup.sh"), /TorBox filesystem busy — not copying to disk/);
  assert.match(read("daemon/reelos-library-catchup.sh"), /4GB \+ HDD, small-box limits/);
  assert.equal(read("daemon/reelos-library-catchup.sh"), read("install/bin/reelos-library-catchup.sh"));
});

test("killOrphanPortPids never signals pid 1 or self", () => {
  const sent = [];
  const killed = killOrphanPortPids([1, process.pid, 4242, 4242], {
    kill: (pid, sig) => sent.push({ pid, sig }),
    selfPid: process.pid,
  });
  assert.deepEqual(killed, [4242]);
  assert.deepEqual(sent, [{ pid: 4242, sig: "SIGTERM" }]);
  assert.match(read("scripts/reelos-box.mjs"), /killOrphan8080/);
  assert.match(read("scripts/reelos-box.mjs"), /One Node on :8080/);
});

test("GET /api/request registers ids — does not ls dump trees", () => {
  const req = read("scripts/reelos-request-status.mjs");
  assert.match(req, /Never `ls` dump trees/);
  assert.doesNotMatch(req, /spawnSync\("ls"/);
  assert.doesNotMatch(req, /\/mnt\/symlinks\/sonarr/);
  assert.doesNotMatch(req, /\/mnt\/debrid/);
  assert.match(req, /dumps: \{ sonarr: \[\], radarr: \[\] \}/);
});
