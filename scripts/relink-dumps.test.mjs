import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("relink recreates empty category dumps from FUSE using *arr titles", () => {
  const r = spawnSync("python3", [join(root, "install/bin/relink_dumps.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("relink_dumps and wire-engines import stay twins and category-only", () => {
  const a = readFileSync(join(root, "install/bin/relink_dumps.py"), "utf8");
  const b = readFileSync(join(root, "daemon/relink_dumps.py"), "utf8");
  assert.equal(a, b);
  const part = readFileSync(join(root, "install/bin/wire-engines.parts/01.part"), "utf8");
  assert.match(part, /relink_dumps/);
  assert.match(part, /wanted_relink_stems/);
  assert.match(a, /relink created/);
  assert.doesNotMatch(part, /for dump_root in \(Path\("\/mnt\/symlinks\/sonarr"\), Path\("\/mnt\/symlinks\/radarr"\), Path\("\/mnt\/symlinks"\)\)/);
  const updater = readFileSync(join(root, "daemon/reelos-update.sh"), "utf8");
  assert.match(updater, /import after hops \(TV\/movies into the library\)/);
  assert.match(updater, /wire-engines\.py" import/);
  assert.match(updater, /need daemon\/relink_dumps\.py 'relink created'/);
  assert.match(updater, /need daemon\/stuck-downloads\.py 'recover_missing_movies'/);
  assert.match(updater, /need scripts\/reelos-lookup-plugin\.mjs 'kickArrRecover'/);
  assert.match(updater, /need daemon\/public_indexers\.py 'ReelOS-eztv'/);
  assert.match(updater, /need daemon\/reelos-update\.sh 'wire-engines.py" indexers'/);
  assert.match(updater, /need daemon\/public_indexers\.py 'TorrentRssIndexer'/);
  assert.match(updater, /need daemon\/reelos-doctor\.py 'doctor_releases_detail'/);
});
