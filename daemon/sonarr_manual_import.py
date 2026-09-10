"""Sonarr ManualImport harden for ReelOS dump folders. Loaded by wire-engines.py.

House fail (1.2.50): scanning /mnt/symlinks (parent of radarr+sonarr) listed
Night at the Museum under Sonarr. Season-pack names like S01.E01 never parsed,
so The Walking Dead S01 stayed unmatched. TV retry never posted ManualImport.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Injected by wire-engines.py / stuck-downloads.py before use:
call = None  # type: ignore
log_wire = None  # type: ignore

MEDIA_EXT = (".mkv", ".mp4", ".m4v", ".avi", ".ts", ".m2ts")
SONARR_FOLDERS = ("/mnt/symlinks/sonarr", "/symlinks/sonarr")
FOREIGN_PATH_MARKERS = ("/radarr/", "/lidarr/", "/music/", "\\radarr\\", "\\lidarr\\", "\\music\\")

# Cut scene junk so "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1" → "The Walking Dead"
_QUALITY_CUT = re.compile(
    r"[\s._-]+(?:\d{3,4}p|2160p|1080p|720p|480p|4k|uhd|web-?dl|webrip|bluray|b[dr]rip|"
    r"hdtv|hdrip|hdr10|dolby|vision|ddp?5\.?1|atmos|truehd|dts|x26[45]|h\.?26[45]|"
    r"hevc|avc|aac|proper|repack|internal|multi|complete)\b",
    re.I,
)
_YEAR_TAIL = re.compile(r"[\s._-]*\(?((?:19|20)\d{2})\)?\s*$")
_EP_SXX_EXX = re.compile(r"[Ss](\d{1,2})\s*[.\-_ ]?\s*[Ee](\d{1,3})")
_EP_SXX_X = re.compile(r"[Ss](\d{1,2})\s*[xX](\d{1,3})")
_EP_1X01 = re.compile(r"(?<![A-Za-z0-9])(\d{1,2})[xX](\d{1,3})(?![A-Za-z0-9])")
_SEASON_ONLY = re.compile(r"(?:^|[\s._-])[Ss](\d{1,2})(?:[\s._-]|$)")
_SEASON_WORD = re.compile(r"(?i)(?:^|[\s._-])season[\s._-]*(\d{1,2})(?:[\s._-]|$)")
_EP_ONLY = re.compile(r"(?:^|[\s._-])[Ee](\d{1,3})(?:[\s._-]|$)")


def is_media_file(path: str) -> bool:
    return bool(path) and str(path).lower().endswith(MEDIA_EXT)


def is_foreign_media_path(path: str) -> bool:
    """True when a Sonarr scan wandered into a movie/music dump (Museum bleed)."""
    blob = str(path or "").replace("\\", "/").lower()
    if "/radarr/" in blob or "/lidarr/" in blob or "/music/" in blob:
        return True
    return False


def _ep_tag(name: str) -> tuple[int, int] | None:
    """Parse SxxExx / S01.E01 / 1x01 from a dump filename."""
    s = str(name or "").replace("  ", " ")
    for rx in (_EP_SXX_EXX, _EP_SXX_X, _EP_1X01):
        m = rx.search(s)
        if m:
            return int(m.group(1)), int(m.group(2))
    return None


def _season_only(name: str) -> int | None:
    """Season pack folder: S01 or Season 1, not a year and not S01E01."""
    if _ep_tag(name):
        return _ep_tag(name)[0]
    m = _SEASON_WORD.search(name or "")
    if m:
        return int(m.group(1))
    m = _SEASON_ONLY.search(name or "")
    if m:
        return int(m.group(1))
    return None


def _ep_only(name: str) -> int | None:
    """E01 when the season already came from the folder."""
    if _ep_tag(name):
        return _ep_tag(name)[1]
    m = _EP_ONLY.search(name or "")
    if m:
        return int(m.group(1))
    return None


def strip_release_tokens(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(raw or "").replace(".", " ").replace("_", " ")).strip()
    cleaned = _QUALITY_CUT.split(cleaned, maxsplit=1)[0]
    cleaned = re.split(r"\s[-–]\s*[Ss]\d", cleaned, maxsplit=1)[0]
    cleaned = re.split(r"(?i)\s+season\s+\d", cleaned, maxsplit=1)[0]
    cleaned = _YEAR_TAIL.sub("", cleaned)
    return cleaned.strip(" .-_")


def _series_title_guess(path: str) -> str:
    p = Path(path)
    for raw in (p.parent.name, p.name, p.parent.parent.name if p.parent.parent else ""):
        cleaned = strip_release_tokens(raw)
        if cleaned and not re.fullmatch(r"[Ss]\d+[Ee]\d+", cleaned):
            return cleaned
    return ""


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _match_series(series_rows: list[dict], guess: str) -> dict | None:
    if not guess:
        return None
    g = normalize_title(guess)
    if len(g) < 4:
        return None
    best = None
    best_score = 0
    for s in series_rows:
        titles = [s.get("title") or "", s.get("sortTitle") or ""]
        titles += [a.get("title") or "" for a in (s.get("alternateTitles") or []) if isinstance(a, dict)]
        for t in titles:
            n = normalize_title(t)
            if not n or len(n) < 4:
                continue
            if n == g:
                return s
            # Require the shorter token to be a real title stem, not "the" / "a".
            shorter, longer = (n, g) if len(n) <= len(g) else (g, n)
            if shorter in longer and len(shorter) >= 8:
                score = len(shorter)
                if score > best_score:
                    best, best_score = s, score
    return best


def _sonarr_series_map(sk: str) -> list[dict]:
    try:
        rows = call("http://127.0.0.1:8989/api/v3/series", sk) or []
    except Exception as e:
        log_wire(f"sonarr series list {type(e).__name__} {e}")
        return []
    return [r for r in rows if isinstance(r, dict) and r.get("id")]


def _episode_ids_for(sk: str, series_id: int, season: int, episode: int, cache: dict) -> list[int]:
    key = series_id
    if key not in cache:
        try:
            cache[key] = call(
                f"http://127.0.0.1:8989/api/v3/episode?seriesId={series_id}",
                sk,
            ) or []
        except Exception as e:
            log_wire(f"sonarr episodes {series_id} {type(e).__name__} {e}")
            cache[key] = []
    ids = []
    for ep in cache[key]:
        if not isinstance(ep, dict):
            continue
        if int(ep.get("seasonNumber") or -1) == season and int(ep.get("episodeNumber") or -1) == episode:
            if ep.get("id"):
                ids.append(ep["id"])
    return ids


def _season_episode_ids(sk: str, series_id: int, season: int, cache: dict) -> list[int]:
    key = series_id
    if key not in cache:
        _episode_ids_for(sk, series_id, season, 1, cache)
    ids = []
    for ep in cache.get(key) or []:
        if not isinstance(ep, dict):
            continue
        if int(ep.get("seasonNumber") or -1) == season and ep.get("id"):
            ids.append(ep["id"])
    return ids


def _series_file_count(sk: str, series_id: int) -> int:
    try:
        s = call(f"http://127.0.0.1:8989/api/v3/series/{series_id}", sk) or {}
        return int((s.get("statistics") or {}).get("episodeFileCount") or 0)
    except Exception:
        return -1


def hint_series_id(hint: dict | None) -> int | None:
    if not hint:
        return None
    raw = hint.get("seriesId")
    if raw:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    series = hint.get("series") if isinstance(hint.get("series"), dict) else {}
    if series.get("id"):
        try:
            return int(series["id"])
        except (TypeError, ValueError):
            pass
    return None


def hint_episode_ids(hint: dict | None) -> list[int]:
    if not hint:
        return []
    out: list[int] = []
    for ep in hint.get("episodes") or []:
        if isinstance(ep, dict) and ep.get("id"):
            out.append(int(ep["id"]))
    one = hint.get("episode") if isinstance(hint.get("episode"), dict) else {}
    if one.get("id"):
        out.append(int(one["id"]))
    for raw in hint.get("episodeIds") or []:
        try:
            out.append(int(raw))
        except (TypeError, ValueError):
            pass
    # de-dupe, keep order
    seen: set[int] = set()
    uniq: list[int] = []
    for i in out:
        if i not in seen:
            seen.add(i)
            uniq.append(i)
    return uniq


def hint_season(hint: dict | None) -> int | None:
    if not hint:
        return None
    for key in ("seasonNumber", "season"):
        if hint.get(key) is not None:
            try:
                n = int(hint[key])
                if n > 0:
                    return n
            except (TypeError, ValueError):
                pass
    ep = hint.get("episode") if isinstance(hint.get("episode"), dict) else {}
    if ep.get("seasonNumber"):
        try:
            return int(ep["seasonNumber"])
        except (TypeError, ValueError):
            pass
    for ep in hint.get("episodes") or []:
        if isinstance(ep, dict) and ep.get("seasonNumber"):
            try:
                return int(ep["seasonNumber"])
            except (TypeError, ValueError):
                pass
    title = str(hint.get("title") or "")
    tag = _ep_tag(title) or None
    if tag:
        return tag[0]
    return _season_only(title)


def match_row(
    row: dict,
    series_rows: list[dict],
    *,
    ep_lookup=None,
    season_lookup=None,
    hint: dict | None = None,
) -> dict | None:
    """Map one manualimport row to a Sonarr ManualImport file payload, or None."""
    path = row.get("path")
    if not is_media_file(path) or is_foreign_media_path(path):
        return None
    series = row.get("series") or {}
    episodes = row.get("episodes") or []
    series_id = series.get("id") or hint_series_id(hint)
    episode_ids = [e["id"] for e in episodes if isinstance(e, dict) and e.get("id")]
    if not episode_ids:
        episode_ids = hint_episode_ids(hint) if hint_series_id(hint) == series_id or not series.get("id") else []

    tag = _ep_tag(Path(path).name) or _ep_tag(Path(path).parent.name)
    season = (tag[0] if tag else None) or _season_only(Path(path).parent.name) or _season_only(Path(path).name)
    season = season or hint_season(hint)

    if not series_id:
        hit = _match_series(series_rows, _series_title_guess(path))
        if hit:
            series_id = hit["id"]
            series = hit

    if series_id and tag and not episode_ids and ep_lookup:
        episode_ids = ep_lookup(int(series_id), tag[0], tag[1])
    if series_id and season and not episode_ids and not tag:
        epn = _ep_only(Path(path).name)
        if epn and ep_lookup:
            episode_ids = ep_lookup(int(series_id), int(season), epn)
        elif season_lookup:
            episode_ids = season_lookup(int(series_id), int(season))

    if not path or not series_id or not episode_ids:
        return None
    item = {
        "path": path,
        "seriesId": series_id,
        "episodeIds": episode_ids,
        "quality": row.get("quality") or {"quality": {"id": 1}, "revision": {"version": 1, "real": 0}},
        "languages": row.get("languages") or [{"id": 1}],
        "indexerFlags": row.get("indexerFlags") or 0,
    }
    if row.get("releaseGroup"):
        item["releaseGroup"] = row["releaseGroup"]
    return item


def pair_season_pack(
    unmatched: list[dict],
    series_rows: list[dict],
    *,
    ep_lookup,
    season_lookup,
    hint: dict | None = None,
) -> list[dict]:
    """Last resort: N video files in one dump → that season's N episodes, in name order."""
    groups: dict[tuple, list[dict]] = {}
    for row in unmatched:
        path = row.get("path")
        if not is_media_file(path) or is_foreign_media_path(path):
            continue
        series_id = (row.get("series") or {}).get("id") or hint_series_id(hint)
        if not series_id:
            hit = _match_series(series_rows, _series_title_guess(path))
            series_id = hit["id"] if hit else None
        season = (
            _season_only(Path(path).parent.name)
            or _season_only(Path(path).name)
            or hint_season(hint)
        )
        if not series_id or not season:
            continue
        groups.setdefault((int(series_id), int(season)), []).append(row)

    recovered: list[dict] = []
    for (series_id, season), rows in groups.items():
        videos = sorted(rows, key=lambda r: str(r.get("path") or "").lower())
        ids = season_lookup(series_id, season) if season_lookup else []
        if not ids:
            continue
        if len(videos) == 1 and len(ids) > 1:
            # Single-file season pack: attach every episode in the season.
            mapped = match_row(
                {**videos[0], "episodes": [{"id": i} for i in ids], "series": {"id": series_id}},
                series_rows,
                ep_lookup=ep_lookup,
                season_lookup=season_lookup,
                hint=hint,
            )
            if mapped:
                recovered.append(mapped)
            continue
        if len(videos) != len(ids):
            continue
        for row, eid in zip(videos, ids):
            mapped = match_row(
                {**row, "episodes": [{"id": eid}], "series": {"id": series_id}},
                series_rows,
                ep_lookup=ep_lookup,
                season_lookup=season_lookup,
                hint=hint,
            )
            if mapped:
                recovered.append(mapped)
    return recovered


def select_import_files(
    rows: list,
    series_rows: list[dict],
    *,
    ep_lookup=None,
    season_lookup=None,
    hint: dict | None = None,
) -> tuple[list[dict], list[str]]:
    """Return (ManualImport payloads, unmatched video basenames that look like TV)."""
    files: list[dict] = []
    leftover: list[dict] = []
    sample_unmatched: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        path = row.get("path")
        if not is_media_file(path):
            continue
        if is_foreign_media_path(path):
            continue
        mapped = match_row(
            row,
            series_rows,
            ep_lookup=ep_lookup,
            season_lookup=season_lookup,
            hint=hint,
        )
        if mapped:
            files.append(mapped)
        else:
            leftover.append(row)
            if len(sample_unmatched) < 5:
                sample_unmatched.append(Path(path).name if path else "?")

    extra = pair_season_pack(
        leftover,
        series_rows,
        ep_lookup=ep_lookup,
        season_lookup=season_lookup,
        hint=hint,
    )
    if extra:
        have = {f["path"] for f in files}
        for item in extra:
            if item["path"] not in have:
                files.append(item)
                have.add(item["path"])
        sample_unmatched = [
            Path(r["path"]).name
            for r in leftover
            if r.get("path") and r["path"] not in have
        ][:5]
    return files, sample_unmatched


def _expand_scan_folders(folders: list[str]) -> list[str]:
    """Scan each dump/series subfolder on its own instead of the whole tree.

    A single manualimport call on all of /symlinks/sonarr makes Sonarr probe
    every episode over the FUSE debrid mount and blow past the client timeout
    ("sonarr manualimport list ... TimeoutError timed out"), so the whole import
    is skipped. Listing immediate subfolders keeps each call small and bounded,
    and resolve()-dedupe drops the duplicate mount alias (/symlinks vs
    /mnt/symlinks) that doubled the work. Falls back to the raw folders when the
    base path is not present on the host (e.g. FUSE not mounted).
    """
    targets: list[str] = []
    seen: set[str] = set()
    fallback: list[str] = []
    for base in folders:
        b = (base or "").rstrip("/")
        if not b:
            continue
        p = Path(b)
        try:
            if not p.is_dir():
                fallback.append(b)
                continue
            real = str(p.resolve())
        except OSError:
            fallback.append(b)
            continue
        if real in seen:
            continue
        seen.add(real)
        try:
            subs = sorted(str(c) for c in p.iterdir() if c.is_dir())
        except OSError:
            subs = []
        targets.extend(subs if subs else [b])
    return targets or fallback or [f.rstrip("/") for f in folders if f]


def _list_manualimport(sk: str, folders: list[str]) -> list[dict]:
    rows: list = []
    for folder in _expand_scan_folders(folders):
        q = urllib.parse.urlencode({"folder": folder, "filterExistingFiles": "false"})
        url = f"http://127.0.0.1:8989/api/v3/manualimport?{q}"
        hdrs = {"X-Api-Key": sk, "Content-Type": "application/json"}
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as resp:
                chunk = json.loads(resp.read().decode()) or []
            if isinstance(chunk, list):
                rows.extend(chunk)
                log_wire(f"sonarr manualimport list folder={folder} rows={len(chunk)}")
        except Exception as e:
            log_wire(f"sonarr manualimport list {folder} {type(e).__name__} {e}")
    by_path: dict[str, dict] = {}
    for row in rows:
        if isinstance(row, dict) and row.get("path"):
            if is_foreign_media_path(row["path"]):
                continue
            by_path[row["path"]] = row
    return list(by_path.values())


def _queue_manualimport(sk: str, files: list[dict]) -> None:
    if not files:
        return
    before = {}
    for sid in {f["seriesId"] for f in files}:
        before[sid] = _series_file_count(sk, int(sid))
    chunk_size = 40
    try:
        for i in range(0, len(files), chunk_size):
            chunk = files[i : i + chunk_size]
            call(
                "http://127.0.0.1:8989/api/v3/command",
                sk,
                method="POST",
                body={"name": "ManualImport", "files": chunk, "importMode": "copy"},
            )
            log_wire(f"sonarr manualimport queued {len(chunk)} ({i + len(chunk)}/{len(files)})")
            time.sleep(3)
    except Exception as e:
        log_wire(f"sonarr manualimport {type(e).__name__} {e}")
        return
    deadline = time.time() + 90
    while time.time() < deadline:
        moved = False
        for sid, prev in before.items():
            now = _series_file_count(sk, int(sid))
            log_wire(f"sonarr series {sid} files={now} (was {prev})")
            if now > max(prev, 0):
                moved = True
        if moved:
            break
        time.sleep(8)
    try:
        call("http://127.0.0.1:8989/api/v3/command", sk, method="POST", body={"name": "RescanSeries"})
    except Exception as e:
        log_wire(f"sonarr rescan after import {type(e).__name__} {e}")


def sonarr_manual_import(sk: str, hint: dict | None = None, folders: list[str] | None = None) -> None:
    """Dump folders are not a series library. Copy matched episodes into the series folder.

    Never scan /mnt/symlinks (parent of radarr). That listed Museum under Sonarr.
    """
    scan = list(folders) if folders else list(SONARR_FOLDERS)
    scan = [f for f in scan if f and not is_foreign_media_path(f.rstrip("/") + "/")]
    if not scan:
        scan = list(SONARR_FOLDERS)
    rows = _list_manualimport(sk, scan)
    series_rows = _sonarr_series_map(sk)
    ep_cache: dict = {}

    def ep_lookup(series_id: int, season: int, episode: int) -> list[int]:
        return _episode_ids_for(sk, series_id, season, episode, ep_cache)

    def season_lookup(series_id: int, season: int) -> list[int]:
        return _season_episode_ids(sk, series_id, season, ep_cache)

    files, sample_unmatched = select_import_files(
        rows,
        series_rows,
        ep_lookup=ep_lookup,
        season_lookup=season_lookup,
        hint=hint,
    )
    log_wire(f"sonarr manualimport matched={len(files)} unmatched={len(sample_unmatched)}")
    if sample_unmatched:
        log_wire("sonarr manualimport unmatched sample: " + " | ".join(sample_unmatched))
    _queue_manualimport(sk, files)


def bind(*, call_fn, log_fn):
    global call, log_wire
    call = call_fn
    log_wire = log_fn


def _self_test() -> int:
    import unittest

    class Matching(unittest.TestCase):
        def test_ep_tag_sxxexx_and_dotted(self):
            self.assertEqual(_ep_tag("The.Walking.Dead.S01E01.2160p.WEB-DL.mkv"), (1, 1))
            self.assertEqual(_ep_tag("The.Walking.Dead.S01.E01.2160p.WEB-DL.mkv"), (1, 1))
            self.assertEqual(_ep_tag("The Walking Dead S01 E01"), (1, 1))
            self.assertEqual(_ep_tag("TWD.1x02.mkv"), (1, 2))
            self.assertIsNone(_ep_tag("The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1"))

        def test_season_only_not_year(self):
            self.assertEqual(_season_only("The.Walking.Dead.S01.2160p"), 1)
            self.assertEqual(_season_only("The Walking Dead Season 1"), 1)
            self.assertIsNone(_season_only("The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1"))
            self.assertIsNone(_season_only("Night.at.the.Museum.2006.2160p.WEB-DL"))

        def test_title_guess_strips_scene(self):
            path = "/mnt/symlinks/sonarr/The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1/The.Walking.Dead.S01.E01.mkv"
            self.assertEqual(_series_title_guess(path), "The Walking Dead")
            movie = "/mnt/symlinks/radarr/Night.at.the.Museum.2006.2160p.WEB-DL.DDP5.1/Night.at.the.Museum.2006.mkv"
            self.assertEqual(_series_title_guess(movie), "Night at the Museum")

        def test_expand_scan_folders_per_subfolder_and_dedupe(self):
            import tempfile

            with tempfile.TemporaryDirectory() as d:
                base = Path(d) / "sonarr"
                (base / "Show A").mkdir(parents=True)
                (base / "The.Expanse.S01.2160p").mkdir()
                (base / "loose.mkv").write_bytes(b"x")  # a file must not be a target
                out = _expand_scan_folders([str(base), str(base), "/does/not/exist"])
                self.assertEqual(
                    sorted(Path(p).name for p in out),
                    ["Show A", "The.Expanse.S01.2160p"],
                )
                self.assertEqual(len(out), 2)  # duplicate base + missing path dropped

        def test_expand_scan_folders_fallback_when_absent(self):
            self.assertEqual(
                _expand_scan_folders(["/no/such/a", "/no/such/b"]),
                ["/no/such/a", "/no/such/b"],
            )

        def test_skip_museum_under_radarr(self):
            self.assertTrue(
                is_foreign_media_path(
                    "/mnt/symlinks/radarr/Night.at.the.Museum.2006.2160p.WEB-DL.DDP5.1/x.mkv"
                )
            )
            self.assertFalse(
                is_foreign_media_path(
                    "/mnt/symlinks/sonarr/The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1/x.mkv"
                )
            )

        def test_match_walking_dead_from_scene_folder(self):
            series = [{"id": 9, "title": "The Walking Dead", "sortTitle": "walking dead"}]
            self.assertEqual(_match_series(series, "The Walking Dead")["id"], 9)
            self.assertEqual(_match_series(series, "The.Walking.Dead.2010.2160p.WEB-DL")["id"], 9)
            self.assertIsNone(_match_series(series, "Night at the Museum"))
            self.assertIsNone(_match_series(series, "the"))

        def test_select_skips_radarr_rows_and_matches_dotted_ep(self):
            series = [{"id": 9, "title": "The Walking Dead"}]
            rows = [
                {
                    "path": "/mnt/symlinks/radarr/Night.at.the.Museum.2006.2160p.WEB-DL/Museum.mkv",
                },
                {
                    "path": "/mnt/symlinks/sonarr/The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1/"
                    "The.Walking.Dead.S01.E01.2160p.WEB-DL.mkv",
                },
            ]

            def ep_lookup(sid, season, episode):
                self.assertEqual((sid, season, episode), (9, 1, 1))
                return [101]

            files, sample = select_import_files(rows, series, ep_lookup=ep_lookup)
            self.assertEqual(len(files), 1)
            self.assertEqual(files[0]["seriesId"], 9)
            self.assertEqual(files[0]["episodeIds"], [101])
            self.assertEqual(sample, [])

        def test_season_pack_pairs_when_folder_has_s01(self):
            series = [{"id": 9, "title": "The Walking Dead"}]
            rows = [
                {"path": "/mnt/symlinks/sonarr/The Walking Dead S01/E01.mkv"},
                {"path": "/mnt/symlinks/sonarr/The Walking Dead S01/E02.mkv"},
            ]

            def ep_lookup(sid, season, episode):
                return [100 + episode] if sid == 9 and season == 1 else []

            def season_lookup(sid, season):
                return [101, 102] if sid == 9 and season == 1 else []

            files, sample = select_import_files(
                rows, series, ep_lookup=ep_lookup, season_lookup=season_lookup
            )
            self.assertEqual(len(files), 2)
            self.assertEqual(sample, [])
            self.assertEqual(sorted(i for f in files for i in f["episodeIds"]), [101, 102])

        def test_queue_hint_maps_pack_without_ep_tags(self):
            series = [{"id": 9, "title": "The Walking Dead"}]
            rows = [
                {
                    "path": "/mnt/symlinks/sonarr/The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1/"
                    "The.Walking.Dead.2010.2160p.WEB-DL.DDP5.1.mkv"
                }
            ]
            hint = {"seriesId": 9, "seasonNumber": 1, "episodes": [{"id": 201}, {"id": 202}]}
            files, sample = select_import_files(
                rows,
                series,
                season_lookup=lambda sid, season: [201, 202],
                hint=hint,
            )
            self.assertEqual(len(files), 1)
            self.assertEqual(files[0]["episodeIds"], [201, 202])
            self.assertEqual(sample, [])

        def test_scan_folders_never_include_symlink_parent(self):
            self.assertNotIn("/mnt/symlinks", SONARR_FOLDERS)
            self.assertTrue(all("sonarr" in f for f in SONARR_FOLDERS))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Matching)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("sonarr_manual_import.py is loaded by wire-engines / stuck-downloads")
