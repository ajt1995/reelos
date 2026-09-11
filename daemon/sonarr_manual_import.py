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
SONARR_FOLDERS = ("/symlinks/sonarr",)
FOREIGN_PATH_MARKERS = ("/radarr/", "/lidarr/", "/music/", "\\radarr\\", "\\lidarr\\", "\\music\\")
SMALL_MEM_KB = 4_718_592
LIST_TIMEOUT_SEC = 20  # was 120; skip folder on timeout and continue
FFPROBE_D_BACKOFF_LIMIT = 1  # I/O backpressure — not a Pi vs laptop gate
PROGRESS_PATH = Path("/var/lib/reelos/library-progress.json")
LIBRARY_LOG = Path("/var/lib/reelos/library.log")
_HW = None

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



def series_episode_file_count(row: dict) -> int:
    try:
        return int((row.get("statistics") or {}).get("episodeFileCount") or 0)
    except (TypeError, ValueError):
        return 0


def folder_already_imported(folder: str, series_rows: list[dict]) -> bool:
    """True when this dump folder maps to a series Sonarr already has files for."""
    guess = strip_release_tokens(Path(folder).name)
    hit = _match_series(series_rows, guess)
    if not hit:
        return False
    return series_episode_file_count(hit) > 0


def _hw():
    global _HW
    if _HW is not None:
        return _HW
    import importlib.util

    here = Path(__file__).resolve().parent
    for cand in (here / "reelos_hardware.py", Path("/opt/reelos/bin/reelos_hardware.py")):
        if not cand.is_file():
            continue
        spec = importlib.util.spec_from_file_location("reelos_hardware", cand)
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _HW = mod
        return _HW
    return None


def hardware_profile() -> dict:
    mod = _hw()
    if mod is not None:
        return mod.measure()
    try:
        ram_kb = 0
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal:"):
                ram_kb = int(line.split()[1])
                break
    except (OSError, ValueError, IndexError):
        ram_kb = 0
    tiny = 0 < ram_kb <= SMALL_MEM_KB
    return {
        "ram_kb": ram_kb,
        "ram_gb": round(ram_kb / 1024 / 1024, 2),
        "cpus": 1,
        "disk_kind": "unknown",
        "tiny": tiny,
        "box_is_small": tiny,
    }


def box_is_small() -> bool:
    """Tiny (≤4.5Gi) fixture only. Import caps use hardware_profile()."""
    return bool(hardware_profile().get("tiny"))


def ffprobe_d_state_count(text: str | None = None) -> int:
    """Count D-state ffprobe rows. Empty/missing text is 0 — never guess high."""
    if text is None:
        try:
            import subprocess

            r = subprocess.run(["ps", "-eo", "state,comm"], capture_output=True, text=True, check=False)
            text = r.stdout or ""
        except OSError:
            return 0
    n = 0
    for line in str(text or "").splitlines():
        parts = line.split()
        if len(parts) >= 2 and "D" in parts[0] and "ffprobe" in parts[1]:
            n += 1
    return n


def ffprobe_is_stubbed() -> bool:
    """True when container ffprobe is the ReelOS no-op script, not the ELF."""
    try:
        import subprocess

        r = subprocess.run(
            ["docker", "exec", "reelos-sonarr-1", "head", "-1", "/app/sonarr/bin/ffprobe"],
            capture_output=True,
            text=True,
            check=False,
            timeout=8,
        )
        return (r.stdout or "").lstrip().startswith("#!")
    except (OSError, subprocess.TimeoutExpired):
        return False


def ffprobe_d_backoff_limit(*, small: bool | None = None) -> int:
    """Any ffprobe D-state is I/O backpressure. Hardware size does not change this."""
    mod = _hw()
    if mod is not None:
        return int(mod.d_backoff_limit())
    return FFPROBE_D_BACKOFF_LIMIT


def catchup_chunk_size(*, catch_up: bool, d_state: int = 0, profile: dict | None = None) -> int:
    """High D-state → 0 on any hardware. Stubbed ffprobe is not FUSE backpressure."""
    if ffprobe_is_stubbed():
        d_state = 0
    prof = profile if profile is not None else hardware_profile()
    mod = _hw()
    if mod is not None:
        return int(mod.import_chunk_size(prof, catch_up=catch_up, d_state=d_state))
    if int(d_state or 0) > 0:
        return 0
    if catch_up or bool(prof.get("tiny")):
        return 8 if catch_up else 20
    return 40


def format_catchup_message(*, folder: int = 0, total: int = 0, skipped: int = 0, timeouts: int = 0, status: str = "running") -> str:
    if status in ("backoff", "idle"):
        return ""
    bits = []
    if total:
        bits.append(f"folder {folder} of {total}")
    if skipped:
        bits.append(f"{skipped} skipped")
    if timeouts:
        bits.append(f"{timeouts} timeouts")
    detail = ", ".join(bits)
    if status == "done":
        return f"Library catch-up done" + (f" — {detail}" if detail else "")
    if detail:
        return f"Library catching up — {detail}"
    return "Library catching up"


def write_library_progress(**fields):
    """Phone library clock. Merge onto the JSON the splash/API read."""
    path = PROGRESS_PATH
    try:
        prev = json.loads(path.read_text()) if path.is_file() else {}
        if not isinstance(prev, dict):
            prev = {}
    except (OSError, json.JSONDecodeError):
        prev = {}
    prev.update({k: v for k, v in fields.items() if v is not None})
    status = str(prev.get("status") or "idle")
    if status == "backoff":
        status = "idle"
        prev["status"] = "idle"
        prev["needsImport"] = False
    needs = bool(prev.get("needsImport"))
    prev["splashLock"] = status == "running" and needs
    if "message" in fields:
        prev["message"] = fields.get("message") or format_catchup_message(
            folder=int(prev.get("folder") or 0),
            total=int(prev.get("total") or 0),
            skipped=int(prev.get("skipped") or 0),
            timeouts=int(prev.get("timeouts") or 0),
            status=status,
        )
    else:
        prev["message"] = format_catchup_message(
        folder=int(prev.get("folder") or 0),
        total=int(prev.get("total") or 0),
        skipped=int(prev.get("skipped") or 0),
        timeouts=int(prev.get("timeouts") or 0),
        status=status,
    )
    prev["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(prev) + "\n")
    except OSError:
        pass
    msg = prev.get("message") or ""
    if msg:
        try:
            LIBRARY_LOG.parent.mkdir(parents=True, exist_ok=True)
            with LIBRARY_LOG.open("a") as fh:
                fh.write(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + " " + msg + "\n")
        except OSError:
            pass
    if log_wire:
        log_wire(msg)
    return prev


def import_folder_cap(*, catch_up: bool, profile: dict | None = None) -> int:
    prof = profile if profile is not None else hardware_profile()
    mod = _hw()
    if mod is not None:
        return int(mod.import_folder_cap(prof, catch_up=catch_up))
    small = bool(prof.get("tiny"))
    if catch_up:
        return 6 if small else 16
    return 12 if small else 48


def arr_alias(path: str) -> str:
    """Sonarr sees /symlinks/... — never list the host /mnt alias as a second folder."""
    p = str(path or "").replace("\\", "/").rstrip("/")
    if p.startswith("/mnt/symlinks/"):
        return "/symlinks/" + p[len("/mnt/symlinks/") :]
    return p


def host_listdir_root(arr_path: str) -> Path:
    arr = arr_alias(arr_path)
    if arr.startswith("/symlinks/"):
        host = Path("/mnt/symlinks") / arr[len("/symlinks/") :]
        if host.is_dir():
            return host
    return Path(arr)


def _expand_scan_folders(
    folders: list[str],
    *,
    series_rows: list[dict] | None = None,
    catch_up: bool = False,
    cap: int | None = None,
) -> list[str]:
    """Scan each dump subfolder once. Never list host+container paths twice.

    A single manualimport call on all of /symlinks/sonarr makes Sonarr probe
    every episode over the FUSE debrid mount and blow past the client timeout.
    Skip folders Sonarr already has files for. Folder cap follows hardware_profile().
    """
    roots: list[str] = []
    seen_roots: set[str] = set()
    for base in folders:
        arr = arr_alias(base)
        if not arr or arr in seen_roots:
            continue
        seen_roots.add(arr)
        roots.append(arr)

    targets: list[str] = []
    seen_targets: set[str] = set()
    fallback: list[str] = []
    skipped = 0
    for arr in roots:
        host = host_listdir_root(arr)
        try:
            is_dir = host.is_dir()
            subs = sorted(c for c in host.iterdir() if c.is_dir()) if is_dir else []
        except OSError:
            is_dir = False
            subs = []
        if not is_dir:
            fallback.append(arr)
            continue
        kids = subs if subs else [None]
        for child in kids:
            arr_child = f"{arr.rstrip('/')}/{child.name}" if child is not None else arr
            if arr_child in seen_targets:
                continue
            if series_rows and folder_already_imported(arr_child, series_rows):
                skipped += 1
                if log_wire:
                    log_wire(f"sonarr skip folder already has files {arr_child}")
                continue
            seen_targets.add(arr_child)
            targets.append(arr_child)
    if not targets:
        targets = fallback
    if cap is None:
        cap = import_folder_cap(catch_up=catch_up)
    if cap and len(targets) > cap:
        skipped += len(targets) - cap
        if log_wire:
            log_wire(f"sonarr import cap {cap} of {len(targets)} folders")
        targets = targets[:cap]
    if catch_up:
        write_library_progress(
            status="running",
            skipped=skipped,
            total=len(targets),
            folder=0,
            needsImport=bool(targets),
        )
    return targets


def _list_manualimport(
    sk: str,
    folders: list[str],
    *,
    series_rows: list[dict] | None = None,
    catch_up: bool = False,
) -> list[dict]:
    rows: list = []
    scan = _expand_scan_folders(folders, series_rows=series_rows, catch_up=catch_up)
    timeouts = 0
    limit = ffprobe_d_backoff_limit()
    for i, folder in enumerate(scan, start=1):
        d_state = ffprobe_d_state_count()
        if catch_up and d_state >= limit and not ffprobe_is_stubbed():
            if log_wire:
                log_wire(f"import catch-up idle — ffprobe D-state {d_state} (not piling more)")
            write_library_progress(
                status="idle",
                folder=i,
                total=len(scan),
                timeouts=timeouts,
                needsImport=False,
                message="",
            )
            break
        if catch_up and d_state >= limit:
            if log_wire:
                log_wire(f"import catch-up — ffprobe stubbed, skip-existing dumps (D-state {d_state})")
        if catch_up:
            write_library_progress(
                status="running",
                folder=i,
                total=len(scan),
                timeouts=timeouts,
                needsImport=True,
            )
        q = urllib.parse.urlencode({"folder": folder, "filterExistingFiles": "true"})
        url = f"http://127.0.0.1:8989/api/v3/manualimport?{q}"
        hdrs = {"X-Api-Key": sk, "Content-Type": "application/json"}
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=LIST_TIMEOUT_SEC) as resp:
                chunk = json.loads(resp.read().decode()) or []
            if isinstance(chunk, list):
                rows.extend(chunk)
                log_wire(f"sonarr manualimport list folder={folder} rows={len(chunk)}")
        except TimeoutError as e:
            timeouts += 1
            log_wire(f"sonarr manualimport skip folder on timeout {folder} {e}")
            if catch_up:
                write_library_progress(status="running", folder=i, total=len(scan), timeouts=timeouts, needsImport=True)
        except OSError as e:
            if "timed out" in str(e).lower():
                timeouts += 1
                log_wire(f"sonarr manualimport skip folder on timeout {folder} {e}")
                if catch_up:
                    write_library_progress(status="running", folder=i, total=len(scan), timeouts=timeouts, needsImport=True)
            else:
                log_wire(f"sonarr manualimport list {folder} {type(e).__name__} {e}")
        except Exception as e:
            log_wire(f"sonarr manualimport list {folder} {type(e).__name__} {e}")
    by_path: dict[str, dict] = {}
    for row in rows:
        if isinstance(row, dict) and row.get("path"):
            if is_foreign_media_path(row["path"]):
                continue
            by_path[row["path"]] = row
    return list(by_path.values())


def _queue_manualimport(sk: str, files: list[dict], *, catch_up: bool = False) -> None:
    if not files:
        return
    before = {}
    for sid in {f["seriesId"] for f in files}:
        before[sid] = _series_file_count(sk, int(sid))
    chunk_size = catchup_chunk_size(catch_up=catch_up, d_state=ffprobe_d_state_count())
    if chunk_size <= 0:
        log_wire("sonarr manualimport skip queue — ffprobe D-state (concurrency 0)")
        return
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
            time.sleep(2 if catch_up else 3)
    except Exception as e:
        log_wire(f"sonarr manualimport {type(e).__name__} {e}")
        return
    deadline = time.time() + (20 if catch_up or bool(hardware_profile().get("tiny")) else 90)
    while time.time() < deadline:
        moved = False
        for sid, prev in before.items():
            now = _series_file_count(sk, int(sid))
            log_wire(f"sonarr series {sid} files={now} (was {prev})")
            if now > max(prev, 0):
                moved = True
        if moved:
            break
        time.sleep(5 if catch_up else 8)
    try:
        for sid in {int(f["seriesId"]) for f in files}:
            call(
                "http://127.0.0.1:8989/api/v3/command",
                sk,
                method="POST",
                body={"name": "RescanSeries", "seriesId": sid},
            )
    except Exception as e:
        log_wire(f"sonarr rescan after import {type(e).__name__} {e}")


def sonarr_manual_import(
    sk: str,
    hint: dict | None = None,
    folders: list[str] | None = None,
    *,
    catch_up: bool = False,
) -> None:
    """Dump folders are not a series library. Copy matched episodes into the series folder.

    Never scan /mnt/symlinks (parent of radarr). That listed Museum under Sonarr.
    Skip folders Sonarr already has files for. Do not RescanSeries with no id.
    """
    scan = list(folders) if folders else list(SONARR_FOLDERS)
    scan = [f for f in scan if f and not is_foreign_media_path(f.rstrip("/") + "/")]
    if not scan:
        scan = list(SONARR_FOLDERS)
    series_rows = _sonarr_series_map(sk)
    rows = _list_manualimport(sk, scan, series_rows=series_rows, catch_up=catch_up)
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
    _queue_manualimport(sk, files, catch_up=catch_up)


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

        def test_arr_alias_dedupes_host_and_container(self):
            self.assertEqual(arr_alias("/mnt/symlinks/sonarr/Show"), "/symlinks/sonarr/Show")
            self.assertEqual(arr_alias("/symlinks/sonarr/Show"), "/symlinks/sonarr/Show")
            self.assertEqual(
                _expand_scan_folders(["/mnt/symlinks/sonarr", "/symlinks/sonarr"]),
                ["/symlinks/sonarr"],
            )
            self.assertLess(LIST_TIMEOUT_SEC, 120)

        def test_folder_already_imported_skips_series_with_files(self):
            series = [{"id": 9, "title": "The Walking Dead", "statistics": {"episodeFileCount": 6}}]
            self.assertTrue(folder_already_imported("/symlinks/sonarr/The Walking Dead", series))
            empty = [{"id": 9, "title": "The Walking Dead", "statistics": {"episodeFileCount": 0}}]
            self.assertFalse(folder_already_imported("/symlinks/sonarr/The Walking Dead", empty))
            notes = []
            global log_wire
            prev = log_wire
            log_wire = notes.append
            try:
                import tempfile

                with tempfile.TemporaryDirectory() as d:
                    base = Path(d) / "sonarr"
                    (base / "The Walking Dead").mkdir(parents=True)
                    (base / "Brand New Show 2010").mkdir()
                    out = _expand_scan_folders([str(base)], series_rows=series)
                self.assertEqual([Path(p).name for p in out], ["Brand New Show 2010"])
                self.assertTrue(any("already has files" in n for n in notes))
            finally:
                log_wire = prev

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

        def test_ffprobe_d_state_count_and_backoff_message(self):
            sample = "D ffprobe\nD ffprobe\nS bash\nR ffmpeg\n"
            self.assertEqual(ffprobe_d_state_count(sample), 2)
            self.assertEqual(ffprobe_d_state_count(""), 0)
            self.assertEqual(ffprobe_d_backoff_limit(small=True), 1)
            self.assertEqual(ffprobe_d_backoff_limit(small=False), 1)
            import sys as _sys

            here = _sys.modules[__name__]
            orig_stub = here.ffprobe_is_stubbed
            here.ffprobe_is_stubbed = lambda: False
            try:
                self.assertEqual(catchup_chunk_size(catch_up=True, d_state=12), 0)
                tiny = {"ram_kb": 3_383_440, "ram_gb": 3.23, "cpus": 4, "disk_kind": "rotational", "tiny": True}
                laptop = {"ram_kb": 16 * 1024 * 1024, "ram_gb": 16.0, "cpus": 8, "disk_kind": "ssd", "tiny": False}
                self.assertEqual(import_folder_cap(catch_up=True, profile=tiny), 6)
                self.assertGreater(import_folder_cap(catch_up=True, profile=laptop), 16)
                self.assertEqual(catchup_chunk_size(catch_up=True, d_state=0, profile=tiny), 8)
                self.assertGreater(catchup_chunk_size(catch_up=True, d_state=0, profile=laptop), 8)
                here.ffprobe_is_stubbed = lambda: True
                self.assertEqual(catchup_chunk_size(catch_up=True, d_state=12, profile=tiny), 8)
            finally:
                here.ffprobe_is_stubbed = orig_stub
            msg = format_catchup_message(folder=3, total=16, skipped=4, timeouts=1, status="running")
            self.assertIn("folder 3 of 16", msg)
            self.assertIn("4 skipped", msg)
            self.assertIn("1 timeouts", msg)
            self.assertTrue(msg.startswith("Library catching up"))
            back = format_catchup_message(status="backoff")
            self.assertEqual(back, "")
            self.assertEqual(format_catchup_message(status="idle"), "")

        def test_splash_lock_only_when_running_and_needs_import(self):
            import tempfile
            from pathlib import Path as _P
            global PROGRESS_PATH, LIBRARY_LOG
            old_p, old_l = PROGRESS_PATH, LIBRARY_LOG
            td = tempfile.TemporaryDirectory()
            PROGRESS_PATH = _P(td.name) / "library-progress.json"
            LIBRARY_LOG = _P(td.name) / "library.log"
            try:
                row = write_library_progress(status="running", needsImport=True, folder=2, total=6, skipped=1)
                self.assertEqual(row["splashLock"], True)
                self.assertIn("Library catching up", row["message"])
                row = write_library_progress(status="running", needsImport=False, skipped=12, total=0)
                self.assertEqual(row["splashLock"], False)
                row = write_library_progress(status="backoff", needsImport=True)
                self.assertEqual(row["splashLock"], False)
                self.assertEqual(row["status"], "idle")
                self.assertEqual(row.get("message") or "", "")
                row = write_library_progress(status="done", needsImport=False)
                self.assertEqual(row["splashLock"], False)
            finally:
                PROGRESS_PATH, LIBRARY_LOG = old_p, old_l
                td.cleanup()

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Matching)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit("sonarr_manual_import.py is loaded by wire-engines / stuck-downloads")
