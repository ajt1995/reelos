import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function joinParts(dir) {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".part"))
    .sort()
    .map((n) => readFileSync(join(dir, n), "utf8"))
    .join("");
}

test("Apply path never awaits indexers or import before applied", () => {
  const updater = read("daemon/reelos-update.sh");
  const applied = updater.indexOf('log "ReelOS $REMOTE applied."');
  assert.ok(applied >= 0);
  const before = updater.slice(0, applied);
  assert.equal(before.includes('if ! python3 "$ROOT/bin/wire-engines.py" indexers'), false);
  assert.equal(before.includes('wire-engines.py" import'), false);
  assert.equal(before.includes("kick_imports("), false);
  assert.doesNotMatch(before, /python3 "\$ROOT\/bin\/wire-engines\.py"\s*(?:\|\||$)/m);
  assert.doesNotMatch(before, /REELOS_OTA=1.*wire-engines\.py/);
  assert.match(before, /indexers\/import after applied \(not blocking stamp\)/);
  assert.match(updater.slice(applied), /library catch-up in background/);
  assert.match(updater.slice(applied), /reelos-library-catchup/);
  assert.equal(read("install/bin/reelos-update.sh"), updater);
});

test("persistent library catch-up unit outlives selfheal 90s", () => {
  const unit = read("install/systemd/reelos-library-catchup.service");
  const healUnit = read("install/systemd/reelos-selfheal.service");
  const worker = read("daemon/reelos-library-catchup.sh");
  const heal = read("daemon/reelos-selfheal.sh");
  assert.equal(unit, read("firstboot/reelos-library-catchup.service"));
  assert.equal(worker, read("install/bin/reelos-library-catchup.sh"));
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
  assert.match(unit, /TimeoutStartSec=infinity/);
  assert.match(unit, /KillMode=process/);
  assert.match(unit, /MemoryMax=768M/);
  assert.match(healUnit, /TimeoutStartSec=90/);
  assert.match(worker, /do not remount if listed/);
  assert.match(worker, /import --catch-up/);
  assert.match(worker, /wire-engines.py" indexers/);
  assert.match(worker, /ffprobe D-state/);
  assert.match(heal, /systemd-run/);
  assert.match(heal, /9>&-/);
  assert.doesNotMatch(worker, /umount -l \/media/);
  assert.doesNotMatch(worker, /ota\.lock/);
  assert.doesNotMatch(unit, /TimeoutStartSec=600/);
});

test("phone has two clocks: Applying vs Library catching up", () => {
  assert.match(read("src/components/applying-bar.tsx"), /Applying \{name\}/);
  assert.match(read("src/components/library-catchup-bar.tsx"), /Library catching up/);
  assert.match(read("src/components/shell.tsx"), /LibraryCatchupBar/);
  assert.match(read("src/components/settings-updates.tsx"), /Library catching up/);
  assert.match(read("src/components/gate.tsx"), /splashLock/);
  assert.match(read("src/components/splash.tsx"), /Library catching up/);
  const ota = read("scripts/reelos-ota-status.mjs");
  assert.match(ota, /applyProductRunning/);
  assert.match(ota, /productSwapDone/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /libraryCatchup/);
  assert.match(read("scripts/reelos-lookup-plugin.mjs"), /applyProductRunning/);
});

test("library worker backs off on ffprobe D-state and does not remount FUSE", () => {
  const one = read("daemon/wire-engines.parts/01.part");
  const harden = read("daemon/sonarr_manual_import.py");
  assert.equal(one, read("install/bin/wire-engines.parts/01.part"));
  assert.equal(harden, read("install/bin/sonarr_manual_import.py"));
  assert.match(one, /do not remount if listed/);
  assert.match(one, /import catch-up backoff/);
  assert.doesNotMatch(one.slice(one.indexOf("def kick_imports")), /ensure_fuse\(/);
  assert.match(harden, /import catch-up backoff/);
  assert.match(harden, /FFPROBE_D_BACKOFF_LIMIT = 1/);
  assert.match(harden, /Library catching up/);
});

test("wire-engines parts still compile after library split", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
    input: code,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), code);
});
