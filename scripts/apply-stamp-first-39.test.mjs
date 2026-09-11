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

test("Apply does not await full kick_imports before applied", () => {
  const updater = read("daemon/reelos-update.sh");
  const applied = updater.indexOf('log "ReelOS $REMOTE applied."');
  const catchup = updater.indexOf("library catch-up in background", applied);
  assert.ok(applied >= 0, "applied. stamp missing");
  assert.ok(catchup > applied, "library catch-up must run after applied.");
  const before = updater.slice(0, applied);
  assert.equal(before.includes('log "import after hops'), false, "must not freeze the phone on import after hops");
  assert.equal(before.includes("kick_imports("), false);
  assert.equal(before.includes('wire-engines.py" import'), false);
  assert.match(updater, /import\/heal red — not un-stamping UI swap/);
  assert.match(updater, /not printing applied — jellyfin\/indexer heal red/);
  const healRed = updater.indexOf('log "not printing applied — jellyfin/indexer heal red"');
  const composeGate = updater.lastIndexOf('if [ "${COMPOSE_CHANGED:-0}" = "1" ]; then', healRed);
  assert.ok(composeGate >= 0 && composeGate < healRed, "heal-red un-stamp is compose-changed only");
  assert.doesNotMatch(updater, /umount -l \/media/);
  assert.doesNotMatch(updater, /rm -rf \/media/);
  assert.doesNotMatch(updater, /rm -f "\$STATE\/ota\.lock"/);
  assert.equal(read("install/bin/reelos-update.sh"), updater);
});

test("recover timer job runs capped catch-up import; first provision still walks", () => {
  const heal = read("daemon/reelos-selfheal.sh");
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
  assert.match(heal, /library catch-up in background/);
  assert.match(heal, /import --catch-up/);
  assert.match(heal, /not walking FUSE/);
  assert.doesNotMatch(heal, /\/mnt\/debrid\/__all__/);
  const nine = read("daemon/wire-engines.parts/09.part");
  assert.match(nine, /first provision — library walk/);
  assert.match(nine, /kick_imports\(catch_up=False\)/);
  assert.match(nine, /kick_imports\(catch_up="--catch-up" in sys\.argv\)/);
  const otaGate = nine.indexOf('if os.environ.get("REELOS_OTA") != "1":');
  const walk = nine.indexOf("first provision — library walk");
  assert.ok(otaGate >= 0 && otaGate < walk);
  assert.match(read("scripts/reelos-request-status.mjs"), /import", "--catch-up"/);
});

test("catch-up import skips FUSE dfs, all-show RescanSeries, hybrid 1080, and duplicate paths", () => {
  const one = read("daemon/wire-engines.parts/01.part");
  const eight = read("daemon/wire-engines.parts/08.part");
  const harden = read("daemon/sonarr_manual_import.py");
  assert.equal(one, read("install/bin/wire-engines.parts/01.part"));
  assert.equal(eight, read("install/bin/wire-engines.parts/08.part"));
  assert.equal(harden, read("install/bin/sonarr_manual_import.py"));
  assert.match(one, /skip FUSE relink/);
  assert.doesNotMatch(one, /body=\{"name": "RescanSeries"\}/);
  assert.doesNotMatch(one, /for path in \("\/mnt\/symlinks\/sonarr", "\/symlinks\/sonarr"\)/);
  assert.doesNotMatch(one, /for path in \("\/mnt\/symlinks\/radarr", "\/symlinks\/radarr"\)/);
  assert.match(one, /"path": "\/symlinks\/sonarr"/);
  assert.match(one, /"path": "\/symlinks\/radarr"/);
  assert.match(eight, /skip hybrid 1080 grab/);
  assert.match(harden, /skip folder on timeout/);
  assert.match(harden, /already has files/);
  assert.match(harden, /LIST_TIMEOUT_SEC = 20/);
  assert.match(harden, /"RescanSeries", "seriesId"/);
  assert.doesNotMatch(harden, /timeout=120/);
  const relink = read("daemon/relink_dumps.py");
  const dumpFn = relink.slice(relink.indexOf("def dump_has_media"), relink.indexOf("def fill_dump_from_pack"));
  assert.match(dumpFn, /iterdir/);
  assert.doesNotMatch(dumpFn, /rglob/);
  assert.doesNotMatch(dumpFn, /os\.walk/);
});

test("wire-engines parts still compile after stamp-first import", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
    input: code,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(code, /kick_imports\(\*, catch_up/);
  assert.match(code, /heal_after_import\(\*, catch_up/);
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), code);
});
