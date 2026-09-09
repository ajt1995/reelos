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

test("compose jellyfin network.xml defaults publish URI by request", () => {
  for (const rel of [
    "compose/configs/jellyfin/config/network.xml",
    "install/compose/configs/jellyfin/config/network.xml",
  ]) {
    const xml = read(rel);
    assert.match(xml, /<EnablePublishedServerUriByRequest>\s*true\s*</);
    assert.match(xml, /<EnableRemoteAccess>\s*true\s*</);
    assert.doesNotMatch(xml, /172\.18\./);
  }
});

test("wire-engines.parts concatenate and compile (install + daemon)", () => {
  for (const rel of ["install/bin/wire-engines.parts", "daemon/wire-engines.parts"]) {
    const code = joinParts(join(root, rel));
    const r = spawnSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'wire-engines.py', 'exec')"], {
      input: code,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${rel} compile\n${r.stderr}`);
    assert.match(code, /Authorization.*MediaBrowser Client="ReelOS".*DeviceId="reelos"/);
    assert.match(code, /reveal_jellyfin_admin/);
    assert.match(code, /IsHidden/);
    assert.match(code, /seed_jellyfin_network_xml/);
    assert.match(code, /EnablePublishedServerUriByRequest/);
    assert.match(code, /apply_jellyfin_published_uri/);
    assert.match(code, /jellyfin_want_libraries/);
    assert.match(code, /extra_jellyfin_paths/);
    assert.match(code, /remove_jellyfin_path/);
    assert.match(code, /jellyfin drop extra path/);
    assert.match(code, /delete_jellyfin_library/);
    assert.match(code, /collapse_season_named_dumps/);
    assert.match(code, /extra_jellyfin_libraries/);
    assert.match(code, /wizard_completed/);
    assert.match(code, /Startup\/Configuration/);
  }
});

test("Movies/Shows keep only /symlinks/radarr|sonarr — extra paths are dropped", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
folder = {
    "Name": "Movies",
    "Locations": ["/symlinks", "/symlinks/radarr", "/mnt/symlinks/radarr", "/media/movies"],
    "LibraryOptions": {"PathInfos": []},
}
keep = g["library_symlink_path"]("Movies")
assert keep == "/symlinks/radarr", keep
g["answers"] = lambda: {"storageMode": "debrid"}
extras = g["extra_jellyfin_paths"](folder, g["jellyfin_keep_paths"]("Movies"))
assert "/media/movies" in extras, extras
assert "/symlinks" in extras, extras
assert "/mnt/symlinks/radarr" in extras, extras
assert "/symlinks/radarr" not in extras, extras
assert g["libraries_ready"]([folder], [("Movies", "movies")]) is False
ready = {
    "Name": "Movies",
    "Locations": ["/symlinks/radarr"],
    "LibraryOptions": {"PathInfos": [{"Path": "/symlinks/radarr"}]},
}
assert g["libraries_ready"]([ready], [("Movies", "movies")]) is True
shows = {
    "Name": "Shows",
    "Locations": ["/symlinks", "/symlinks/sonarr"],
    "LibraryOptions": {"PathInfos": []},
}
assert "/symlinks" in g["extra_jellyfin_paths"](shows, g["jellyfin_keep_paths"]("Shows"))

# A local/both house keeps files on disk: /media is a real root, not a dupe view.
for mode in ("local", "both"):
    g["answers"] = lambda mode=mode: {"storageMode": mode}
    keeps = g["jellyfin_keep_paths"]("Movies")
    assert keeps == ["/symlinks/radarr", "/media/movies"], (mode, keeps)
    extras = g["extra_jellyfin_paths"](folder, keeps)
    assert "/media/movies" not in extras, (mode, extras)
    assert "/symlinks" in extras, (mode, extras)
    assert "/mnt/symlinks/radarr" in extras, (mode, extras)
    assert g["jellyfin_keep_paths"]("Shows") == ["/symlinks/sonarr", "/media/tv"]
    on_disk = {
        "Name": "Movies",
        "Locations": ["/symlinks/radarr", "/media/movies"],
        "LibraryOptions": {"PathInfos": []},
    }
    assert g["libraries_ready"]([on_disk], [("Movies", "movies")]) is True, mode
# No answers.json must not delete the disk library either.
g["answers"] = lambda: {}
assert "/media/movies" not in g["extra_jellyfin_paths"](folder, g["jellyfin_keep_paths"]("Movies"))
calls = []
g["call"] = lambda url, **kwargs: calls.append((url, kwargs))
g["remove_jellyfin_path"]("token", "Movies", "/media/movies")
url, kwargs = calls[0]
assert "name=Movies" in url, url
assert "path=%2Fmedia%2Fmovies" in url, url
assert "refreshLibrary=true" in url, url
assert kwargs["method"] == "DELETE", kwargs
assert "body" not in kwargs, kwargs

# Extra virtual folders (TV + Movies 2) drop; /media migrates onto Movies for local/both.
g["answers"] = lambda: {"storageMode": "both"}
folders = [
    folder,
    {"Name": "TV", "CollectionType": "tvshows", "Locations": ["/symlinks"], "LibraryOptions": {"PathInfos": []}},
    {
        "Name": "Movies 2",
        "CollectionType": "movies",
        "Locations": ["/media/movies"],
        "LibraryOptions": {"PathInfos": [{"Path": "/media/movies"}]},
    },
]
extras = g["extra_jellyfin_libraries"](folders, [("Movies", "movies"), ("Shows", "tvshows")])
assert {f["Name"] for f in extras} == {"TV", "Movies 2"}, extras
assert g["strip_season_folder_suffix"]("Brooklyn Nine-Nine S01") == "Brooklyn Nine-Nine"
assert g["strip_season_folder_suffix"]("The Walking Dead - Season 1") == "The Walking Dead"
import tempfile, os
from pathlib import Path
td = tempfile.mkdtemp()
# collapse must refuse /media
media_root = Path(td) / "media" / "tv"
media_root.mkdir(parents=True)
(media_root / "Brooklyn Nine-Nine").mkdir()
(media_root / "Brooklyn Nine-Nine S01").mkdir()
assert g["collapse_season_named_dumps"](str(media_root)) == 0
assert (media_root / "Brooklyn Nine-Nine S01").is_dir()
# refuse anything that is not the sonarr dump root
assert g["collapse_season_named_dumps"](str(Path(td) / "other")) == 0
dump = Path(td) / "sonarr"
dump.mkdir()
(dump / "Brooklyn Nine-Nine").mkdir()
(dump / "Brooklyn Nine-Nine" / "S01E01.mkv").write_bytes(b"x")
(dump / "Brooklyn Nine-Nine S01").mkdir()
(dump / "Brooklyn Nine-Nine S01" / "ep.mkv").write_bytes(b"x")
(dump / "The Walking Dead").mkdir()
(dump / "The Walking Dead" / "video.mkv").write_bytes(b"x")
(dump / "The Walking Dead - Season 1").mkdir()
os.environ["REELOS_TEST_DUMP_ROOT"] = str(dump)
try:
    n = g["collapse_season_named_dumps"](str(dump))
finally:
    os.environ.pop("REELOS_TEST_DUMP_ROOT", None)
assert n == 2, n
assert (dump / "Brooklyn Nine-Nine").is_dir()
assert not (dump / "Brooklyn Nine-Nine S01").exists()
assert (dump / "The Walking Dead").is_dir()
assert not (dump / "The Walking Dead - Season 1").exists()
print("ok")
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /ok/);
  const hop = read("daemon/wire-engines.parts/09.part");
  assert.match(hop, /ensure_jellyfin_libraries/);
  assert.match(hop, /jellyfin libraries one dump path each/);
  assert.match(hop, /widen_radarr_hybrid/);
  const eight = read("daemon/wire-engines.parts/08.part");
  assert.match(eight, /delete_jellyfin_library/);
  assert.match(eight, /collapse_season_named_dumps/);
  assert.match(eight, /drop_extra_jellyfin_libraries/);
});

test("install and daemon wire-engines bodies stay twins", () => {
  const a = joinParts(join(root, "install/bin/wire-engines.parts"));
  const b = joinParts(join(root, "daemon/wire-engines.parts"));
  assert.equal(a, b);
  assert.equal(read("install/bin/wire-engines.py"), read("daemon/wire-engines.py"));
});

test("plugin AuthenticateByName sends Authorization MediaBrowser (JF 10.10+/12)", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(src, /const JF_AUTH/);
  assert.match(src, /Authorization: JF_AUTH/);
  assert.match(src, /"X-Emby-Authorization": JF_AUTH/);
  assert.match(src, /revealJellyfinAdmin/);
  assert.match(src, /IsHidden: false/);
  assert.match(src, /seedJellyfinNetworkXml/);
  assert.match(src, /EnablePublishedServerUriByRequest/);
});

test("Finish /api/provision seeds jellyfin network.xml before detached compose up", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const idx = src.indexOf("async function handleProvision");
  assert.ok(idx >= 0);
  const chunk = src.slice(idx, src.indexOf("async function handlePing", idx));
  assert.match(chunk, /seedJellyfinNetworkXml\(composeDir\)/);
  assert.match(chunk, /Do not spawnSync `compose pull`/);
  assert.match(chunk, /docker compose up -d/);
  assert.match(chunk, /detached: true/);
  assert.doesNotMatch(chunk, /run\(\["pull"\]/);
  assert.ok(chunk.indexOf("seedJellyfinNetworkXml") < chunk.indexOf("docker compose up -d"));
});

test("/api/box requires Movies/Shows unless intent turns them off", () => {
  const src = read("scripts/reelos-lookup-plugin.mjs");
  const idx = src.indexOf("async function jellyfinState");
  const chunk = src.slice(idx, src.indexOf("function saveAuthUrl", idx));
  assert.match(chunk, /intent\.movies !== false/);
  assert.match(chunk, /intent\.tv !== false/);
  assert.match(chunk, /no matching user\/PIN/);
});

test("soft-reset re-seeds jellyfin network.xml", () => {
  for (const rel of ["install/bin/reelos-reset.sh", "daemon/reelos-reset.sh"]) {
    const src = read(rel);
    assert.match(src, /EnablePublishedServerUriByRequest>true/);
    assert.match(src, /configs\/jellyfin\/config\/network\.xml/);
    assert.match(src, /jellyfin network\.xml re-seeded/);
  }
});

test("auth-mismatch reset waits for first-run then completes startup", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  assert.match(code, /seed_jellyfin_network_xml\(\)/);
  assert.match(code, /wait_jellyfin\(90, wizard_completed=False\)/);
  assert.match(code, /apply_jellyfin_published_uri\(token\)/);
  const reset = code.slice(code.indexOf("def reset_jellyfin_config"), code.indexOf("def wait_jellyfin"));
  assert.ok(reset.indexOf("seed_jellyfin_network_xml") < reset.indexOf('compose("up"'));
});
