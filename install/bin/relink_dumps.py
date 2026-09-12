"""Recreate *arr category dumps from FUSE when Apply/wipe left them empty.

House (1.2.50.2): /mnt/symlinks/sonarr empty after wipe → ManualImport 0/0
even when /mnt/debrid/__all__ still had The Walking Dead. Old relink only
filled dump folders that already existed.

Never write into parent /mnt/symlinks. Classify from *arr titles only —
do not guess a pack into sonarr because it has SxxExx (Museum bleed).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

MEDIA_EXT = (".mkv", ".mp4", ".m4v", ".avi", ".ts", ".m2ts")
CATEGORIES = ("sonarr", "radarr")
SKIP_DUMP_NAMES = {"radarr", "sonarr", "anime", "music", "debrid"}
_SEASON_TAIL = re.compile(r"(?:s\d{1,2}(?:e\d{1,3})?|season\d{1,2})$")
_SEASON_IN_STEM = re.compile(r"s\d{1,2}(?:e\d{1,3})?.*$")
_TRACKER_TAG = re.compile(r"^\[+[^\]]+\]+\s*")
_TRACKER_TAG_TAIL = re.compile(r"\s*\[+[^\]]+\]+\s*$")
_QUALITY_SPLIT = re.compile(r"(?:19|20)\d{2}|2160p|1080p|720p|webdl|webrip|bluray|bdremux|remux")
_INDEXER_HOST = re.compile(
    r"(?:uindex|torrenting|torrentcouch|eztvx?|1337x|bitsearch|rarbg|yts|tpb|limetorrents|nyaa)",
    re.I,
)
_TLD = r"org|com|net|to|tv|cc|me|info|xyz"
_WWW_HOST_TLD = re.compile(rf"^(?:www\.)?[a-z0-9.-]+\.(?:{_TLD})\s*[-–—:.]+\s*", re.I)
_WWW_DOT = re.compile(r"^www\.[a-z0-9.-]+\s*[-–—:]+\s*", re.I)
_WWW_SPACED = re.compile(rf"^www[\s._-]+[a-z0-9]+[\s._-]+(?:{_TLD})\b[\s._:-]*", re.I)
_TLD_PREFIX_SPACE = re.compile(rf"^(?:{_TLD})\s*[-–—:]+\s+", re.I)
_TLD_PREFIX_GLUE = re.compile(rf"^(?:{_TLD})[-–—:]+(?=[A-Za-z0-9])", re.I)
_DUMP_SEASON = re.compile(r"(?i)(?:^|[\s._-])s(\d{1,2})(?:[\s._-]*e\d{1,3}|[\s._-]|$)")
_DUMP_SEASON_WORD = re.compile(r"(?i)(?:^|[\s._-])season[\s._-]*(\d{1,2})(?:[\s._-]|$)")
_ROMAN_TAIL = re.compile(r"(?:ii|iii|iv|vi|vii|viii|ix)[a-z][a-z0-9]{1,14}$")
STEM_MIN = 4


def strip_indexer_prefix(raw: str) -> str:
    """www.UIndex.org - The Rookie / org-Silo / [TorrentCouch.com] Show → the show name."""
    s = str(raw or "").strip()
    orig = s
    while True:
        stripped = _TRACKER_TAG.sub("", s).strip()
        if stripped == s:
            break
        s = stripped
    s = _TRACKER_TAG_TAIL.sub("", s).strip()
    if _INDEXER_HOST.search(s):
        s = _WWW_HOST_TLD.sub("", s).strip()
    s = _WWW_DOT.sub("", s).strip()
    s = _WWW_SPACED.sub("", s).strip()
    s = _TLD_PREFIX_SPACE.sub("", s).strip()
    s = _TLD_PREFIX_GLUE.sub("", s).strip()
    s = s.lstrip("-_ ").strip()
    return s or orig


def relink_stem(name: str) -> str:
    """Title stem only — do not match Museum into a Walking Dead dump via 20-char prefix."""
    raw = strip_indexer_prefix(name)
    while True:
        stripped = _TRACKER_TAG.sub("", raw).strip()
        if stripped == raw:
            break
        raw = stripped
    s = re.sub(r"[^a-z0-9]+", "", raw.lower())
    s = _QUALITY_SPLIT.split(s, maxsplit=1)[0]
    s = _SEASON_IN_STEM.sub("", s)
    s = _SEASON_TAIL.sub("", s)
    s = _ROMAN_TAIL.sub("", s)
    return s


def dump_season(name: str) -> int | None:
    """S02 / Season 2 from a dump folder. Years are not seasons."""
    s = strip_indexer_prefix(name)
    if re.search(r"(?:19|20)\d{2}", s) and not re.search(r"(?i)s\d{1,2}|season", s):
        return None
    m = _DUMP_SEASON.search(s)
    if m:
        return int(m.group(1))
    m = _DUMP_SEASON_WORD.search(s)
    if m:
        return int(m.group(1))
    return None


def title_stems(titles: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in titles:
        stem = relink_stem(raw)
        if len(stem) < STEM_MIN or stem in seen:
            continue
        seen.add(stem)
        out.append(stem)
    return out


def stems_equal(a: str, b: str) -> bool:
    return bool(a) and a == b and len(a) >= STEM_MIN


def classify_pack(pack_name: str, wanted: dict | None) -> str | None:
    """Map a FUSE pack onto sonarr or radarr using *arr title stems. Ambiguous → None."""
    stem = relink_stem(pack_name)
    if len(stem) < STEM_MIN:
        return None
    wanted = wanted or {}
    sonarr = [s for s in (wanted.get("sonarr") or []) if stems_equal(s, stem)]
    radarr = [s for s in (wanted.get("radarr") or []) if stems_equal(s, stem)]
    if sonarr and radarr:
        return None
    if sonarr:
        return "sonarr"
    if radarr:
        return "radarr"
    return None


def dump_has_media(dump: Path) -> bool:
    """True when a dump already has a playable file. One-level only — never FUSE dfs."""
    try:
        for x in dump.iterdir():
            if x.is_file() or x.is_symlink():
                return True
    except OSError:
        return False
    return False


def fill_dump_from_pack(dump: Path, pack: Path) -> int:
    """Symlink pack children into an existing category dump folder.

    Decypharr FUSE sometimes exposes a single file at __all__/Name.mkv
    instead of a directory. Still create the category dump.
    """
    n = 0
    try:
        dump.mkdir(parents=True, exist_ok=True)
        if pack.is_file():
            dest = dump / pack.name
            if dest.exists():
                return 0
            os.symlink(pack, dest)
            return 1
        kids = list(pack.iterdir())
    except OSError:
        return 0
    for src in kids:
        dest = dump / src.name
        if dest.exists():
            continue
        try:
            os.symlink(src, dest)
            n += 1
        except OSError:
            continue
    return n


def _existing_dumps(dump_root: Path) -> list[Path]:
    if not dump_root.is_dir():
        return []
    try:
        kids = list(dump_root.iterdir())
    except OSError:
        return []
    out = []
    for dump in kids:
        if not dump.is_dir() or dump.name.lower() in SKIP_DUMP_NAMES:
            continue
        out.append(dump)
    return out


def fuse_catalog(all_root: Path) -> dict[str, Path]:
    catalog: dict[str, Path] = {}
    if not all_root.is_dir():
        return catalog
    try:
        for p in all_root.iterdir():
            catalog[p.name.lower()] = p
    except OSError:
        return {}
    return catalog


def best_pack_for_stem(stem: str, catalog: dict[str, Path], prefer_name: str = "") -> Path | None:
    """Pick one FUSE pack for a title stem. Prefer the *arr folder name over tracker dumps."""
    if len(stem) < STEM_MIN:
        return None
    hits = [p for name, p in catalog.items() if stems_equal(relink_stem(name), stem)]
    if not hits:
        return None
    prefer = (prefer_name or "").lower()
    if prefer:
        exact = [p for p in hits if p.name.lower() == prefer]
        if exact:
            return exact[0]
    hits.sort(key=lambda p: (len(p.name), p.name.lower()))
    return hits[0]


def best_pack_for_title(title: str, catalog: dict[str, Path]) -> Path | None:
    return best_pack_for_stem(relink_stem(title), catalog, prefer_name=title)


def match_catalog(dump_name: str, catalog: dict[str, Path]) -> Path | None:
    key = dump_name.lower()
    hit = catalog.get(key)
    if hit:
        return hit
    want = relink_stem(key)
    return best_pack_for_stem(want, catalog, prefer_name=dump_name)


def decide_missing_action(
    *,
    has_files: bool,
    dump_has_media: bool,
    has_catalog_hit: bool,
    has_torrent: bool,
    torrent_complete: bool,
) -> str:
    """ignore | import | relink | wait | search — used by stuck-downloads for 0-file seasons."""
    if has_files:
        return "ignore"
    if dump_has_media:
        return "import"
    if has_catalog_hit or (has_torrent and torrent_complete):
        return "relink"
    if has_torrent and not torrent_complete:
        return "wait"
    return "search"


def relink_dumps(
    *,
    all_root: Path,
    symlink_root: Path,
    wanted: dict | None = None,
    log=None,
) -> int:
    """Fill empty category dumps and create missing ones from FUSE + *arr titles.

    Only writes under symlink_root/sonarr and symlink_root/radarr.
    """
    def note(msg: str) -> None:
        if log:
            log(msg)

    catalog = fuse_catalog(all_root)
    if not catalog:
        note("relink skip — no __all__")
        return 0

    n = 0
    wanted = wanted or {"sonarr": [], "radarr": []}
    for cat in CATEGORIES:
        dump_root = symlink_root / cat
        try:
            dump_root.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            note(f"relink mkdir {dump_root} {e}")
            continue
        for dump in _existing_dumps(dump_root):
            if dump_has_media(dump):
                continue
            hit = match_catalog(dump.name, catalog)
            if not hit:
                continue
            added = fill_dump_from_pack(dump, hit)
            n += added
            if added:
                note(f"relink {cat}/{dump.name} <- {hit.name}")

    claimed = set()
    for cat in CATEGORIES:
        for dump in _existing_dumps(symlink_root / cat):
            claimed.add(dump.name.lower())

    filled_stems: set[str] = set()
    for cat in CATEGORIES:
        for dump in _existing_dumps(symlink_root / cat):
            if dump_has_media(dump):
                filled_stems.add(relink_stem(dump.name))
        for title in wanted.get(f"{cat}_titles") or []:
            stem = relink_stem(title)
            if stem in filled_stems:
                continue
            pack = best_pack_for_title(title, catalog)
            if not pack:
                continue
            dest = symlink_root / cat / title
            if dest.exists() and dump_has_media(dest):
                filled_stems.add(stem)
                claimed.add(dest.name.lower())
                continue
            added = fill_dump_from_pack(dest, pack)
            n += added
            if added:
                filled_stems.add(stem)
                claimed.add(dest.name.lower())
                claimed.add(pack.name.lower())
                note(f"relink created {cat}/{dest.name} from FUSE")

    for pack in catalog.values():
        if pack.name.lower() in claimed:
            continue
        stem = relink_stem(pack.name)
        if stem in filled_stems:
            continue
        cat = classify_pack(pack.name, wanted)
        if not cat:
            continue
        dest = symlink_root / cat / pack.name
        if dest.exists() and dump_has_media(dest):
            continue
        added = fill_dump_from_pack(dest, pack)
        n += added
        if added:
            claimed.add(pack.name.lower())
            note(f"relink created {cat}/{pack.name} from FUSE")
    note(f"relink {n} links")
    return n


def _unique_titles(rows, key: str = "title") -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get(key) or "").strip()
        if not name:
            continue
        folded = name.lower()
        if folded in seen:
            continue
        seen.add(folded)
        out.append(name)
    return out


def wanted_from_arr_rows(series=None, movies=None, sonarr_queue=None, radarr_queue=None) -> dict:
    """Build wanted stems from *arr series/movies/queue rows (no HTTP)."""
    sonarr: list[str] = []
    radarr: list[str] = []
    for row in series or []:
        if not isinstance(row, dict):
            continue
        sonarr.append(str(row.get("title") or ""))
        sonarr.append(str(row.get("sortTitle") or ""))
    for row in sonarr_queue or []:
        if not isinstance(row, dict):
            continue
        sonarr.append(str(row.get("title") or ""))
        series = row.get("series") if isinstance(row.get("series"), dict) else {}
        sonarr.append(str(series.get("title") or ""))
    for row in movies or []:
        if not isinstance(row, dict):
            continue
        radarr.append(str(row.get("title") or ""))
        radarr.append(str(row.get("sortTitle") or ""))
    for row in radarr_queue or []:
        if not isinstance(row, dict):
            continue
        radarr.append(str(row.get("title") or ""))
        movie = row.get("movie") if isinstance(row.get("movie"), dict) else {}
        radarr.append(str(movie.get("title") or ""))
    return {
        "sonarr": title_stems(sonarr),
        "radarr": title_stems(radarr),
        "sonarr_titles": _unique_titles(series),
        "radarr_titles": _unique_titles(movies),
    }


def _self_test() -> int:
    import tempfile
    import unittest

    class Relink(unittest.TestCase):
        def test_stem_strips_scene_and_season(self):
            self.assertEqual(relink_stem("The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1"), "thewalkingdead")
            self.assertEqual(relink_stem("The Walking Dead"), "thewalkingdead")
            self.assertEqual(relink_stem("The.Walking.Dead.S01.2160p"), "thewalkingdead")
            self.assertEqual(relink_stem("Night at the Museum"), "nightatthemuseum")
            self.assertEqual(relink_stem("Night.at.the.Museum.2006.2160p.WEB-DL"), "nightatthemuseum")
            self.assertEqual(
                relink_stem("[Bitsearch.to] Justified.S01.1080p.BluRay.REMUX.AVC.DTS-HD.MA.5.1-NOGRP[rartv]"),
                "justified",
            )
            self.assertEqual(relink_stem("Justified.S01.BDRemux.1080p.TeamHD"), "justified")
            self.assertEqual(relink_stem("Justified"), "justified")
            self.assertNotEqual(relink_stem("Justified.City.Primeval.S01E01.2160p"), "justified")

        def test_indexer_prefix_maps_to_named_title(self):
            self.assertEqual(strip_indexer_prefix("www.UIndex.org - The Rookie"), "The Rookie")
            self.assertEqual(strip_indexer_prefix("www.UIndex.org    -    The.Rookie.S02E14"), "The.Rookie.S02E14")
            self.assertEqual(strip_indexer_prefix("www Torrenting com - Silo"), "Silo")
            self.assertEqual(strip_indexer_prefix("org-Silo"), "Silo")
            self.assertEqual(relink_stem("www.UIndex.org - The.Rookie.S02E14.Casualties.1080p"), "therookie")
            self.assertEqual(relink_stem("www Torrenting com - Silo"), "silo")
            self.assertEqual(relink_stem("www.Torrenting.com - Silo S02E03 Solo"), "silo")
            self.assertEqual(relink_stem("Reacher II Ponte"), "reacher")
            self.assertTrue(stems_equal(relink_stem("The Rookie"), relink_stem("www.UIndex.org - The.Rookie.S02")))
            self.assertTrue(stems_equal(relink_stem("Silo"), relink_stem("org-Silo")))
            self.assertEqual(dump_season("www.UIndex.org - The.Rookie.S02E14"), 2)
            self.assertEqual(dump_season("The Rookie S01"), 1)
            self.assertIsNone(dump_season("The Rookie"))
            self.assertIsNone(dump_season("Night.at.the.Museum.2006.2160p"))


        def test_classify_uses_wanted_only(self):
            wanted = wanted_from_arr_rows(
                series=[{"title": "The Walking Dead"}],
                movies=[{"title": "Night at the Museum"}],
            )
            self.assertEqual(
                classify_pack("The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1", wanted),
                "sonarr",
            )
            self.assertEqual(
                classify_pack("Night.at.the.Museum.2006.2160p.WEB-DL.DDP5.1", wanted),
                "radarr",
            )
            self.assertIsNone(classify_pack("Some.Other.Show.S01.2160p", wanted))

        def test_empty_wanted_does_not_guess_tv_from_sxxexx(self):
            self.assertIsNone(
                classify_pack("The.Walking.Dead.S01.E01.2160p", {"sonarr": [], "radarr": []})
            )

        def test_ambiguous_stem_is_skipped(self):
            wanted = {"sonarr": ["thewalkingdead"], "radarr": ["thewalkingdead"]}
            self.assertIsNone(classify_pack("The.Walking.Dead.2010.2160p", wanted))

        def test_recreate_sonarr_dump_from_fuse_when_empty(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                pack = root / "all" / "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1"
                pack.mkdir(parents=True)
                (pack / "The.Walking.Dead.S01.E01.mkv").write_bytes(b"x")
                (pack / "The.Walking.Dead.S01.E02.mkv").write_bytes(b"x")
                museum = root / "all" / "Night.at.the.Museum.2006.2160p.WEB-DL"
                museum.mkdir()
                (museum / "Museum.mkv").write_bytes(b"x")
                dumps = root / "symlinks"
                (dumps / "sonarr").mkdir(parents=True)
                (dumps / "radarr").mkdir()
                notes: list[str] = []
                n = relink_dumps(
                    all_root=root / "all",
                    symlink_root=dumps,
                    wanted=wanted_from_arr_rows(series=[{"title": "The Walking Dead"}]),
                    log=notes.append,
                )
                dest = dumps / "sonarr" / "The Walking Dead"
                self.assertGreater(n, 0)
                self.assertTrue((dest / "The.Walking.Dead.S01.E01.mkv").is_symlink())
                self.assertFalse((dumps / "sonarr" / pack.name).exists())
                self.assertFalse((dumps / "radarr" / museum.name).exists())
                self.assertFalse((dumps / "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1").exists())
                self.assertTrue(any("relink created sonarr/The Walking Dead" in x for x in notes))

        def test_existing_empty_dump_still_fills_without_wanted(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                pack = root / "all" / "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1"
                pack.mkdir(parents=True)
                (pack / "E01.mkv").write_bytes(b"x")
                dump = root / "symlinks" / "sonarr" / pack.name
                dump.mkdir(parents=True)
                n = relink_dumps(
                    all_root=root / "all",
                    symlink_root=root / "symlinks",
                    wanted={"sonarr": [], "radarr": []},
                )
                self.assertEqual(n, 1)
                self.assertTrue((dump / "E01.mkv").is_symlink())

        def test_never_writes_parent_symlinks(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                pack = root / "all" / "The.Walking.Dead.2010.2160p.WEB-DL"
                pack.mkdir(parents=True)
                (pack / "E01.mkv").write_bytes(b"x")
                dumps = root / "symlinks"
                dumps.mkdir()
                relink_dumps(
                    all_root=root / "all",
                    symlink_root=dumps,
                    wanted=wanted_from_arr_rows(series=[{"title": "The Walking Dead"}]),
                )
                kids = {p.name for p in dumps.iterdir()}
                self.assertEqual(kids, {"sonarr", "radarr"})
                self.assertTrue((dumps / "sonarr" / "The Walking Dead" / "E01.mkv").is_symlink())

        def test_queue_title_is_enough_wanted(self):
            wanted = wanted_from_arr_rows(
                sonarr_queue=[{"title": "The.Walking.Dead.S01.2160p.WEB-DL", "series": {"title": "The Walking Dead"}}]
            )
            self.assertIn("thewalkingdead", wanted["sonarr"])
            self.assertEqual(classify_pack("The.Walking.Dead.2010.2160p", wanted), "sonarr")

        def test_tracker_prefix_pack_lands_in_series_folder(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                tagged = root / "all" / "[Bitsearch.to] Justified.S01.1080p.BluRay.REMUX[rartv]"
                tagged.mkdir(parents=True)
                (tagged / "Justified.S01E01.mkv").write_bytes(b"x")
                remux = root / "all" / "Justified.S01.BDRemux.1080p.TeamHD"
                remux.mkdir()
                (remux / "Justified.s01e02.mkv").write_bytes(b"x")
                named = root / "all" / "Justified"
                named.mkdir()
                (named / "Justified.S01E01.1080p.mkv").write_bytes(b"x")
                primeval = root / "all" / "Justified.City.Primeval.S01E01.2160p"
                primeval.mkdir()
                (primeval / "E01.mkv").write_bytes(b"x")
                dumps = root / "symlinks"
                (dumps / "sonarr").mkdir(parents=True)
                (dumps / "radarr").mkdir()
                n = relink_dumps(
                    all_root=root / "all",
                    symlink_root=dumps,
                    wanted=wanted_from_arr_rows(series=[{"title": "Justified"}]),
                )
                dest = dumps / "sonarr" / "Justified"
                self.assertGreater(n, 0)
                self.assertTrue((dest / "Justified.S01E01.1080p.mkv").is_symlink())
                self.assertFalse((dumps / "sonarr" / tagged.name).exists())
                self.assertFalse((dumps / "sonarr" / remux.name).exists())
                self.assertFalse((dumps / "sonarr" / primeval.name).exists())

        def test_does_not_create_title_dump_when_year_dump_already_has_media(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                pack = root / "all" / "Interstellar"
                pack.mkdir(parents=True)
                (pack / "Interstellar.mkv").write_bytes(b"x")
                dumps = root / "symlinks"
                existing = dumps / "radarr" / "Interstellar (2014)"
                existing.mkdir(parents=True)
                os.symlink(pack / "Interstellar.mkv", existing / "Interstellar.mkv")
                (dumps / "sonarr").mkdir(parents=True)
                n = relink_dumps(
                    all_root=root / "all",
                    symlink_root=dumps,
                    wanted=wanted_from_arr_rows(movies=[{"title": "Interstellar"}]),
                )
                self.assertEqual(n, 0)
                self.assertFalse((dumps / "radarr" / "Interstellar").exists())

        def test_file_pack_still_fills_dump(self):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                pack = root / "all" / "Interstellar.2014.2160p.mkv"
                pack.parent.mkdir(parents=True)
                pack.write_bytes(b"x")
                dump = root / "symlinks" / "radarr" / "Interstellar"
                n = fill_dump_from_pack(dump, pack)
                self.assertEqual(n, 1)
                self.assertTrue((dump / pack.name).is_symlink())

        def test_dump_has_media_does_not_walk_fuse_dfs(self):
            src = Path(__file__).read_text()
            fn = src[src.find("def dump_has_media") : src.find("def fill_dump_from_pack")]
            self.assertIn("iterdir", fn)
            self.assertNotIn("rglob", fn)
            self.assertNotIn("os.walk", fn)
            with tempfile.TemporaryDirectory() as tmp:
                dump = Path(tmp) / "show"
                dump.mkdir()
                self.assertFalse(dump_has_media(dump))
                nested = dump / "S01"
                nested.mkdir()
                (nested / "E02.mkv").write_bytes(b"x")
                self.assertFalse(dump_has_media(dump))
                (dump / "E01.mkv").write_bytes(b"x")
                self.assertTrue(dump_has_media(dump))

        def test_decide_missing_empty_symlink_relinks_then_searches(self):
            self.assertEqual(
                decide_missing_action(
                    has_files=True, dump_has_media=False, has_catalog_hit=False, has_torrent=False, torrent_complete=False
                ),
                "ignore",
            )
            self.assertEqual(
                decide_missing_action(
                    has_files=False, dump_has_media=True, has_catalog_hit=False, has_torrent=False, torrent_complete=False
                ),
                "import",
            )
            self.assertEqual(
                decide_missing_action(
                    has_files=False, dump_has_media=False, has_catalog_hit=True, has_torrent=False, torrent_complete=False
                ),
                "relink",
            )
            self.assertEqual(
                decide_missing_action(
                    has_files=False, dump_has_media=False, has_catalog_hit=False, has_torrent=True, torrent_complete=True
                ),
                "relink",
            )
            self.assertEqual(
                decide_missing_action(
                    has_files=False, dump_has_media=False, has_catalog_hit=False, has_torrent=True, torrent_complete=False
                ),
                "wait",
            )
            self.assertEqual(
                decide_missing_action(
                    has_files=False, dump_has_media=False, has_catalog_hit=False, has_torrent=False, torrent_complete=False
                ),
                "search",
            )

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Relink)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("relink_dumps.py is imported by wire-engines")
