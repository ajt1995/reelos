import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function bash(args, env = {}) {
  return spawnSync("bash", args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    cwd: root,
  });
}

const scripts = [
  "scripts/reelos-make-usb.sh",
  "scripts/install-reelos.sh",
  "autoinstall/live-wifi.sh",
];

test("shellcheck and bash -n on USB/install scripts", () => {
  for (const rel of scripts) {
    const n = spawnSync("bash", ["-n", join(root, rel)], { encoding: "utf8" });
    assert.equal(n.status, 0, `${rel} bash -n\n${n.stderr}`);
  }
  const has = spawnSync("bash", ["-lc", "command -v shellcheck"], { encoding: "utf8" });
  if (has.status === 0 && has.stdout.trim()) {
    const r = spawnSync("shellcheck", ["-x", ...scripts.map((s) => join(root, s))], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
});

test("autoinstall: reelos, GitHub main, firstboot once, :80 wizard, no secrets", () => {
  const userData = read("autoinstall/user-data");
  const meta = read("autoinstall/meta-data");
  const install = read("scripts/install-reelos.sh");
  const usb = read("scripts/reelos-make-usb.sh");
  const wizard = read("src/components/wizard.tsx");
  const firstboot = read("install/systemd/reelos-firstboot.service");

  assert.match(meta, /local-hostname: reelos/);
  assert.match(userData, /username: reelos/);
  assert.match(userData, /hostname: reelos/);
  assert.match(userData, /install-server: true/);
  assert.match(userData, /updates: none/);
  assert.match(userData, /install-reelos\.sh/);
  assert.match(userData, /7-step wizard/);
  assert.doesNotMatch(userData, /adminPassword/);
  assert.doesNotMatch(userData, /api_key:/);
  assert.doesNotMatch(userData, /TORBOX/);
  assert.doesNotMatch(userData, /provisioned/);

  assert.match(install, /ajt1995\/reelos\/archive\/refs\/heads\/main\.tar\.gz/);
  assert.match(install, /systemctl enable reelos-firstboot/);
  assert.match(install, /7-step wizard/);
  assert.match(install, /:80/);
  assert.match(install, /Will not wipe \/media/);
  assert.match(install, /Will not delete ota\.lock/);
  assert.doesNotMatch(install, /rm -f "\$STATE\/ota\.lock"/);
  assert.doesNotMatch(install, /rm -rf \/media/);
  assert.doesNotMatch(install, /umount.*\/media/);
  assert.doesNotMatch(install, /releases\.ubuntu\.com/);
  assert.doesNotMatch(install, /^\s*wget\s/m);

  assert.match(usb, /ubuntu-24\.04\.x-live-server-amd64\.iso \/dev\/sdX/);
  assert.match(usb, /ds=nocloud\\;s=\/cdrom\/nocloud\//);
  assert.match(usb, /This script will not wget an ISO/);
  assert.doesNotMatch(usb, /releases\.ubuntu\.com/);
  assert.doesNotMatch(usb, /cdimage\.ubuntu\.com/);
  assert.doesNotMatch(usb, /^\s*wget\s/m);
  assert.doesNotMatch(usb, /rm -rf \/media/);
  assert.doesNotMatch(usb, /rm -f.*ota\.lock/);
  assert.match(usb, /does not delete ota\.lock/i);

  assert.match(wizard, /const TOTAL = 7/);
  assert.match(firstboot, /ConditionPathExists=!\/var\/lib\/reelos\/stack-installed/);

  const appliance = read("install/reelos-install.sh");
  assert.equal(appliance, read("daemon/install.sh"));
  assert.match(appliance, /deb\.nodesource\.com\/setup_22\.x/);
  assert.match(appliance, /Paste a TorBox key/);
  assert.doesNotMatch(appliance, /Real-Debrid key/);
  const nInstall = spawnSync("bash", ["-n", join(root, "install/reelos-install.sh")], {
    encoding: "utf8",
  });
  assert.equal(nInstall.status, 0, nInstall.stderr);
});

test("reelos-make-usb.sh dry-run stages nocloud without writing a device", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-usb-"));
  try {
    const iso = join(dir, "ubuntu-24.04.3-live-server-amd64.iso");
    writeFileSync(iso, "not-a-real-iso\n");
    const stage = join(dir, "stage");
    const r = bash(
      [
        join(root, "scripts/reelos-make-usb.sh"),
        "--dry-run",
        "--yes",
        "--stage",
        stage,
        iso,
        "/dev/sdz",
      ],
      { REELOS_TEST: "1" },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /dry-run: would write/);
    assert.match(r.stdout, /did not wget Ubuntu/);
    assert.match(r.stdout, /did not wipe \/media/);
    assert.equal(existsSync(join(stage, "nocloud", "user-data")), true);
    assert.equal(existsSync(join(stage, "nocloud", "meta-data")), true);
    assert.equal(existsSync(join(stage, "nocloud", "install-reelos.sh")), true);
    assert.equal(existsSync(join(stage, "nocloud", "live-wifi.sh")), true);
    assert.match(readFileSync(join(stage, "grub", "grub.cfg"), "utf8"), /autoinstall/);
    assert.match(readFileSync(join(stage, "nocloud", "user-data"), "utf8"), /username: reelos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reelos-make-usb.sh refuses a missing ISO and a partition path", () => {
  const missing = bash([
    join(root, "scripts/reelos-make-usb.sh"),
    "--dry-run",
    join(root, "no-such.iso"),
    "/dev/sdz",
  ]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /ISO not found/);
  assert.match(missing.stderr, /will not wget/i);

  const dir = mkdtempSync(join(tmpdir(), "reelos-usb-"));
  try {
    const iso = join(dir, "ubuntu-24.04.3-live-server-amd64.iso");
    writeFileSync(iso, "x\n");
    const part = bash(
      [join(root, "scripts/reelos-make-usb.sh"), "--dry-run", iso, "/dev/sdz1"],
      { REELOS_TEST: "1" },
    );
    assert.notEqual(part.status, 0);
    assert.match(part.stderr, /whole disk/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("install-reelos.sh dry-run layouts a repo tree and never stamps provisioned", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-install-"));
  try {
    const src = join(dir, "src");
    const dest = join(dir, "opt");
    const state = join(dir, "state");
    mkdirSync(join(src, "install", "systemd"), { recursive: true });
    mkdirSync(join(src, "src"), { recursive: true });
    writeFileSync(join(src, "install", "reelos-install.sh"), "#!/bin/bash\necho ok\n");
    writeFileSync(join(src, "VERSION"), "1.2.50.48\n");
    writeFileSync(join(src, "package.json"), "{}\n");
    writeFileSync(join(src, "src", "app.txt"), "ui\n");
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, "provisioned"), "stale\n");
    const r = bash([join(root, "scripts/install-reelos.sh"), "--dry-run"], {
      REELOS_ROOT: dest,
      REELOS_STATE: state,
      REELOS_SRC: src,
      REELOS_DRY_RUN: "1",
    });
    // provisioned must refuse even in dry-run
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /already provisioned/i);
    assert.equal(existsSync(join(state, "provisioned")), true);

    rmSync(join(state, "provisioned"));
    const ok = bash([join(root, "scripts/install-reelos.sh"), "--dry-run"], {
      REELOS_ROOT: dest,
      REELOS_STATE: state,
      REELOS_SRC: src,
    });
    assert.equal(ok.status, 0, ok.stderr + ok.stdout);
    assert.match(ok.stdout, /laid out/);
    assert.match(ok.stdout, /would enable reelos-firstboot once/);
    assert.match(ok.stdout, /7-step wizard on :80/);
    assert.match(ok.stdout, /would not delete ota\.lock/);
    assert.equal(readFileSync(join(dest, "install.sh"), "utf8"), "#!/bin/bash\necho ok\n");
    assert.equal(readFileSync(join(dest, "app/VERSION"), "utf8").trim(), "1.2.50.48");
    assert.equal(readFileSync(join(dest, "app/.reelos-appliance"), "utf8").trim(), "1");
    assert.equal(existsSync(join(state, "provisioned")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("install-reelos.sh refuses ota.lock and does not delete it", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-ota-"));
  try {
    const dest = join(dir, "opt");
    const state = join(dir, "state");
    mkdirSync(state, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(state, "ota.lock"), "held\n");
    const r = bash([join(root, "scripts/install-reelos.sh"), "--dry-run"], {
      REELOS_ROOT: dest,
      REELOS_STATE: state,
      REELOS_SRC: dir,
    });
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /ota\.lock/);
    assert.match(r.stderr, /Will not delete ota\.lock/);
    assert.equal(readFileSync(join(state, "ota.lock"), "utf8").trim(), "held");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("wizard stays seven steps; house Apply paths are untouched", () => {
  assert.match(read("src/components/wizard.tsx"), /const TOTAL = 7/);
  const updater = read("daemon/reelos-update.sh");
  assert.equal(updater.includes("enable reelos-firstboot"), false);
  assert.doesNotMatch(updater, /rm -rf \/media/);
  assert.doesNotMatch(updater, /umount -l \/media/);
});
