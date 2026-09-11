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

test("shipped reelos-debrid.json keeps enableMediaInfo off for *arr", () => {
  for (const app of ["sonarr", "radarr", "lidarr"]) {
    const install = JSON.parse(read(`install/compose/configs/${app}/reelos-debrid.json`));
    const live = JSON.parse(read(`compose/configs/${app}/reelos-debrid.json`));
    assert.equal(install.enableMediaInfo, false, app);
    assert.equal(install.ffprobeLibrary, false, app);
    assert.deepEqual(install, live);
  }
});

test("*arr debrid flags, FUSE count, and ensure_fuse do not restorm", () => {
  const code = joinParts(join(root, "install/bin/wire-engines.parts"));
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
flags = g["arr_debrid_media_flags"]()
assert flags["enableMediaInfo"] is False
jf = g["jellyfin_debrid_library_flags"]()
assert jf["EnableTrickplayImageExtraction"] is False
assert jf["ExtractTrickplayImagesDuringLibraryScan"] is False
assert jf["EnableChapterImageExtraction"] is False
patched = g["arr_debrid_media_patch"]({"id": 1, "enableMediaInfo": True, "recycleBin": "/x"})
assert patched["enableMediaInfo"] is False
assert patched["recycleBin"] == "/x"
info = """36 24 0:32 / /mnt/debrid rw shared:18 - fuse.decypharr decypharr rw
37 24 0:33 / /mnt/debrid rw shared:18 - fuse.decypharr decypharr rw
38 24 0:34 / /mnt/debrid rw shared:18 - fuse.decypharr decypharr rw
39 24 0:35 / /mnt/debrid rw shared:18 - fuse.decypharr decypharr rw
40 24 0:36 / /media rw - ext4 /dev/sda1 rw
"""
assert g["fuse_mount_count_from_mountinfo"](info) == 4
assert g["fuse_mount_count_from_mountinfo"](info, "/media") == 0
mount = """decypharr on /mnt/debrid type fuse.decypharr (rw)
decypharr on /mnt/debrid type fuse.decypharr (rw)
/dev/sda1 on /media type ext4 (rw)
"""
assert g["fuse_mount_count_from_mount"](mount) == 2
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const fuseFn = code.slice(code.indexOf("def ensure_fuse"), code.indexOf("def root_paths"));
  assert.doesNotMatch(fuseFn, /kick_imports/);
  assert.match(fuseFn, /not remounting/);
  assert.match(code, /fuse stacked/);
  assert.match(code, /not restarting/);
  assert.match(code, /no-ffprobe/);
  assert.match(code, /enableMediaInfo off/);
  assert.match(read("install/bin/reelos-update.sh"), /no-ffprobe/);
  assert.match(read("install/bin/stuck-downloads.py"), /enableMediaInfo.*= False/);
});

test("install and daemon twins include fuse-ffprobe-36", () => {
  assert.equal(read("install/bin/reelos-update.sh"), read("daemon/reelos-update.sh"));
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), joinParts(join(root, "daemon/wire-engines.parts")));
  assert.equal(read("install/bin/stuck-downloads.py"), read("daemon/stuck-downloads.py"));
});
