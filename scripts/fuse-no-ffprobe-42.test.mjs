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

test("same-device fuse.decypharr views count as one daemon; /media is never a FUSE", () => {
  const code = joinParts(join(root, "install/bin/wire-engines.parts"));
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
house = """68 158 0:74 / /mnt/debrid rw shared:66 - fuse.decypharr decypharr rw
104 47 0:74 / /mnt/debrid rw shared:66 - fuse.decypharr decypharr rw
133 154 0:74 / /mnt/debrid rw shared:66 - fuse.decypharr decypharr rw
137 157 0:74 / /mnt/debrid rw shared:66 - fuse.decypharr decypharr rw
154 158 8:2 /mnt /mnt rw shared:1 - ext4 /dev/sda2 rw
157 154 8:2 /mnt /mnt rw shared:1 - ext4 /dev/sda2 rw
158 47 8:2 /mnt /mnt rw shared:1 - ext4 /dev/sda2 rw
40 24 0:36 / /media rw - ext4 /dev/sda1 rw
"""
assert g["fuse_mount_count_from_mountinfo"](house) == 4
assert g["fuse_unique_devices_from_mountinfo"](house) == {"0:74"}
assert g["fuse_mnt_self_bind_count"](house) == 3
assert g["fuse_mount_count_from_mountinfo"](house, "/media") == 0
assert "peel extra /mnt binds" in sys.stdin.read() if False else True
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(code, /peel extra \/mnt binds/);
  assert.match(code, /not lazy/);
  assert.match(code, /stub_container_ffprobe/);
  assert.match(code, /not bind-stacking/);
  assert.match(code, /findmnt -n \/mnt/);
  assert.doesNotMatch(code.slice(code.indexOf("def persist_mnt_shared")), /ExecStart=\/bin\/mount --bind \/mnt \/mnt/);
});

test("no-ffprobe stubs dump ffprobe even when enableMediaInfo is already false", () => {
  const seven = read("daemon/wire-engines.parts/07.part");
  assert.match(seven, /stub_container_ffprobe/);
  assert.match(seven, /busy-inode/);
  assert.match(seven, /do not ffprobe FUSE dumps/);
  assert.match(seven, /enableMediaInfo already off/);
  const idx = seven.indexOf("def apply_arr_debrid_media_info");
  const body = seven.slice(idx, seven.indexOf("def jellyfin_debrid_encoding_patch"));
  assert.match(body, /stub_container_ffprobe\(\)/);
});

test("catch-up is idle unless actually importing; stubbed ffprobe continues skip-existing", () => {
  const sh = read("daemon/reelos-library-catchup.sh");
  const heal = read("daemon/reelos-selfheal.sh");
  assert.match(sh, /ffprobe_stubbed/);
  assert.match(sh, /write_progress idle/);
  assert.doesNotMatch(sh, /backing off \(ffprobe busy\)/);
  assert.doesNotMatch(read("daemon/sonarr_manual_import.py"), /backing off \(ffprobe busy\)/);
  assert.match(heal, /library catch-up deferred/);
  assert.match(heal, /ffprobe_stubbed/);
  assert.equal(sh, read("install/bin/reelos-library-catchup.sh"));
  assert.equal(heal, read("install/bin/reelos-selfheal.sh"));
});

test("install and daemon twins include fuse-no-ffprobe-42", () => {
  assert.equal(read("install/bin/reelos-update.sh"), read("daemon/reelos-update.sh"));
  assert.equal(joinParts(join(root, "install/bin/wire-engines.parts")), joinParts(join(root, "daemon/wire-engines.parts")));
  assert.equal(read("install/bin/sonarr_manual_import.py"), read("daemon/sonarr_manual_import.py"));
});
