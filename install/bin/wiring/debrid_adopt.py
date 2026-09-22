"""Debrid Cloud Auto-Adoption Engine for ReelOS.

Discovers unmanaged media on cloud Debrid mounts (/mnt/debrid/__all__),
registers missing movies into Radarr via lookup, creates canonical
symlinks under /mnt/symlinks/radarr/, and triggers Jellyfin library refresh.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

MEDIA_EXTS = (".mkv", ".mp4", ".avi", ".m4v", ".ts")
_TV_SEASON_RE = re.compile(r"(?i)(?:^|[\s._-])s(\d{1,2})(?:[\s._-]*e\d{1,3}|[\s._-]|$)")
_TV_SEASON_WORD = re.compile(r"(?i)(?:^|[\s._-])season[\s._-]*(\d{1,2})(?:[\s._-]|$)")
_YEAR_RE = re.compile(r"(?:^|[.\s_(-]+)((?:19|20)\d{2})(?:[.\s_)]+|$)")
_SCENE_TAGS = re.compile(
    r"(?i)[.\s_-]+(?:2160p|1080p|720p|480p|4k|uhd|remux|bluray|blu-ray|bdrip|web-dl|webrip|webdl|"
    r"hevc|x264|x265|h264|h265|dts|aac|ac3|truehd|atmos|hdr|proper|repack|extended|yify|yts|rarbg|"
    r"amzn|nf|dsnp|atvp|max|blackbit|playweb|vyndros|flux|crfw|blackbit).*"
)
_TRACKER_TAG = re.compile(r"^\[+[^\]]+\]+\s*")
_TRACKER_TAG_TAIL = re.compile(r"\s*\[+[^\]]+\]+\s*$")


def strip_tracker_tags(name: str) -> str:
    s = str(name or "").strip()
    while True:
        stripped = _TRACKER_TAG.sub("", s).strip()
        if stripped == s:
            break
        s = stripped
    return _TRACKER_TAG_TAIL.sub("", s).strip()


def parse_debrid_pack(name: str) -> dict | None:
    """Classify a pack name from /mnt/debrid/__all__ as 'tv' or 'movie' with title & year."""
    s = strip_tracker_tags(name)
    if not s or s.startswith("."):
        return None

    # Check for TV indicators
    m_tv = _TV_SEASON_RE.search(s) or _TV_SEASON_WORD.search(s)
    if m_tv:
        season_num = int(m_tv.group(1))
        # TV title is everything before the season indicator
        idx = m_tv.start()
        raw_title = s[:idx].replace(".", " ").replace("_", " ").strip()
        return {"kind": "tv", "title": raw_title, "season": season_num, "year": None}

    # Check for 4-digit Movie year (1900 - 2099)
    m_year = _YEAR_RE.search(s)
    if m_year:
        year = int(m_year.group(1))
        idx = m_year.start(1)
        raw_title = s[:idx].replace(".", " ").replace("_", " ").strip(" -_()[]")
        # Strip trailing indexer junk or tags before the year
        clean_title = re.sub(r"^[a-zA-Z0-9.-]+\.(?:org|com|net)\s*[-–—:]*\s*", "", raw_title).strip()
        if clean_title:
            return {"kind": "movie", "title": clean_title, "year": year, "season": None}

    return None


def rate_media_quality(filename: str) -> int:
    fl = str(filename).lower()
    score = 10
    if "2160p" in fl or "4k" in fl or "uhd" in fl:
        score += 100
    if "remux" in fl:
        score += 50
    if "1080p" in fl:
        score += 40
    if "720p" in fl:
        score += 20
    return score


def find_best_media_file(pack: Path) -> Path | None:
    """Find the highest quality media file inside a debrid pack without unbounded FUSE recursion."""
    if not pack.exists():
        return None
    if pack.is_file():
        if pack.suffix.lower() in MEDIA_EXTS and "sample" not in pack.name.lower():
            return pack
        return None

    candidates = []
    try:
        # Check direct children first (99% of packs have video files right here)
        direct_files = [p for p in pack.iterdir() if p.is_file() and p.suffix.lower() in MEDIA_EXTS and "sample" not in p.name.lower()]
        if direct_files:
            candidates.extend(direct_files)
        else:
            # Check 1 level down (e.g. nested release folder)
            for sub in pack.iterdir():
                if sub.is_dir() and not sub.name.startswith("."):
                    sub_files = [p for p in sub.iterdir() if p.is_file() and p.suffix.lower() in MEDIA_EXTS and "sample" not in p.name.lower()]
                    candidates.extend(sub_files)
    except OSError:
        return None

    if not candidates:
        return None
    candidates.sort(key=lambda p: (rate_media_quality(p.name), p.stat().st_size if p.exists() else 0), reverse=True)
    return candidates[0]


def clean_stem(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(title or "").lower())


def adopt_debrid_movies(
    all_root: Path = Path("/mnt/debrid/__all__"),
    symlink_root: Path = Path("/mnt/symlinks"),
    rk: str | None = None,
    log=None,
) -> int:
    """Scans all_root for movie packs, registers them in Radarr, and creates canonical symlinks."""
    def note(msg: str):
        if log:
            log(f"[adopt] {msg}")

    if not all_root.is_dir():
        note(f"all_root {all_root} not found")
        return 0

    radarr_url = "http://127.0.0.1:7878"
    existing_movies = []
    if rk:
        try:
            req = urllib.request.Request(f"{radarr_url}/api/v3/movie", headers={"X-Api-Key": rk})
            with urllib.request.urlopen(req, timeout=10) as resp:
                existing_movies = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            note(f"Failed to fetch Radarr movies: {e}")

    existing_stems = {}
    existing_tmdb_ids = set()
    for m in existing_movies:
        t = str(m.get("title") or "")
        st = clean_stem(t)
        if st:
            existing_stems[st] = m
        y = m.get("year")
        if y and st:
            existing_stems[f"{st}{y}"] = m
        if m.get("titleSlug"):
            existing_stems[clean_stem(m["titleSlug"])] = m
        if m.get("tmdbId"):
            existing_tmdb_ids.add(m["tmdbId"])

    radarr_symlinks = symlink_root / "radarr"
    radarr_symlinks.mkdir(parents=True, exist_ok=True)

    adopted = 0
    try:
        packs = list(all_root.iterdir())
    except OSError as e:
        note(f"Failed to list {all_root}: {e}")
        return 0

    for pack in packs:
        parsed = parse_debrid_pack(pack.name)
        if not parsed or parsed["kind"] != "movie":
            continue

        title = parsed["title"]
        year = parsed["year"]
        stem = clean_stem(title)
        if len(stem) < 3:
            continue

        matched_radarr_movie = existing_stems.get(stem)
        canonical_title = matched_radarr_movie.get("title") if matched_radarr_movie else title
        canonical_year = matched_radarr_movie.get("year") if matched_radarr_movie else year
        folder_name = f"{canonical_title} ({canonical_year})" if canonical_year else canonical_title
        movie_dir = radarr_symlinks / folder_name

        # Fast path: If already in Radarr and already has playable symlinks, skip FUSE entirely
        if matched_radarr_movie and movie_dir.is_dir():
            has_playable = any(
                f.suffix.lower() in MEDIA_EXTS for f in movie_dir.iterdir() if f.is_file() or f.is_symlink()
            )
            if has_playable:
                continue

        best_file = find_best_media_file(pack)
        if not best_file:
            continue

        movie_dir.mkdir(parents=True, exist_ok=True)

        # Check if symlink already exists in movie_dir
        has_playable = any(
            f.suffix.lower() in MEDIA_EXTS for f in movie_dir.iterdir() if f.is_file() or f.is_symlink()
        )

        quality_tag = "2160p" if rate_media_quality(best_file.name) >= 100 else "1080p"
        link_name = f"{folder_name} - {quality_tag}{best_file.suffix}"
        link_dest = movie_dir / link_name

        if not has_playable:
            try:
                if link_dest.exists() or link_dest.is_symlink():
                    link_dest.unlink()
                os.symlink(best_file, link_dest)
                note(f"Created symlink: {link_name} -> {best_file}")
                adopted += 1
            except OSError as e:
                note(f"Symlink failed for {link_dest}: {e}")

        # If movie is not in Radarr, look it up and add it
        if not matched_radarr_movie and rk:
            try:
                lookup_url = f"{radarr_url}/api/v3/movie/lookup?term={urllib.parse.quote(title)}"
                l_req = urllib.request.Request(lookup_url, headers={"X-Api-Key": rk})
                with urllib.request.urlopen(l_req, timeout=10) as l_resp:
                    results = json.loads(l_resp.read().decode("utf-8"))
                
                # Pick best match by year or first
                candidate = None
                if year and results:
                    for r in results:
                        if r.get("year") == year:
                            candidate = r
                            break
                if not candidate and results:
                    candidate = results[0]

                if candidate and candidate.get("tmdbId"):
                    cand_tmdb = candidate["tmdbId"]
                    if cand_tmdb in existing_tmdb_ids:
                        existing_stems[stem] = candidate
                        continue

                    add_payload = {
                        "title": candidate.get("title", title),
                        "year": candidate.get("year", year),
                        "tmdbId": cand_tmdb,
                        "qualityProfileId": 1,
                        "titleSlug": candidate.get("titleSlug", ""),
                        "images": candidate.get("images", []),
                        "rootFolderPath": "/symlinks/radarr",
                        "monitored": True,
                        "addOptions": {
                            "searchForMovie": False
                        }
                    }
                    post_req = urllib.request.Request(
                        f"{radarr_url}/api/v3/movie",
                        data=json.dumps(add_payload).encode("utf-8"),
                        headers={"X-Api-Key": rk, "Content-Type": "application/json"},
                        method="POST"
                    )
                    try:
                        with urllib.request.urlopen(post_req, timeout=10) as post_resp:
                            new_movie = json.loads(post_resp.read().decode("utf-8"))
                            existing_stems[stem] = new_movie
                            existing_tmdb_ids.add(cand_tmdb)
                            note(f"Registered into Radarr: {candidate.get('title')} ({candidate.get('year')})")
                    except urllib.error.HTTPError as he:
                        if he.code in (400, 409):
                            existing_tmdb_ids.add(cand_tmdb)
                            existing_stems[stem] = candidate
                        else:
                            note(f"Radarr add failed for {title}: {he}")
            except Exception as e:
                note(f"Radarr lookup/add failed for {title}: {e}")

    if adopted > 0 and rk:
        # Trigger Radarr DownloadedMoviesScan
        try:
            cmd_payload = {"name": "DownloadedMoviesScan", "path": "/symlinks/radarr"}
            cmd_req = urllib.request.Request(
                f"{radarr_url}/api/v3/command",
                data=json.dumps(cmd_payload).encode("utf-8"),
                headers={"X-Api-Key": rk, "Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(cmd_req, timeout=10)
            note("Triggered Radarr DownloadedMoviesScan")
        except Exception as e:
            note(f"Radarr scan command error: {e}")

    return adopted


def _self_test() -> int:
    import unittest

    class TestDebridAdopt(unittest.TestCase):
        def test_parse_movie_scene(self):
            p = parse_debrid_pack("The.Menu.2022.2160p.MA.WEB-DL.DDP5.1.Atmos.DV.HDR10.H.265-CM")
            self.assertIsNotNone(p)
            self.assertEqual(p["kind"], "movie")
            self.assertEqual(p["title"], "The Menu")
            self.assertEqual(p["year"], 2022)

        def test_parse_movie_spaces(self):
            p = parse_debrid_pack("The Prestige 2006 1080p BluRay")
            self.assertIsNotNone(p)
            self.assertEqual(p["kind"], "movie")
            self.assertEqual(p["title"], "The Prestige")
            self.assertEqual(p["year"], 2006)

        def test_parse_movie_bracket_year(self):
            p = parse_debrid_pack("Interstellar (2014) [2160p] [4K]")
            self.assertIsNotNone(p)
            self.assertEqual(p["kind"], "movie")
            self.assertEqual(p["title"], "Interstellar")
            self.assertEqual(p["year"], 2014)

        def test_parse_tv_episode(self):
            p = parse_debrid_pack("Slow Horses S01E01 Failures Contagious 720p ATVP WEB-DL")
            self.assertIsNotNone(p)
            self.assertEqual(p["kind"], "tv")
            self.assertEqual(p["title"], "Slow Horses")
            self.assertEqual(p["season"], 1)

        def test_parse_tv_season_pack(self):
            p = parse_debrid_pack("Severance.S01.Hybrid.MULTI.2160p.WEB-DL.DV.HDR.H265-AOC")
            self.assertIsNotNone(p)
            self.assertEqual(p["kind"], "tv")
            self.assertEqual(p["title"], "Severance")
            self.assertEqual(p["season"], 1)

        def test_clean_stem(self):
            self.assertEqual(clean_stem("The Walking Dead"), "thewalkingdead")
            self.assertEqual(clean_stem("Spider-Man: Brand New Day"), "spidermanbrandnewday")

    suite = unittest.TestLoader().loadTestsFromTestCase(TestDebridAdopt)
    res = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if res.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(_self_test())
    sys.exit(0)
