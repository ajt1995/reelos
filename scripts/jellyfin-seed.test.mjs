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
    assert.match(code, /heal_season_folder_items/);
    assert.match(code, /plan_season_folder_item/);
    assert.match(code, /season_folder_item_path/);
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
assert g["strip_season_folder_suffix"]("- Season 1") == "- Season 1"
assert g["looks_like_season_folder_title"]("The Walking Dead - Season 1") is True
assert g["looks_like_season_folder_title"]("The Walking Dead") is False
import tempfile, os
from pathlib import Path
td = tempfile.mkdtemp()
# collapse must refuse /media
media_root = Path(td) / "media" / "tv"
media_root.mkdir(parents=True)
(media_root / "Brooklyn Nine-Nine").mkdir()
(media_root / "Brooklyn Nine-Nine S01").mkdir()
assert g["collapse_season_named_dumps"](str(media_root), allow=[str(media_root)]) == 0
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
# the allowlist is a parameter, never the ambient environment
os.environ["REELOS_TEST_DUMP_ROOT"] = str(dump)
try:
    assert g["collapse_season_named_dumps"](str(dump)) == 0
finally:
    os.environ.pop("REELOS_TEST_DUMP_ROOT", None)
assert (dump / "Brooklyn Nine-Nine S01").is_dir()
n = g["collapse_season_named_dumps"](str(dump), allow=[str(dump)])
assert n == 2, n
assert (dump / "Brooklyn Nine-Nine").is_dir()
assert not (dump / "Brooklyn Nine-Nine S01").exists()
assert (dump / "The Walking Dead").is_dir()
assert not (dump / "The Walking Dead - Season 1").exists()
# empty series stub + Season 1 dump: move media, then drop the season-named dir
empty = Path(td) / "sonarr-empty"
empty.mkdir()
(empty / "The Walking Dead").mkdir()
(empty / "The Walking Dead - Season 1").mkdir()
(empty / "The Walking Dead - Season 1" / "S01E01.mkv").write_bytes(b"x")
assert g["collapse_season_named_dumps"](str(empty), allow=[str(empty)]) == 1
assert (empty / "The Walking Dead" / "S01E01.mkv").is_file()
assert not (empty / "The Walking Dead - Season 1").exists()

# DELETE /Items takes the files with it: only a season-named dir in a dump root qualifies.
assert g["season_folder_item_path"]("/symlinks/sonarr/The Walking Dead - Season 1") is True
assert g["season_folder_item_path"]("/mnt/symlinks/sonarr/The Walking Dead - Season 1") is True
assert g["season_folder_item_path"]("/media/tv/The Walking Dead - Season 1") is False
assert g["season_folder_item_path"]("/symlinks/sonarr/The Walking Dead") is False
assert g["season_folder_item_path"]("/symlinks/sonarr") is False
assert g["season_folder_item_path"]("/symlinks") is False
assert g["season_folder_item_path"]("") is False

twd = {
    "Id": "jf-twd",
    "Name": "The Walking Dead",
    "Path": "/symlinks/sonarr/The Walking Dead",
    "ProviderIds": {"Tvdb": "153021", "Tmdb": "1402"},
}
twd_s1 = {
    "Id": "jf-twd-s1",
    "Name": "The Walking Dead - Season 1",
    "Path": "/symlinks/sonarr/The Walking Dead - Season 1",
    "ProviderIds": {},
}
assert g["plan_season_folder_item"](twd_s1, [twd, twd_s1])["action"] == "delete"
assert g["plan_season_folder_item"](twd, [twd, twd_s1]) is None
# the same leftover on a local/both disk library is the house's own media — hands off
disk_s1 = dict(twd_s1, Id="jf-disk-s1", Path="/media/tv/The Walking Dead - Season 1")
assert g["plan_season_folder_item"](disk_s1, [twd, disk_s1]) is None
assert g["plan_season_folder_item"](dict(twd_s1, Path=None), [twd, twd_s1]) is None
orphan = {
    "Id": "jf-only",
    "Name": "Brooklyn Nine-Nine S01",
    "Path": "/symlinks/sonarr/Brooklyn Nine-Nine S01",
    "ProviderIds": {},
}
assert g["plan_season_folder_item"](orphan, [orphan]) == {
    "action": "rename",
    "id": "jf-only",
    "name": "Brooklyn Nine-Nine S01",
    "as": "Brooklyn Nine-Nine",
}
assert g["plan_season_folder_item"](dict(orphan, Path="/media/tv/Brooklyn Nine-Nine S01"), [orphan]) is None
vs1 = {"Id": "jf-vs1", "Name": "Vinland Saga", "Path": "/symlinks/sonarr/Vinland Saga", "ProviderIds": {"Tvdb": "359274"}}
vs2 = {
    "Id": "jf-vs2",
    "Name": "Vinland Saga S2",
    "Path": "/symlinks/sonarr/Vinland Saga S2",
    "ProviderIds": {"Tvdb": "421739"},
}
assert g["plan_season_folder_item"](vs2, [vs1, vs2]) is None
healed = []
g["log_wire"] = lambda m: None
assert g["heal_season_folder_items"]("tok", items=[twd, twd_s1], call_fn=lambda url, **kw: healed.append((kw.get("method"), url))) == 1
assert healed[0][0] == "DELETE"
assert "jf-twd-s1" in healed[0][1]
# nothing on /media is ever handed to Jellyfin's delete
kept = []
assert g["heal_season_folder_items"]("tok", items=[twd, disk_s1], call_fn=lambda url, **kw: kept.append(url)) == 0
assert kept == []

# A leftover library is deleted only once every path it holds is safe to lose.
CANON = {
    "Name": "Movies",
    "CollectionType": "movies",
    "Locations": ["/symlinks/radarr", "/media/movies"],
    "LibraryOptions": {"PathInfos": []},
}


def plan(paths, mode="both", canon=CANON):
    extra = {"Name": "Dupe", "CollectionType": "movies", "Locations": list(paths), "LibraryOptions": {}}
    return g["plan_extra_library_drop"](extra, "Movies", canon, {"storageMode": mode})


# the dump path the canonical library already scans is dropped, never re-added
p = plan(["/symlinks/radarr", "/mnt/symlinks/radarr", "/symlinks"])
assert p == {"drop": True, "migrate": [], "blocked": []}, p
# the wizard's own disk root migrates onto Movies first
p = plan(["/symlinks", "/media/movies"], canon={"Name": "Movies", "Locations": ["/symlinks/radarr"]})
assert p["drop"] is True and p["migrate"] == ["/media/movies"], p
# a /media root we cannot hand over blocks the delete on a local/both house
for path in ("/media", "/media/Movies", "/media/films", "/mnt/media/movies"):
    p = plan([path])
    assert p["drop"] is False and p["blocked"] == [path], (path, p)
# debrid-only never writes to /media, so those views may go
for path in ("/media", "/media/films"):
    p = plan([path], mode="debrid")
    assert p == {"drop": True, "migrate": [], "blocked": []}, (path, p)
# never delete an extra before the canonical library exists
p = plan(["/symlinks/radarr"], canon=None)
assert p["drop"] is False, p
# a kept library must not spin libraries_ready for 60s every Apply
blocked_pair = [CANON, {"Name": "Kids", "CollectionType": "movies", "Locations": ["/media/kids"], "LibraryOptions": {}}]
g["answers"] = lambda: {"storageMode": "both"}
assert g["libraries_ready"](blocked_pair, [("Movies", "movies")]) is True
droppable_pair = [CANON, {"Name": "Kids", "CollectionType": "movies", "Locations": ["/symlinks"], "LibraryOptions": {}}]
assert g["libraries_ready"](droppable_pair, [("Movies", "movies")]) is False
posted = []
g["call"] = lambda url, key=None, **kw: posted.append((kw.get("method", "GET"), url))
g["log_wire"] = lambda m: None
assert g["drop_extra_jellyfin_libraries"]("tok", blocked_pair, [("Movies", "movies")]) == 0
assert posted == [], posted
assert g["drop_extra_jellyfin_libraries"]("tok", droppable_pair, [("Movies", "movies")]) == 1
assert [m for m, _u in posted] == ["DELETE"], posted
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
  assert.match(eight, /heal_season_folder_items/);
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
