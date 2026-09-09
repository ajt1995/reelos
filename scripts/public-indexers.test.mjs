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
  assert.match(add, /OTA: public indexer add pass complete, skip live tests/);
  assert.doesNotMatch(
    add,
    /if os\.environ\.get\("REELOS_OTA"\):\n        log_wire\("OTA: skip public indexer tests"\)\n        return/,
  );
  assert.match(add, /public indexer added/);
  assert.match(add, /rss fallback/);
  assert.match(add, /apply_public_indexers/);
  assert.match(add, /schema \{e\} — RSS fallback/);
  assert.match(add, /"indexers" in sys\.argv/);
  assert.doesNotMatch(
    add,
    /schemas = call\("http:\/\/127\.0\.0\.1:9696\/api\/v1\/indexer\/schema".*\n.*have = call\("http:\/\/127\.0\.0\.1:9696\/api\/v1\/indexer"/,
  );
  const apps = read("daemon/wire-engines.parts/02.part");
  assert.match(apps, /syncLevel": prowlarr_app_sync_level\(\)/);
  assert.match(apps, /fullSync/);
  assert.match(apps, /def sync_prowlarr_apps/);
  assert.match(apps, /ApplicationIndexerSync/);
  assert.match(apps, /SONARR_SYNC_CATEGORIES.*8000/);
  assert.match(apps, /prowlarr_app_fields/);
  assert.doesNotMatch(apps, /"syncLevel": "addOnly"/);
  const main = read("daemon/wire-engines.parts/09.part");
  assert.match(main, /if "indexers" in sys\.argv/);
  assert.match(main, /def ensure_indexers_and_sync/);
  assert.match(main, /widen_sonarr_hybrid/);
  assert.match(main, /research-missing/);
  assert.match(main, /--quick/);
  const updater = read("daemon/reelos-update.sh");
  assert.match(updater, /wire-engines\.py" indexers/);
  assert.match(updater, /EZTV\/ShowRSS/);
});

test("Sonarr fullSync includes TorrentRss 8000/Other and preserves TV categories", () => {
  const apps = read("daemon/wire-engines.parts/02.part");
  const chunk = apps.slice(
    apps.indexOf("def prowlarr_app_sync_level"),
    apps.indexOf("def ensure_prowlarr_app"),
  );
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {}
exec(compile(sys.stdin.read(), "apps.py", "exec"), g)
old = [{"name": "syncCategories", "value": [5000, 5030]}]
out = g["prowlarr_app_fields"]("Sonarr", old)
sync = next(f["value"] for f in out if f["name"] == "syncCategories")
assert sync == [5000, 5030, 8000], sync
assert old[0]["value"] == [5000, 5030], old
assert g["prowlarr_app_needs_update"]({"name": "Sonarr", "syncLevel": "fullSync", "fields": old})
assert not g["prowlarr_app_needs_update"]({"name": "Sonarr", "syncLevel": "fullSync", "fields": out})
assert g["prowlarr_app_fields"]("Radarr", []) == []
`,
    ],
    { input: chunk, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("house with only TPB/YTS still POSTs EZTV+ShowRSS via TorrentRss", () => {
  const r = spawnSync("python3", [join(root, "daemon/public_indexers.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /test_tpb_yts_only_house_posts_eztv_and_showrss/);
  assert.match(out, /test_no_cardigann_schema_uses_torrent_rss_fallback/);
  assert.match(out, /test_empty_schema_still_posts_eztv_showrss/);
  assert.match(out, /test_sandbox_house_tpb_only_http_posts_eztv_showrss/);
  assert.match(out, /test_doctor_lists_all_and_fails_when_tv_publics_missing/);
  assert.match(out, /test_hybrid_profile_allows_eztv_720p/);
});

test("doctor lists every enabled indexer and fails closed without EZTV/ShowRSS", () => {
  const r = spawnSync("python3", [join(root, "daemon/reelos-doctor.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const doc = read("daemon/reelos-doctor.py");
  assert.match(doc, /doctor_releases_detail/);
  assert.match(doc, /enabled_indexer_names/);
  const hop = doc.slice(doc.indexOf("def releases_hop"), doc.indexOf("def download_lock_hop"));
  assert.doesNotMatch(hop, /\/indexer\/test/);
  assert.match(doc, /Sonarr has no Decypharr client/);
  assert.match(doc, /\/api\/v3\/downloadclient/);
  assert.equal(read("install/bin/reelos-doctor.py"), doc);
});
