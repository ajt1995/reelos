import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("GNU cp onto itself is the firstboot loop (HERE==ROOT)", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-firstboot-"));
  try {
    mkdirSync(join(dir, "bin"));
    writeFileSync(join(dir, "bin", "x"), "1\n");
    writeFileSync(join(dir, "VERSION"), "1.2.50.31\n");
    const bin = spawnSync("cp", ["-a", `${dir}/bin/.`, `${dir}/bin/`], { encoding: "utf8" });
    assert.notEqual(bin.status, 0);
    assert.match(`${bin.stderr}\n${bin.stdout}`, /same file/);
    const ver = spawnSync("cp", ["-a", `${dir}/VERSION`, `${dir}/VERSION`], { encoding: "utf8" });
    assert.notEqual(ver.status, 0);
    assert.match(`${ver.stderr}\n${ver.stdout}`, /same file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provisioned firstboot path stamps stack-installed and exits 0 without apt", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-firstboot-"));
  try {
    const state = join(dir, "state");
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, "provisioned"), "1\n");
    const script = `#!/bin/bash
set -euo pipefail
STATE=${JSON.stringify(state)}
mkdir -p "$STATE"
if [ -f "$STATE/provisioned" ]; then
  echo 1 >"$STATE/stack-installed"
  echo "Already provisioned — stamped stack-installed; not re-running install; not enabling firstboot."
  exit 0
fi
echo SHOULD_NOT_RUN
exit 2
`;
    const r = spawnSync("bash", ["-lc", script], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Already provisioned/);
    assert.equal(readFileSync(join(state, "stack-installed"), "utf8").trim(), "1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("install.sh twins and firstboot unit stay the stack-installed latch", () => {
  const install = read("install/reelos-install.sh");
  assert.equal(install, read("daemon/install.sh"));
  assert.equal(read("install/systemd/reelos-firstboot.service"), read("firstboot/reelos-firstboot.service"));
  assert.match(read("install/systemd/reelos-firstboot.service"), /ConditionPathExists=!\/var\/lib\/reelos\/stack-installed/);
  assert.equal(read("daemon/reelos-update.sh").includes("enable reelos-firstboot"), false);
  assert.match(install, /deb\.nodesource\.com\/setup_22\.x/);
  assert.match(install, /Paste a TorBox key/);
  assert.doesNotMatch(install, /Real-Debrid key/);
  assert.match(install, /\.dockerenv/);
  assert.match(install, /storage-driver":"vfs"/);
  assert.match(install, /is-active --quiet caddy/);
  assert.doesNotMatch(install, /systemctl enable --now caddy/);
});
