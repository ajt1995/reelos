import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("public indexer roster: YTS movies-only; EZTV+ShowRSS for TV sitcoms", () => {
  const r = spawnSync("python3", [join(root, "daemon/public_indexers.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const roster = read("daemon/public_indexers.py");
  assert.match(roster, /ReelOS-eztv/);
  assert.match(roster, /ReelOS-showrss/);
  assert.match(roster, /"movie"\),/);
  assert.doesNotMatch(roster, /passkey|apikey.*=.*[a-zA-Z0-9]{16}/);
  assert.equal(read("install/bin/public_indexers.py"), roster);
});

test("OTA Apply still POSTs missing public indexers and fullSyncs Sonarr", () => {
  const add = read("daemon/wire-engines.parts/04.part");
  assert.match(add, /OTA: added missing public indexers, skip live tests/);
  assert.doesNotMatch(
    add,
    /if os\.environ\.get\("REELOS_OTA"\):\n        log_wire\("OTA: skip public indexer tests"\)\n        return/,
  );
  assert.match(add, /public indexer added/);
  const apps = read("daemon/wire-engines.parts/02.part");
  assert.match(apps, /syncLevel": prowlarr_app_sync_level\(\)/);
  assert.match(apps, /fullSync/);
  assert.match(apps, /def sync_prowlarr_apps/);
  assert.match(apps, /ApplicationIndexerSync/);
  assert.doesNotMatch(apps, /"syncLevel": "addOnly"/);
  const main = read("daemon/wire-engines.parts/09.part");
  assert.match(main, /if "indexers" in sys\.argv/);
  assert.match(main, /def ensure_indexers_and_sync/);
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /wire-engines\.py" indexers/);
  assert.match(updater, /EZTV\/ShowRSS/);
});
