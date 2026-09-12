import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("ISO autoinstall twins stay in lockstep", () => {
  for (const name of ["user-data", "meta-data", "live-wifi.sh", "seed-reelos.sh", "late.sh"]) {
    assert.equal(read(`install/autoinstall/${name}`), read(`iso/autoinstall/${name}`), name);
  }
  assert.equal(read("install/reelos-install.sh"), read("daemon/install.sh"));
});

test("autoinstall: reelos SSH, firstboot once, GitHub main, no secrets, 7-step wizard", () => {
  const userData = read("install/autoinstall/user-data");
  const seed = read("install/autoinstall/seed-reelos.sh");
  const late = read("install/autoinstall/late.sh");
  const wizard = read("src/components/wizard.tsx");
  const install = read("install/reelos-install.sh");
  const remaster = read("iso/remaster-iso.sh");
  const firstboot = read("install/systemd/reelos-firstboot.service");

  assert.match(userData, /username: reelos/);
  assert.match(userData, /hostname: reelos/);
  assert.match(userData, /install-server: true/);
  assert.match(userData, /allow-pw: true/);
  assert.match(userData, /updates: none/);
  assert.match(userData, /curtin in-target -- bash \/opt\/reelos\/seed\/late\.sh/);
  assert.doesNotMatch(userData, /adminPassword/);
  assert.doesNotMatch(userData, /api_key:/);
  assert.doesNotMatch(userData, /torbox.*[A-Za-z0-9]{20}/i);
  assert.doesNotMatch(userData, /provisioned/);

  assert.match(seed, /ajt1995\/reelos\/archive\/refs\/heads\/main\.tar\.gz/);
  assert.match(seed, /Never writes \/var\/lib\/reelos\/provisioned/);
  assert.match(seed, /rm -f "\$STATE\/provisioned"/);
  assert.match(seed, /layout_from_repo/);
  assert.match(seed, /use_bundle/);
  assert.doesNotMatch(seed, /adminPassword/);

  assert.match(late, /systemctl enable reelos-firstboot\.service/);
  assert.match(late, /openssh-server/);
  assert.match(late, /bash "\$ROOT\/install\.sh"/);
  assert.match(late, /rm -f "\$STATE\/provisioned"/);
  assert.match(late, /Does not plant TorBox or admin PIN/);

  assert.match(wizard, /const TOTAL = 7/);
  assert.match(install, /openssh-server/);
  assert.match(install, /usermod -aG docker reelos/);
  assert.match(install, /docker compose version/);
  assert.match(install, /seven-step wizard/);
  assert.match(install, /TorBox API key/);
  assert.doesNotMatch(install, /Paste a Real-Debrid key/);
  assert.match(install, /if \[ ! -f "\$STATE\/provisioned" \]/);
  assert.match(firstboot, /ConditionPathExists=!\/var\/lib\/reelos\/stack-installed/);

  assert.match(remaster, /ds=nocloud\\;s=\/cdrom\/nocloud\//);
  assert.match(remaster, /install\/autoinstall/);
  assert.match(read("iso/build-iso.sh"), /26\.04\.1/);
  assert.match(read("iso/build-iso.sh"), /reelos-ubuntu\.iso/);
  assert.match(read("iso/remaster-iso.sh"), /ubuntu-26\.04\.1-live-server-amd64\.iso/);
  assert.match(read("iso/README.md"), /balenaEtcher/);
  assert.match(read("iso/README.md"), /dd if=/);
  assert.match(read("iso/README.md"), /7-step wizard/);
  assert.match(read("iso/pack-appliance.mjs"), /pack-appliance\.mjs/);
  assert.match(read("scripts/remaster-iso.sh"), /iso\/remaster-iso\.sh/);
});

test("seed-reelos.sh layouts a repo tree and never stamps provisioned", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-seed-"));
  try {
    const src = join(dir, "src");
    const dest = join(dir, "opt");
    const seed = join(dir, "seed");
    const state = join(dir, "state");
    mkdirSync(join(src, "install", "systemd"), { recursive: true });
    mkdirSync(join(src, "src"), { recursive: true });
    mkdirSync(join(src, "scripts"), { recursive: true });
    writeFileSync(join(src, "install", "reelos-install.sh"), "#!/bin/bash\necho ok\n");
    writeFileSync(join(src, "VERSION"), "1.2.50.48\n");
    writeFileSync(join(src, "package.json"), "{}\n");
    writeFileSync(join(src, "src", "app.txt"), "ui\n");
    mkdirSync(seed, { recursive: true });
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, "provisioned"), "stale\n");
    const env = {
      ...process.env,
      REELOS_ROOT: dest,
      REELOS_SEED: seed,
      REELOS_STATE: state,
      REELOS_SRC: src,
    };
    const r = spawnSync("bash", [join(root, "install/autoinstall/seed-reelos.sh")], {
      encoding: "utf8",
      env,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /laid out/);
    assert.equal(readFileSync(join(dest, "install.sh"), "utf8"), "#!/bin/bash\necho ok\n");
    assert.equal(readFileSync(join(dest, "app/VERSION"), "utf8").trim(), "1.2.50.48");
    assert.equal(readFileSync(join(dest, "app/.reelos-appliance"), "utf8").trim(), "1");
    assert.equal(existsSync(join(state, "provisioned")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seed-reelos.sh falls back to the disc bundle when GitHub is unreachable", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-bundle-"));
  try {
    const dest = join(dir, "opt");
    const seed = join(dir, "seed");
    const state = join(dir, "state");
    const staging = join(dir, "staging", "reelos");
    mkdirSync(join(staging, "app"), { recursive: true });
    mkdirSync(seed, { recursive: true });
    mkdirSync(state, { recursive: true });
    writeFileSync(join(staging, "install.sh"), "#!/bin/bash\necho bundled\n");
    chmodSync(join(staging, "install.sh"), 0o755);
    writeFileSync(join(staging, "app", ".reelos-appliance"), "1\n");
    const tar = spawnSync("tar", ["-czf", join(seed, "reelos-bundle.tar.gz"), "reelos"], {
      cwd: join(dir, "staging"),
      encoding: "utf8",
    });
    assert.equal(tar.status, 0, tar.stderr);
    const r = spawnSync("bash", [join(root, "install/autoinstall/seed-reelos.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        REELOS_ROOT: dest,
        REELOS_SEED: seed,
        REELOS_STATE: state,
        REELOS_GITHUB_TARBALL: "http://127.0.0.1:1/missing.tar.gz",
      },
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /bundled tarball/);
    assert.match(readFileSync(join(dest, "install.sh"), "utf8"), /bundled/);
    assert.equal(existsSync(join(state, "provisioned")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
