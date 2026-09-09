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


def relink_stem(name: str) -> str:
    """Title stem only — do not match Museum into a Walking Dead dump via 20-char prefix."""
    s = re.sub(r"[^a-z0-9]+", "", str(name or "").lower())
    s = re.split(r"(?:19|20)\d{2}|2160p|1080p|720p|webdl|webrip|bluray", s, maxsplit=1)[0]
    s = _SEASON_TAIL.sub("", s)
    return s


def title_stems(titles: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in titles:
        stem = relink_stem(raw)
        if len(stem) < 8 or stem in seen:
            continue
        seen.add(stem)
        out.append(stem)
    return out


def stems_equal(a: str, b: str) -> bool:
    return bool(a) and a == b and len(a) >= 8


def classify_pack(pack_name: str, wanted: dict | None) -> str | None:
    """Map a FUSE pack onto sonarr or radarr using *arr title stems. Ambiguous → None."""
    stem = relink_stem(pack_name)
    if len(stem) < 8:
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
    try:
        for x in dump.rglob("*"):
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


def match_catalog(dump_name: str, catalog: dict[str, Path]) -> Path | None:
    key = dump_name.lower()
    hit = catalog.get(key)
    if hit:
        return hit
    want = relink_stem(key)
    if len(want) < 8:
        return None
    hits = [p for name, p in catalog.items() if stems_equal(relink_stem(name), want)]
    return hits[0] if len(hits) == 1 else None


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

    for pack in catalog.values():
        if pack.name.lower() in claimed:
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
    return {"sonarr": title_stems(sonarr), "radarr": title_stems(radarr)}


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
                dest = dumps / "sonarr" / pack.name
                self.assertGreater(n, 0)
                self.assertTrue((dest / "The.Walking.Dead.S01.E01.mkv").is_symlink())
                self.assertFalse((dumps / "radarr" / museum.name).exists())
                self.assertFalse((dumps / "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1").exists())
                self.assertTrue(any("relink created sonarr/" in x for x in notes))

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
                self.assertTrue((dumps / "sonarr" / pack.name / "E01.mkv").is_symlink())

        def test_queue_title_is_enough_wanted(self):
            wanted = wanted_from_arr_rows(
                sonarr_queue=[{"title": "The.Walking.Dead.S01.2160p.WEB-DL", "series": {"title": "The Walking Dead"}}]
            )
            self.assertIn("thewalkingdead", wanted["sonarr"])
            self.assertEqual(classify_pack("The.Walking.Dead.2010.2160p", wanted), "sonarr")

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
