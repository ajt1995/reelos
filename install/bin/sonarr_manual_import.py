"""Sonarr ManualImport harden for ReelOS dump folders. Loaded by wire-engines.py."""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Injected by wire-engines.py before use:
call = None  # type: ignore
log_wire = None  # type: ignore

def _ep_tag(name: str) -> tuple[int, int] | None:
    """Parse SxxExx from a dump filename; tolerate double spaces / odd dashes."""
    m = re.search(r"[Ss](\d{1,2})\s*[EeXx](\d{1,3})", name.replace("  ", " "))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _series_title_guess(path: str) -> str:
    name = Path(path).name
    parent = Path(path).parent.name
    for raw in (parent, name):
        cleaned = re.sub(r"\s+", " ", raw).strip()
        cleaned = re.split(r"\s[-–]\s*[Ss]\d", cleaned, maxsplit=1)[0]
        cleaned = re.sub(r"\s*\(\d{4}\)\s*$", "", cleaned).strip(" .-_")
        if cleaned and not re.fullmatch(r"[Ss]\d+[Ee]\d+", cleaned):
            return cleaned
    return ""


def _sonarr_series_map(sk: str) -> list[dict]:
    try:
        rows = call("http://127.0.0.1:8989/api/v3/series", sk) or []
    except Exception as e:
        log_wire(f"sonarr series list {type(e).__name__} {e}")
        return []
    return [r for r in rows if isinstance(r, dict) and r.get("id")]


def _match_series(series_rows: list[dict], guess: str) -> dict | None:
    if not guess:
        return None
    g = re.sub(r"[^a-z0-9]+", "", guess.lower())
    best = None
    best_score = 0
    for s in series_rows:
        titles = [s.get("title") or "", s.get("sortTitle") or ""]
        titles += [a.get("title") or "" for a in (s.get("alternateTitles") or []) if isinstance(a, dict)]
        for t in titles:
            n = re.sub(r"[^a-z0-9]+", "", t.lower())
            if not n:
                continue
            if n == g:
                return s
            if g in n or n in g:
                score = min(len(g), len(n))
                if score > best_score:
                    best, best_score = s, score
    return best


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


def _series_file_count(sk: str, series_id: int) -> int:
    try:
        s = call(f"http://127.0.0.1:8989/api/v3/series/{series_id}", sk) or {}
        return int((s.get("statistics") or {}).get("episodeFileCount") or 0)
    except Exception:
        return -1


def sonarr_manual_import(sk: str) -> None:
    """Dump folders are not a series library. Copy matched episodes into the series folder."""
    folders = ["/mnt/symlinks/sonarr", "/mnt/symlinks"]
    rows: list = []
    for folder in folders:
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
    # de-dupe by path
    by_path: dict[str, dict] = {}
    for row in rows:
        if isinstance(row, dict) and row.get("path"):
            by_path[row["path"]] = row
    rows = list(by_path.values())

    series_rows = _sonarr_series_map(sk)
    ep_cache: dict = {}
    files = []
    unmatched = 0
    sample_unmatched: list[str] = []
    for row in rows:
        path = row.get("path")
        if not path or not str(path).lower().endswith((".mkv", ".mp4", ".m4v", ".avi", ".ts", ".m2ts")):
            continue
        series = row.get("series") or {}
        episodes = row.get("episodes") or []
        series_id = series.get("id")
        episode_ids = [e["id"] for e in episodes if isinstance(e, dict) and e.get("id")]

        if not series_id or not episode_ids:
            tag = _ep_tag(Path(path).name) or _ep_tag(Path(path).parent.name)
            if not series_id:
                hit = _match_series(series_rows, _series_title_guess(path))
                if hit:
                    series_id = hit["id"]
                    series = hit
            if series_id and tag and not episode_ids:
                episode_ids = _episode_ids_for(sk, int(series_id), tag[0], tag[1], ep_cache)

        if not path or not series_id or not episode_ids:
            unmatched += 1
            if len(sample_unmatched) < 5:
                sample_unmatched.append(Path(path).name if path else "?")
            continue
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
        files.append(item)

    log_wire(f"sonarr manualimport matched={len(files)} unmatched={unmatched}")
    if sample_unmatched:
        log_wire("sonarr manualimport unmatched sample: " + " | ".join(sample_unmatched))
    if not files:
        return

    # Prefer series that still have zero files (Rick and Morty), but import all matched.
    before = {}
    for sid in {f["seriesId"] for f in files}:
        before[sid] = _series_file_count(sk, int(sid))

    # Chunk to keep Sonarr command payloads sane.
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

    # Wait for episodeFileCount to move — 4K copy over FUSE can exceed 8s.
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



def bind(*, call_fn, log_fn):
    global call, log_wire
    call = call_fn
    log_wire = log_fn
