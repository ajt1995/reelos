import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { catchupLocksHome, updateLocksUi } from "../src/lib/library-catchup.ts";
import { killOrphanPortPids } from "./reelos-box.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("OTA cleaner twins, never /media or ota.lock, self-test", () => {
  assert.equal(read("install/bin/reelos-ota-clean.sh"), read("daemon/reelos-ota-clean.sh"));
  assert.equal(read("install/bin/reelos_ota_clean.py"), read("daemon/reelos_ota_clean.py"));
  assert.equal(read("install/bin/reelos_os_tune.py"), read("daemon/reelos_os_tune.py"));
  assert.equal(read("install/bin/wire-engines.parts/09.part"), read("daemon/wire-engines.parts/09.part"));
  const sh = read("daemon/reelos-ota-clean.sh");
  assert.match(sh, /Never \/media/);
  assert.match(sh, /Never ota.lock/);
  assert.match(sh, /Never firstboot/);
  assert.match(sh, /Never docker restart Sonarr/);
  assert.match(sh, /OTA cleaner done/);
  assert.doesNotMatch(sh, /rm -rf \/media/);
  assert.doesNotMatch(sh, /rm .*ota\.lock/);
  assert.doesNotMatch(sh, /^\s*docker restart/m);
  const py = spawnSync("python3", [join(root, "daemon/reelos_ota_clean.py"), "--self-test"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(py.status, 0, py.stdout + py.stderr);
  const tune = spawnSync("python3", [join(root, "daemon/reelos_os_tune.py"), "--self-test"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(tune.status, 0, tune.stdout + tune.stderr);
});

test("cleaner does not kill live Jellyfin/Seerr; drops overseerr/jackett", () => {
  const plan = spawnSync("python3", [join(root, "daemon/reelos_ota_clean.py"), "--plan"], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, REELOS_ROOT: "/tmp/no-such-reelos" },
  });
  assert.equal(plan.status, 0, plan.stderr);
  const code = read("daemon/reelos_ota_clean.py");
  assert.match(code, /ALWAYS_KEEP/);
  assert.match(code, /jellyfin/);
  assert.match(code, /seerr/);
  assert.match(code, /overseerr/);
});

test("tmp leftovers skip /media and ota.lock; second pass is a no-op", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-ota-clean-"));
  const tmp = join(dir, "tmp");
  const opt = join(dir, "opt", "reelos");
  mkdirSync(join(tmp, "reelos-ota"), { recursive: true });
  mkdirSync(opt, { recursive: true });
  writeFileSync(join(tmp, "reelos-ota", "src.tar.gz"), "tar");
  try {
    const py = `
from pathlib import Path
import sys
sys.path.insert(0, ${JSON.stringify(join(root, "daemon"))})
import reelos_ota_clean as c
assert c.path_is_forbidden("/media")
assert c.path_is_forbidden(${JSON.stringify(join(dir, "ota.lock"))})
left = c.tmp_leftover_paths(tmp=${JSON.stringify(tmp)}, root=${JSON.stringify(opt)}, keep_work_src=True)
assert any(p.endswith("src.tar.gz") for p in left)
assert not any("/media" in p for p in left)
exist = c.existing_tmp_leftovers(tmp=${JSON.stringify(tmp)}, root=${JSON.stringify(opt)}, keep_work_src=True)
assert any(p.endswith("src.tar.gz") for p in exist)
print("ok")
`;
    const r = spawnSync("python3", ["-c", py], { encoding: "utf8", cwd: root });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mailman runs cleaner before applied; Caddy updating copy is honest", () => {
  const updater = read("daemon/reelos-update.sh");
  assert.equal(read("install/bin/reelos-update.sh"), updater);
  const cleaner = updater.indexOf("OTA cleaner — leftover nonsense");
  const applied = updater.indexOf('log "ReelOS $REMOTE applied."');
  const tmpClean = updater.indexOf('reelos-ota-clean.sh" --tmp');
  assert.ok(cleaner >= 0 && cleaner < applied, "cleaner before applied");
  assert.ok(tmpClean > applied, "tmp leftovers after stamp");
  assert.match(updater, /reelos_ota_clean\.py" --door/);
  assert.match(updater, /Updating ReelOS/);
  assert.doesNotMatch(updater, /Home can open/);
  assert.doesNotMatch(updater, /rm -rf \/media/);
  assert.doesNotMatch(updater, /rm -f "\$STATE\/ota\.lock"/);
  assert.match(read("daemon/wire-engines.parts/09.part"), /ota-clean bounded heal/);
});

test("update splash covers Apply; library banner does not freeze Request", () => {
  assert.equal(updateLocksUi("applying"), true);
  assert.equal(updateLocksUi("current"), false);
  assert.equal(updateLocksUi("idle"), false);
  assert.equal(catchupLocksHome({ status: "running", needsImport: true }), true);
  assert.equal(catchupLocksHome({ status: "done", needsImport: true }), false);
  const gate = read("src/components/gate.tsx");
  assert.match(gate, /Splash updating/);
  assert.match(gate, /updateLocksUi/);
  assert.doesNotMatch(gate, /if \(splashLock && !applying\) return <Splash/);
  assert.match(read("src/components/library-catchup-bar.tsx"), /Library catching up/);
  assert.match(read("src/components/splash.tsx"), /Not a percent/);
  const req = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(req, /pathOnly === "\/api\/request"/);
  assert.doesNotMatch(req, /library-catchup.*return/);
  assert.match(read("src/lib/use-sync-requests.ts"), /\/api\/request\?recover=1/);
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
  assert.match(read("install/systemd/reelos.service"), /fuser -k 8080\/tcp/);
});
