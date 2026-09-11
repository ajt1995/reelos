import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("sonarr manualimport matching: S01.E01, skip Museum under radarr, season packs", () => {
  const r = spawnSync("python3", [join(root, "install/bin/sonarr_manual_import.py"), "--self-test"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("install and daemon sonarr_manual_import stay twins", () => {
  const a = readFileSync(join(root, "install/bin/sonarr_manual_import.py"), "utf8");
  const b = readFileSync(join(root, "daemon/sonarr_manual_import.py"), "utf8");
  assert.equal(a, b);
});

test("kick_imports scans only category dumps, not /mnt/symlinks parent", () => {
  const part = readFileSync(join(root, "install/bin/wire-engines.parts/01.part"), "utf8");
  const daemon = readFileSync(join(root, "daemon/wire-engines.parts/01.part"), "utf8");
  assert.equal(part, daemon);
  assert.match(part, /skip FUSE relink/);
  assert.match(part, /"path": "\/symlinks\/sonarr"/);
  assert.match(part, /"path": "\/symlinks\/radarr"/);
  assert.doesNotMatch(part, /for path in \("\/mnt\/symlinks\/sonarr", "\/symlinks\/sonarr"\)/);
  assert.doesNotMatch(part, /for path in \("\/mnt\/symlinks\/radarr", "\/symlinks\/radarr"\)/);
  assert.doesNotMatch(part, /for path in \("\/mnt\/symlinks\/sonarr", "\/mnt\/symlinks"\)/);
  assert.doesNotMatch(part, /body=\{"name": "RescanSeries"\}/);
  assert.doesNotMatch(part, /for dump_root in \(Path\("\/mnt\/symlinks\/sonarr"\), Path\("\/mnt\/symlinks\/radarr"\), Path\("\/mnt\/symlinks"\)\)/);
  assert.match(part, /_relink_stem/);
});
