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
    assert.match(code, /MediaBrowser Client="ReelOS".*DeviceId="reelos"/);
    assert.match(code, /def jellyfin_headers/);
    assert.match(code, /Token=/);
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
    assert.match(code, /collapse_movie_named_dumps/);
    assert.match(code, /movie_dump_keys/);
    assert.match(code, /heal_movie_dump_items/);
    assert.match(code, /heal_merge_movie_versions/);
    assert.match(code, /heal_merge_movie_posters/);
    assert.match(code, /label_jellyfin_movie_versions/);
    assert.match(code, /park_extra_movie_files/);
    assert.match(code, /movie_files_same_resolution/);
    assert.match(code, /heal_hybrid_1080_companions/);
    assert.match(code, /restore_hybrid_movie_versions/);
    assert.match(code, /ensure_hybrid_recycle_bin/);
    assert.match(code, /movie_dump_merge_key/);
    assert.match(code, /merge-movies/);
    assert.match(code, /Videos\/MergeVersions/);
    assert.match(code, /plan_movie_dump_item/);
    assert.match(code, /heal_season_folder_items/);
    assert.match(code, /plan_season_folder_item/);
    assert.match(code, /season_folder_item_path/);
    assert.match(code, /heal_after_import/);
    assert.match(code, /collapse_dumps=False/);
    assert.match(code, /import collapse season-folder dumps before jellyfin refresh/);
    assert.match(code, /extra_jellyfin_libraries/);
    assert.match(code, /wizard_completed/);
    assert.match(code, /Startup\/Configuration/);
    assert.match(code, /def jellyfin_debrid_library_flags/);
    assert.match(code, /def jellyfin_encoding_for_box/);
    assert.match(code, /EncodingThreadCount/);
    assert.match(code, /def jellyfin_task_hammers_debrid/);
    assert.match(code, /EnableSubtitleExtraction/);
    assert.match(code, /AllowEmbeddedSubtitles/);
    assert.match(code, /TaskExtractMediaSegments/);
    assert.match(code, /\*\*jellyfin_debrid_library_flags\(\)/);
    assert.doesNotMatch(code, /EnableTrickplayImageExtraction": not low/);
  }
});

test("Jellyfin debrid-safe flags never extract trickplay, chapters, or subtitles from dumps", () => {
  const code = joinParts(join(root, "daemon/wire-engines.parts"));
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
import sys
g = {"__name__": "wire_engines"}
exec(compile(sys.stdin.read(), "wire-engines.py", "exec"), g)
flags = g["jellyfin_debrid_library_flags"]()
assert flags["EnableTrickplayImageExtraction"] is False
assert flags["ExtractTrickplayImagesDuringLibraryScan"] is False
assert flags["EnableChapterImageExtraction"] is False
assert flags["ExtractChapterImagesDuringLibraryScan"] is False
assert flags["SaveTrickplayWithMedia"] is False
assert flags["AllowEmbeddedSubtitles"] == "AllowText"
enc = g["jellyfin_debrid_encoding_patch"]({
    "EnableSubtitleExtraction": True,
    "AllowOnDemandMetadataBasedKeyframeExtractionForExtensions": ["mkv"],
    "VaapiDevice": "/dev/dri/renderD128",
})
assert enc["EnableSubtitleExtraction"] is False
assert enc["AllowOnDemandMetadataBasedKeyframeExtractionForExtensions"] == []
assert enc["VaapiDevice"] == "/dev/dri/renderD128"
hammers = g["jellyfin_task_hammers_debrid"]
assert hammers({"Key": "TaskExtractMediaSegments", "Name": "Media Segment Scan"}) is True
assert hammers({"Key": "RefreshTrickplayImages", "Name": "Generate Trickplay Images"}) is True
assert hammers({"Key": "DownloadSubtitles", "Name": "Download missing subtitles"}) is False
assert hammers({"Key": "RefreshLibrary", "Name": "Scan Media Library"}) is False
low = g["jellyfin_encoding_for_box"](
    {
        "HardwareAccelerationType": "none",
        "EncodingThreadCount": -1,
        "EnableThrottling": False,
        "EnableSegmentDeletion": False,
        "HardwareDecodingCodecs": ["h264", "vc1"],
        "EnableSubtitleExtraction": True,
        "VaapiDevice": "/dev/dri/renderD128",
    },
    low=True,
    has_dri=True,
)
assert low["HardwareAccelerationType"] == "vaapi"
assert low["EncodingThreadCount"] == 1
assert low["EnableThrottling"] is True
assert low["EnableSegmentDeletion"] is True
assert low["SegmentKeepSeconds"] == 60
assert low["EncoderPreset"] == "veryfast"
assert low["EnableSubtitleExtraction"] is False
assert "hevc" in low["HardwareDecodingCodecs"]
off = g["jellyfin_encoding_for_box"](low, low=False, has_dri=True)
assert off["EncodingThreadCount"] == -1
assert off["HardwareAccelerationType"] == "vaapi"
assert off["EnableSubtitleExtraction"] is False
nodri = g["jellyfin_encoding_for_box"]({"HardwareAccelerationType": "none"}, low=True, has_dri=False)
assert nodri["HardwareAccelerationType"] == "none"
assert nodri["EncodingThreadCount"] == 1
`,
    ],
    { input: code, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(read("src/components/settings-panels.tsx"), /does not read TorBox dumps/);
  assert.match(read("src/components/settings-panels.tsx"), /one thread/);
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
assert g["strip_season_folder_suffix"](
    "Brooklyn Nine-Nine (2013) Season 1 S01 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 5.1 RZeroX)"
) == "Brooklyn Nine-Nine"
assert g["looks_like_season_folder_title"](
    "Brooklyn Nine-Nine (2013) Season 1 S01 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 5.1 RZeroX)"
) is True
assert g["looks_like_season_folder_title"]("The Walking Dead - Season 1") is True
assert g["looks_like_season_folder_title"]("The Walking Dead") is False
assert g["looks_like_season_folder_title"]("Show S01E01") is False
assert g["strip_season_folder_suffix"](
    "The.Expanse.S01.2160p.AMZN.WEB-DL.x265.10bit.HDR.DTS-HD.MA.5.1-SAFETY[rartv]"
) == "The.Expanse"
assert g["strip_season_folder_suffix"](
    "Brooklyn Nine-Nine S01 Season 1 1080p 5.1Ch Web-DL ReEnc-DeeJayAhmed"
) == "Brooklyn Nine-Nine"
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
# Live box: quality after S01, series folder has no year, Season 1 already has the files.
live_tv = Path(td) / "sonarr-live"
live_tv.mkdir()
(live_tv / "Brooklyn Nine-Nine").mkdir()
s01 = live_tv / "Brooklyn Nine-Nine" / "Season 1"
s01.mkdir()
(s01 / "Brooklyn Nine-Nine (2013) - S01E01 - Pilot (1080p AMZN WEB-DL x265 RZeroX).mkv").write_bytes(b"e")
pack = live_tv / "Brooklyn Nine-Nine (2013) Season 1 S01 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 5.1 RZeroX)"
pack.mkdir()
(pack / "Brooklyn Nine-Nine (2013) - S01E01 - Pilot (1080p AMZN WEB-DL x265 RZeroX).mkv").write_bytes(b"e")
assert g["collapse_season_named_dumps"](str(live_tv), allow=[str(live_tv)]) == 1
assert (live_tv / "Brooklyn Nine-Nine" / "Season 1").is_dir()
assert not pack.exists()
# do not duplicate the episode next to Season 1
assert not (live_tv / "Brooklyn Nine-Nine" / "Brooklyn Nine-Nine (2013) - S01E01 - Pilot (1080p AMZN WEB-DL x265 RZeroX).mkv").exists()
# House: dotted S01.2160p pack next to The Expanse, and S01 Season 1 1080p without parens.
(live_tv / "The Expanse").mkdir()
(live_tv / "The Expanse" / "keep.mkv").write_bytes(b"k")
exp = live_tv / "The.Expanse.S01.2160p.AMZN.WEB-DL.x265.10bit.HDR.DTS-HD.MA.5.1-SAFETY[rartv]"
exp.mkdir()
(exp / "E01.mkv").write_bytes(b"e")
dj = live_tv / "Brooklyn Nine-Nine S01 Season 1 1080p 5.1Ch Web-DL ReEnc-DeeJayAhmed"
dj.mkdir()
(dj / "other.mkv").write_bytes(b"o")
assert g["collapse_season_named_dumps"](str(live_tv), allow=[str(live_tv)]) == 2
assert not exp.exists()
assert not dj.exists()
assert (live_tv / "The Expanse" / "E01.mkv").is_file()
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
# JF named the dump after metadata; Path is still the S01 pack.
exp_canon = {
    "Id": "jf-exp",
    "Name": "The Expanse",
    "Path": "/symlinks/sonarr/The Expanse",
    "ProviderIds": {"Tvdb": "280619"},
}
exp_dump = {
    "Id": "jf-exp-s01",
    "Name": "The Expanse",
    "Path": "/symlinks/sonarr/The.Expanse.S01.2160p.AMZN.WEB-DL.x265",
    "ProviderIds": {},
}
assert g["plan_season_folder_item"](exp_dump, [exp_canon, exp_dump])["action"] == "delete"
assert g["plan_season_folder_item"](exp_canon, [exp_canon, exp_dump]) is None
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

# Movie release dumps collapse into Title (Year) — Interstellar×3 / John Wick×2.
assert g["is_canonical_movie_folder"]("Interstellar (2014)") is True
assert g["is_canonical_movie_folder"]("Interstellar (2014) [2160p] [YTS.MX]") is False
assert g["movie_dump_key"]("Interstellar (2014)") == g["movie_dump_key"](
    "Interstellar.2014.2160p.PROPER.IMAX.REMUX.mkv"
)
assert g["movie_dump_key"]("John Wick (2014)") == g["movie_dump_key"](
    "John Wick.2014.2160p.UHD.BluRay.HDR.DoVi.TrueHD 7.1.Atmos.x265-SPHD[TGx]"
)
assert g["movie_dump_key"]("Night at the Museum (2006)") == g["movie_dump_key"](
    "Night at the Museum 2006. 2160P.AI Upscaled.BluRay.60FPS.H265"
)
assert g["movie_dump_key"]("Dune (1984)") != g["movie_dump_key"]("Dune (2021)")
assert g["movie_dump_key"]("Dune.2021.2160p.BluRay") != g["movie_dump_key"]("Dune (1984)")
assert "dune:2021" in g["movie_dump_keys"]("Dune Part One (2021) [2160p]")
assert "dune:2021" in g["movie_dump_keys"]("Dune: Part One (2021)")
assert "dune:2021" not in g["movie_dump_keys"]("Dune Part Two (2024)")
assert g["movie_dump_key"]("Dune (2021)") in g["movie_dump_keys"]("Dune Part One (2021) [2160p]")
assert g["looks_like_movie_dump_folder"]("Interstellar.2014.2160p.REMUX") is True
assert g["looks_like_movie_dump_folder"]("Interstellar (2014)") is False
assert g["movie_dump_item_path"]("/symlinks/radarr/Interstellar.2014.2160p.YTS") is True
assert g["movie_dump_item_path"]("/mnt/symlinks/radarr/Interstellar (2014) [YTS.MX]") is True
assert g["movie_dump_item_path"]("/symlinks/radarr/Interstellar (2014)") is False
assert g["movie_dump_item_path"]("/media/movies/Interstellar.2014.2160p") is False
assert g["movie_dump_item_path"]("/symlinks/radarr") is False
radarr = Path(td) / "radarr"
radarr.mkdir()
(radarr / "Interstellar (2014)").mkdir()
(radarr / "Interstellar (2014)" / "keep.mkv").write_bytes(b"k")
(radarr / "Interstellar (2014) [2160p] [4K] [BluRay] [5.1] [YTS.MX]").mkdir()
(radarr / "Interstellar (2014) [2160p] [4K] [BluRay] [5.1] [YTS.MX]" / "yts.mkv").write_bytes(b"y")
(radarr / "Interstellar.2014.2160p.PROPER.IMAX.REMUX.mkv").mkdir()
(radarr / "Interstellar.2014.2160p.PROPER.IMAX.REMUX.mkv" / "remux.mkv").write_bytes(b"r")
(radarr / "John Wick (2014)").mkdir()
(radarr / "John Wick (2014)" / "jw.mkv").write_bytes(b"j")
(radarr / "John Wick.2014.2160p.UHD.BluRay").mkdir()
(radarr / "John Wick.2014.2160p.UHD.BluRay" / "uhd.mkv").write_bytes(b"u")
(radarr / "Dune (1984)").mkdir()
(radarr / "Dune (2021)").mkdir()
(radarr / "Dune.2021.2160p.BluRay").mkdir()
(radarr / "Dune.2021.2160p.BluRay" / "dune.mkv").write_bytes(b"d")
# refuse /media and anything that is not the radarr dump root
media_movies = Path(td) / "media" / "movies"
media_movies.mkdir(parents=True)
(media_movies / "Interstellar (2014)").mkdir()
(media_movies / "Interstellar.2014.2160p").mkdir()
assert g["collapse_movie_named_dumps"](str(media_movies), allow=[str(media_movies)]) == 0
assert (media_movies / "Interstellar.2014.2160p").is_dir()
assert g["collapse_movie_named_dumps"](str(radarr)) == 0
n = g["collapse_movie_named_dumps"](str(radarr), allow=[str(radarr)])
assert n == 4, n
assert (radarr / "Interstellar (2014)").is_dir()
assert not (radarr / "Interstellar (2014) [2160p] [4K] [BluRay] [5.1] [YTS.MX]").exists()
assert not (radarr / "Interstellar.2014.2160p.PROPER.IMAX.REMUX.mkv").exists()
assert (radarr / "Interstellar (2014)" / "keep.mkv").is_file()
assert (radarr / "Interstellar (2014)" / "yts.mkv").is_file()
assert (radarr / "Interstellar (2014)" / "remux.mkv").is_file()
assert (radarr / "John Wick (2014)" / "uhd.mkv").is_file()
assert not (radarr / "John Wick.2014.2160p.UHD.BluRay").exists()
assert (radarr / "Dune (1984)").is_dir()
assert (radarr / "Dune (2021)" / "dune.mkv").is_file()
assert not (radarr / "Dune.2021.2160p.BluRay").exists()
# Live box: Dune Part One [2160p] next to Dune (2021); remakes stay split.
(radarr / "Dune Part One (2021) [2160p]").mkdir()
(radarr / "Dune Part One (2021) [2160p]" / "yts-partone.mkv").write_bytes(b"p")
(radarr / "Dune Part Two (2024)").mkdir()
(radarr / "Dune Part Two (2024)" / "two.mkv").write_bytes(b"t")
n = g["collapse_movie_named_dumps"](str(radarr), allow=[str(radarr)])
assert n >= 1, n
assert (radarr / "Dune (2021)" / "yts-partone.mkv").is_file()
assert not (radarr / "Dune Part One (2021) [2160p]").exists()
assert (radarr / "Dune Part Two (2024)" / "two.mkv").is_file()
assert (radarr / "Dune (1984)").is_dir()
# Hybrid keeps 1080p + 4K as Jellyfin versions, not two posters.
for p in (radarr / "Interstellar (2014)").glob("*.mkv"):
    p.write_bytes(p.name.encode())
(radarr / "Interstellar (2014)" / "yts.1080p.mkv").write_bytes(b"y" * 50)
(radarr / "Interstellar (2014)" / "remux.2160p.mkv").write_bytes(b"R" * 200)
assert g["movie_version_label"]("yts.1080p.mkv") == "1080p"
assert g["movie_version_label"]("remux.2160p.mkv") == "2160p remux"
g["park_extra_movie_files"](str(radarr), allow=[str(radarr)])
assert (radarr / "Interstellar (2014)" / "yts.1080p.mkv").is_file()
assert (radarr / "Interstellar (2014)" / "remux.2160p.mkv").is_file()
nlab = g["label_jellyfin_movie_versions"](str(radarr), allow=[str(radarr)])
assert nlab >= 2, nlab
names = sorted(p.name for p in (radarr / "Interstellar (2014)").glob("*.mkv"))
assert "Interstellar (2014) - 1080p.mkv" in names
assert "Interstellar (2014) - 2160p remux.mkv" in names
# Identical clone (same size) still parks. 1080+4K do not.
jw = radarr / "John Wick (2014)"
(jw / "John.Wick.2014.2160p.mkv").write_bytes(b"xx")
(jw / "John.Wick.2014.2160p[TGx].mkv").write_bytes(b"xx")
npark = g["park_extra_movie_files"](str(jw.parent), allow=[str(jw.parent)])
assert npark >= 1, npark
assert (jw / "John.Wick.2014.2160p.mkv").is_file() or any("2160p" in p.name and "[TGx]" not in p.name for p in jw.glob("*.mkv"))
assert not (jw / "John.Wick.2014.2160p[TGx].mkv").exists()
# Extra 4K of a different size parks; 1080 next to 4K does not.
br = radarr / "Blade Runner (1982)"
br.mkdir()
(br / "br.2160p.yts.mkv").write_bytes(b"y" * 50)
(br / "br.2160p.remux.mkv").write_bytes(b"R" * 200)
npark4k = g["park_extra_movie_files"](str(radarr), allow=[str(radarr)])
assert npark4k >= 1, npark4k
assert (br / "br.2160p.remux.mkv").is_file()
assert not (br / "br.2160p.yts.mkv").exists()
assert g["movie_files_same_resolution"](br / "br.2160p.remux.mkv", Path("x.1080p.mkv")) is False
media_movies = Path(td) / "media" / "movies"
(media_movies / "Interstellar (2014)" / "a.mkv").write_bytes(b"a")
(media_movies / "Interstellar (2014)" / "b.mkv").write_bytes(b"bb")
assert g["park_extra_movie_files"](str(media_movies), allow=[str(media_movies)]) == 0
assert g["label_jellyfin_movie_versions"](str(media_movies), allow=[str(media_movies)]) == 0
assert (media_movies / "Interstellar (2014)" / "a.mkv").is_file()
assert (media_movies / "Interstellar (2014)" / "b.mkv").is_file()
# Hybrid: recycled 1080 comes back next to the 4K. Second 4K stays in recycle.
g["answers"] = lambda: {"quality": "hybrid"}
recycle = Path(td) / ".reel-recycle"
recycle.mkdir()
treasure = radarr / "National Treasure (2004)"
treasure.mkdir()
(treasure / "National.Treasure.2004.2160p.mkv").write_bytes(b"U" * 200)
(recycle / "National.Treasure.2004.1080p.BluRay.mkv").write_bytes(b"h" * 40)
(recycle / "Night.At.The.Museum.2006.2160p.mkv").write_bytes(b"k" * 80)
museum = radarr / "Night at the Museum (2006)"
museum.mkdir()
(museum / "Night.At.The.Museum.2006.2160p.REMUX.mkv").write_bytes(b"K" * 200)
nrest = g["restore_hybrid_movie_versions"](str(radarr), str(recycle), allow=[str(radarr), str(recycle)])
assert nrest == 1, nrest
assert (treasure / "National.Treasure.2004.1080p.BluRay.mkv").is_file()
assert not (recycle / "National.Treasure.2004.1080p.BluRay.mkv").exists()
assert (recycle / "Night.At.The.Museum.2006.2160p.mkv").is_file()
g["answers"] = lambda: {"quality": "4k"}
(recycle / "National.Treasure.2004.720p.mkv").write_bytes(b"s" * 10)
assert g["restore_hybrid_movie_versions"](str(radarr), str(recycle), allow=[str(radarr), str(recycle)]) == 0
assert (recycle / "National.Treasure.2004.720p.mkv").is_file()
g["answers"] = lambda: {"quality": "hybrid"}
assert g["restore_hybrid_movie_versions"](str(media_movies), str(recycle), allow=[str(media_movies), str(recycle)]) == 0
puts = []
def fake_mm(url, key=None, method="GET", body=None, headers=None):
    puts.append((method, url, body))
    if "mediamanagement" in str(url) and method != "PUT":
        return {"id": 1, "recycleBin": "", "recycleBinCleanupDays": 7}
    return {}
g["call"] = fake_mm
g["answers"] = lambda: {"quality": "hybrid"}
assert g["ensure_hybrid_recycle_bin"]("k") is True
assert any(
    m == "PUT" and b and b.get("recycleBin") == "/mnt/symlinks/.reel-recycle" and b.get("recycleBinCleanupDays") == 0
    for m, _u, b in puts
), puts
puts.clear()
g["answers"] = lambda: {"quality": "4k"}
assert g["ensure_hybrid_recycle_bin"]("k") is False
assert puts == []
g["answers"] = lambda: {"quality": "hybrid"}
jf_canon = {
    "Id": "jf-int",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar (2014)",
    "ProviderIds": {"Tmdb": "157336"},
}
jf_dump = {
    "Id": "jf-int-yts",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar (2014) [2160p] [YTS.MX]",
    "ProviderIds": {"Tmdb": "157336"},
}
assert g["plan_movie_dump_item"](jf_dump, [jf_canon, jf_dump])["action"] == "delete"
assert g["plan_movie_dump_item"](jf_canon, [jf_canon, jf_dump]) is None
jf_disk = dict(jf_dump, Id="jf-disk", Path="/media/movies/Interstellar.2014.2160p")
assert g["plan_movie_dump_item"](jf_disk, [jf_canon, jf_disk]) is None
jf_only = {
    "Id": "jf-only-dump",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar.2014.2160p.YTS",
    "ProviderIds": {},
}
assert g["plan_movie_dump_item"](jf_only, [jf_only]) is None
movie_healed = []
assert g["heal_movie_dump_items"](
    "tok", items=[jf_canon, jf_dump], call_fn=lambda url, **kw: movie_healed.append((kw.get("method"), url))
) == 1
assert movie_healed[0][0] == "DELETE"
assert "jf-int-yts" in movie_healed[0][1]

# Same Title (Year) folder with two files is versions, not two posters. Never /media.
v1 = {
    "Id": "jf-int-a",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar (2014)/keep.mkv",
}
v2 = {
    "Id": "jf-int-b",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar (2014)/remux.mkv",
}
v_media = {
    "Id": "jf-int-disk",
    "Name": "Interstellar",
    "Path": "/media/movies/Interstellar (2014)/keep.mkv",
}
groups = g["movie_version_merge_groups"]([v1, v2, v_media])
assert len(groups) == 1, groups
assert {x["Id"] for x in groups[0]} == {"jf-int-a", "jf-int-b"}
merged = []
assert g["heal_merge_movie_versions"](
    "tok", items=[v1, v2, v_media], call_fn=lambda url, **kw: merged.append((kw.get("method"), url))
) == 1
assert merged[0][0] == "POST"
assert "MergeVersions" in merged[0][1]
assert "jf-int-a" in merged[0][1] and "jf-int-b" in merged[0][1]
assert "jf-int-disk" not in merged[0][1]

# Same TMDB across a leftover dump folder + Title (Year) is still one poster.
v1t = dict(v1, ProviderIds={"Tmdb": "157336"})
v2t = dict(v2, ProviderIds={"Tmdb": "157336"})
v_yts = {
    "Id": "jf-int-ytsfile",
    "Name": "Interstellar",
    "Path": "/symlinks/radarr/Interstellar (2014) [YTS.MX]/yts.mkv",
    "ProviderIds": {"Tmdb": "157336"},
}
tmdb_groups = g["movie_version_merge_groups"]([v1t, v2t, v_yts, v_media])
assert len(tmdb_groups) == 1, tmdb_groups
assert {x["Id"] for x in tmdb_groups[0]} == {"jf-int-a", "jf-int-b", "jf-int-ytsfile"}
assert g["movie_dump_merge_key"](v_media) == ""

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
  assert.match(hop, /collapse_dumps=False/);
  assert.match(hop, /jellyfin libraries one dump path each/);
  assert.match(hop, /widen_radarr_hybrid/);
  assert.match(hop, /ensure_hybrid_recycle_bin/);
  const one = read("daemon/wire-engines.parts/01.part");
  assert.ok(one.indexOf("relink_from_debrid") < one.lastIndexOf("heal_after_import"));
  assert.ok(one.indexOf("DownloadedMoviesScan") < one.lastIndexOf("return heal_after_import()"));
  assert.match(one, /return heal_after_import\(\)/);
  const eight = read("daemon/wire-engines.parts/08.part");
  assert.match(eight, /jellyfin heal red — no token/);
  assert.match(eight, /delete_jellyfin_library/);
  assert.match(eight, /collapse_season_named_dumps/);
  assert.match(eight, /collapse_movie_named_dumps/);
  assert.match(eight, /heal_movie_dump_items/);
  assert.match(eight, /heal_season_folder_items/);
  assert.match(eight, /drop_extra_jellyfin_libraries/);
  assert.match(eight, /heal_merge_movie_posters/);
  assert.match(eight, /label_jellyfin_movie_versions/);
  assert.match(eight, /park_extra_movie_files/);
  assert.match(eight, /heal_hybrid_1080_companions/);
  assert.match(eight, /restore_hybrid_movie_versions/);
  assert.match(eight, /\.reel-parked/);
  assert.match(eight, /\.reel-recycle/);
  assert.match(eight, /Merge LAST/);
  assert.ok(
    eight.indexOf("jellyfin refresh after post-import heal") < eight.indexOf("Merge LAST"),
    "merge must run after Library/Refresh so a scan cannot split the poster",
  );
  const nine = read("daemon/wire-engines.parts/09.part");
  assert.match(nine, /merge-movies/);
  assert.match(nine, /heal_hybrid_1080_companions/);
  const mergeAt = nine.lastIndexOf('if "merge-movies"');
  assert.ok(nine.indexOf("ensure_hybrid_recycle_bin()", mergeAt) > mergeAt);
  const lock = read("daemon/lock-download-clients.py");
  assert.match(lock, /merge-movies/);
  assert.match(lock, /MERGE_SEC/);
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
  assert.match(src, /function jellyfinAuthedHeaders/);
  assert.match(src, /jellyfinAuthedHeaders\(auth\.token\)/);
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
  assert.match(chunk, /Cannot read virtual folders/);
  assert.match(chunk, /readJellyfinVirtualFolders/);
  const box = src.slice(src.indexOf("function boxSyncSlice"), src.indexOf("async function handleTailscaleLogin"));
  assert.match(box, /scheduleBoxProbe/);
  assert.doesNotMatch(box, /await jellyfinState/);
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
  assert.match(code, /EnableLegacyAuthorization>true/);
  assert.match(code, /seed_jellyfin_legacy_auth/);
  assert.match(code, /startup endpoints not ready/);
  assert.match(code, /apply_jellyfin_published_uri\(token\)/);
  const reset = code.slice(code.indexOf("def reset_jellyfin_config"), code.indexOf("def wait_jellyfin"));
  assert.ok(reset.indexOf("seed_jellyfin_network_xml") < reset.indexOf('compose("up"'));
});
