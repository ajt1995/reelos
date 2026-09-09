#!/usr/bin/env python3
"""ReelOS: stop TorBox/Decypharr re-add spam and purge stuck 0% *arr queue items.

Piggybacks on reelos-lock-clients.timer (OTA copies this file to /opt/reelos/bin).
Does not talk to the swarm. Does not add indexers.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
COMPOSE = ROOT / "compose"
STATE = Path(os.environ.get("REELOS_STATE", "/var/lib/reelos"))
DECYPHARR = "http://127.0.0.1:8282"

STUCK_ZERO_SEC = int(os.environ.get("REELOS_STUCK_DOWNLOAD_SEC", "900"))
STUCK_SYMLINK_SEC = int(os.environ.get("REELOS_STUCK_SYMLINK_SEC", "180"))
IMPORT_RETRY_SEC = int(os.environ.get("REELOS_IMPORT_RETRY_SEC", "90"))
FUSE_RESTART_BACKOFF = 300
MEDIA_EXT = {".mkv", ".mp4", ".m4v", ".avi", ".ts", ".m2ts", ".iso"}

PRESENT_STATES = {
    "queued",
    "downloading",
    "paused",
    "stalled",
    "checking",
    "uploading",
    "stalledup",
    "queuedup",
    "metadl",
    "allocating",
    "moving",
    "unknown",
    "cached",
    "completed",
    "seeding",
    "pausedup",
    "checkingup",
    "forcedup",
    "forceddl",
    "stalleddl",
    "queueddl",
    "checkingdl",
}
ERROR_STATES = {"error", "missingfiles", "failed"}

APPS = [
    {
        "name": "radarr",
        "xml": COMPOSE / "configs" / "radarr" / "config.xml",
        "base": "http://127.0.0.1:7878/api/v3",
        "queue_extra": "includeUnknownMovieItems=true&includeMovie=true",
        "media_key": "movie",
        "category": "radarr",
    },
    {
        "name": "sonarr",
        "xml": COMPOSE / "configs" / "sonarr" / "config.xml",
        "base": "http://127.0.0.1:8989/api/v3",
        "queue_extra": "includeUnknownSeriesItems=true&includeSeries=true",
        "media_key": "series",
        "category": "sonarr",
    },
]


def normalize_hash(value: str) -> str:
    s = str(value or "").strip().lower()
    if "btih:" in s:
        s = s.split("btih:", 1)[1]
        s = s.split("&", 1)[0]
        s = s.split("/", 1)[0]
    return "".join(c for c in s if c.isalnum())


def torrent_is_present(t: dict) -> bool:
    state = str(t.get("state") or "").lower()
    if state in ERROR_STATES:
        return False
    try:
        if float(t.get("progress") or 0) >= 0.999:
            return True
    except (TypeError, ValueError):
        pass
    if t.get("cached") or t.get("is_cached"):
        return True
    if state in PRESENT_STATES or state == "":
        return True
    return bool(normalize_hash(t.get("hash") or t.get("infohash") or t.get("infoHash") or ""))


def should_submit_hash(infohash: str, torrents: list) -> bool:
    """False when Decypharr already has this hash queued/active/cached."""
    h = normalize_hash(infohash)
    if not h:
        return True
    for t in torrents or []:
        if not isinstance(t, dict):
            continue
        th = normalize_hash(t.get("hash") or t.get("infohash") or t.get("infoHash") or "")
        if th == h and torrent_is_present(t):
            return False
    return True


def queue_progress_ratio(item: dict) -> float | None:
    size = item.get("size") or 0
    sizeleft = item.get("sizeleft")
    try:
        size_n = float(size)
        if size_n > 0 and sizeleft is not None:
            return max(0.0, min(1.0, (size_n - float(sizeleft)) / size_n))
    except (TypeError, ValueError):
        pass
    if item.get("progress") is not None:
        try:
            p = float(item["progress"])
            return p / 100.0 if p > 1.0 else p
        except (TypeError, ValueError):
            return None
    return None


def content_path_of(item: dict) -> str:
    return str(
        item.get("outputPath")
        or item.get("content_path")
        or item.get("contentPath")
        or ""
    ).strip()


def path_candidates(path: str) -> list[str]:
    """Host + in-container *arr paths: /symlinks ↔ /mnt/symlinks, colon-safe names."""
    if not path:
        return []
    out: list[str] = [path]
    if path.startswith("/symlinks"):
        out.append("/mnt" + path)
    if path.startswith("/mnt/symlinks"):
        out.append(path[4:])
    p = Path(path)
    sanitized = safe_folder_name(p.name)
    if sanitized != p.name:
        out.append(str(p.with_name(sanitized)))
        if path.startswith("/symlinks"):
            out.append(str(Path("/mnt" + path).with_name(sanitized)))
    seen: set[str] = set()
    uniq: list[str] = []
    for raw in out:
        if raw not in seen:
            seen.add(raw)
            uniq.append(raw)
    return uniq


def status_message_blob(item: dict) -> str:
    parts: list[str] = []
    for sm in item.get("statusMessages") or []:
        if isinstance(sm, str):
            parts.append(sm)
            continue
        if not isinstance(sm, dict):
            continue
        if sm.get("title"):
            parts.append(str(sm["title"]))
        for m in sm.get("messages") or []:
            parts.append(str(m))
    return " ".join(parts).lower()


def item_has_file(item: dict) -> bool:
    if item.get("hasFile") is True:
        return True
    for key in ("movie", "series", "episode"):
        media = item.get(key)
        if not isinstance(media, dict):
            continue
        if media.get("hasFile") is True:
            return True
        stats = media.get("statistics") if isinstance(media.get("statistics"), dict) else {}
        try:
            if int(stats.get("movieFileCount") or 0) > 0:
                return True
            if int(stats.get("episodeFileCount") or 0) > 0:
                return True
        except (TypeError, ValueError):
            pass
    return False


def import_is_stuck(item: dict) -> bool:
    """Decypharr finished; *arr left the row completed/importPending (Night at the Museum)."""
    if item_has_file(item):
        return False
    status = str(item.get("status") or "").lower()
    tracked = str(item.get("trackedDownloadStatus") or "").lower()
    state = str(item.get("trackedDownloadState") or "").lower()
    blob = status_message_blob(item)
    if state in {"importpending", "importblocked", "importfailed"}:
        return True
    if status in {"completed", "delay"} and tracked in {"warning", "error"}:
        return True
    if "unexpected error" in blob or "processing file" in blob:
        return True
    return False


def debrid_complete(debrid: dict | None) -> bool:
    if not debrid:
        return False
    try:
        if float(debrid.get("progress") or 0) >= 0.999:
            return True
    except (TypeError, ValueError):
        pass
    if debrid.get("cached") or debrid.get("is_cached"):
        return True
    state = str(debrid.get("state") or "").lower()
    return state in {
        "uploading",
        "stalledup",
        "pausedup",
        "queuedup",
        "checkingup",
        "forcedup",
        "seeding",
    }


def safe_folder_name(name: str) -> str:
    s = str(name or "").replace(":", " -").replace("/", "-").replace("\\", "-")
    return s.strip(" .")


def decide_queue_action(
    item: dict,
    *,
    now: float,
    first_seen: float | None,
    last_progress: float | None,
    threshold_sec: int,
    symlink_threshold_sec: int,
    debrid: dict | None,
    path_exists: bool,
    recover_attempted: bool,
    duplicate_of_active: bool = False,
    path_readable: bool | None = None,
    last_retry: float | None = None,
    retry_interval_sec: int = 90,
) -> str:
    """ignore | wait | recover | retry_import | fail | fail_duplicate"""
    if path_readable is None:
        path_readable = path_exists
    if duplicate_of_active:
        return "fail_duplicate"
    if item_has_file(item):
        return "ignore"
    status = str(item.get("status") or "").lower()
    tracked = str(item.get("trackedDownloadStatus") or "").lower()
    state = str(item.get("trackedDownloadState") or "").lower()
    if import_is_stuck(item):
        if path_readable:
            if last_retry is None or (now - last_retry) >= retry_interval_sec:
                return "retry_import"
            return "wait"
        if debrid_complete(debrid) and not path_exists:
            if not recover_attempted:
                return "recover"
            if first_seen is not None and (now - first_seen) >= symlink_threshold_sec:
                return "fail"
            return "wait"
        return "wait"
    if "fail" in status or tracked == "error" or "fail" in state:
        return "fail"
    ratio = queue_progress_ratio(item)
    if path_exists and ratio is not None and ratio >= 0.999:
        return "ignore"
    if status in {"completed", "delay"} and path_exists:
        return "ignore"

    if debrid_complete(debrid) and not path_exists:
        if not recover_attempted:
            return "recover"
        if first_seen is not None and (now - first_seen) >= symlink_threshold_sec:
            return "fail"
        return "wait"

    progressed = (last_progress or 0) > 0.001 or (ratio or 0) > 0.001
    if not progressed and (ratio is None or ratio <= 0.001):
        if first_seen is not None and (now - first_seen) >= threshold_sec:
            return "fail"
        return "wait"
    return "wait"


def extra_duplicate_queue_items(items: list) -> list:
    """Newer *arr queue rows that repeat a hash already in the queue."""
    seen: dict[str, dict] = {}
    extras: list[dict] = []

    def sort_key(it: dict) -> tuple:
        raw = str(it.get("added") or "")
        try:
            # ISO-8601 → comparable string is enough; fallback to id
            ts = raw
        except Exception:
            ts = ""
        return (ts, int(it.get("id") or 0))

    for it in sorted((i for i in items if isinstance(i, dict)), key=sort_key):
        h = normalize_hash(it.get("downloadId") or it.get("download_id") or "")
        if not h:
            continue
        if h in seen:
            extras.append(it)
        else:
            seen[h] = it
    return extras


def extra_duplicate_torrents(torrents: list) -> list:
    """Later Decypharr rows that share a hash (detection only; delete needs a distinct id)."""
    best: dict[str, dict] = {}
    extras: list[dict] = []
    for t in torrents or []:
        if not isinstance(t, dict):
            continue
        h = normalize_hash(t.get("hash") or t.get("infohash") or t.get("infoHash") or "")
        if not h:
            continue
        prev = best.get(h)
        if prev is None:
            best[h] = t
            continue
        try:
            t_prog = float(t.get("progress") or 0)
            p_prog = float(prev.get("progress") or 0)
        except (TypeError, ValueError):
            t_prog = p_prog = 0.0
        t_added = t.get("added_on") or t.get("completion_on") or 0
        p_added = prev.get("added_on") or prev.get("completion_on") or 0
        if t_prog > p_prog or (t_prog == p_prog and t_added and t_added < p_added):
            extras.append(prev)
            best[h] = t
        else:
            extras.append(t)
    return extras


def fuse_stale(path: str = "/mnt/debrid") -> bool:
    try:
        os.listdir(path)
        return False
    except OSError as e:
        msg = str(e).lower()
        return "not connected" in msg or getattr(e, "errno", None) in (107, 116)


def title_id_of(item: dict, media_key: str) -> str | None:
    media = item.get(media_key) if isinstance(item.get(media_key), dict) else {}
    tmdb = media.get("tmdbId") or item.get("tmdbId")
    if not tmdb:
        return None
    if media_key == "series" or item.get("seriesId"):
        return f"tmdb-tv-{tmdb}"
    return f"tmdb-{tmdb}"


def source() -> str:
    env = COMPOSE / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SOURCE="):
                return line.split("=", 1)[1].strip()
    answers = STATE / "answers.json"
    if answers.exists():
        try:
            return json.loads(answers.read_text()).get("source") or "real-debrid"
        except json.JSONDecodeError:
            pass
    return "real-debrid"


def api_key(xml_path: Path) -> str | None:
    if not xml_path.exists():
        return None
    try:
        node = ET.parse(xml_path).getroot().find("ApiKey")
    except ET.ParseError:
        return None
    if node is None or not node.text:
        return None
    return node.text.strip()


def call(url: str, key: str | None = None, method: str = "GET", body=None, form: str | None = None):
    data = None
    headers = {}
    if form is not None:
        data = form.encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if key:
        headers["X-Api-Key"] = key
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        raw = resp.read()
        if not raw:
            return None
        try:
            return json.loads(raw.decode())
        except json.JSONDecodeError:
            return raw.decode()


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        with (STATE / "stuck-downloads.log").open("a") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path: Path, data) -> None:
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2) + "\n")
    except OSError:
        pass


def write_note(title_id: str | None, reason: str) -> None:
    if not title_id:
        return
    notes = load_json(STATE / "stuck-notes.json", {})
    if not isinstance(notes, dict):
        notes = {}
    notes[title_id] = {"status": "failed", "reason": reason, "at": int(time.time())}
    save_json(STATE / "stuck-notes.json", notes)


def path_is_visible(path: str) -> bool:
    for raw in path_candidates(path):
        if _dir_has_media(Path(raw)):
            return True
    return False


def _can_stat_media(p: Path) -> bool:
    """Follow symlink into FUSE. ENOTCONN/EIO → not ready."""
    try:
        return p.stat().st_size > 0
    except OSError:
        return False


def path_is_readable(path: str) -> bool:
    """True when a media file under path is a live FUSE/target, not a dangling symlink."""
    for raw in path_candidates(path):
        p = Path(raw)
        try:
            if p.is_file() or p.is_symlink():
                if _can_stat_media(p):
                    return True
            if not p.is_dir():
                continue
            for x in p.iterdir():
                if x.suffix.lower() in MEDIA_EXT and _can_stat_media(x):
                    return True
                if (x.is_file() or x.is_symlink()) and _can_stat_media(x):
                    return True
                if not x.is_dir():
                    continue
                for y in x.iterdir():
                    if y.suffix.lower() in MEDIA_EXT and _can_stat_media(y):
                        return True
                    if (y.is_file() or y.is_symlink()) and _can_stat_media(y):
                        return True
        except OSError:
            continue
    return False


def _dir_has_media(p: Path) -> bool:
    try:
        if p.is_file() or p.is_symlink():
            return True
        if not p.is_dir():
            return False
        for x in p.iterdir():
            if x.is_file() or x.is_symlink():
                return True
            if x.is_dir():
                for y in x.iterdir():
                    if y.is_file() or y.is_symlink():
                        return True
    except OSError:
        return False
    return False


def decypharr_torrents() -> list:
    try:
        rows = call(f"{DECYPHARR}/api/v2/torrents/info")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return []
    return rows if isinstance(rows, list) else []


def torrent_for_hash(torrents: list, infohash: str) -> dict | None:
    h = normalize_hash(infohash)
    if not h:
        return None
    for t in torrents:
        th = normalize_hash(t.get("hash") or t.get("infohash") or t.get("infoHash") or "")
        if th == h:
            return t
    return None


def queue_records(app: dict, key: str) -> list:
    url = f"{app['base']}/queue?page=1&pageSize=200&{app['queue_extra']}"
    try:
        data = call(url, key)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        rows = data.get("records") or []
        return [x for x in rows if isinstance(x, dict)]
    return []


def fail_queue_item(app: dict, key: str, item: dict, *, remove_from_client: bool, reason: str) -> None:
    qid = item.get("id")
    if qid is None:
        return
    qs = urllib.parse.urlencode(
        {
            "removeFromClient": "true" if remove_from_client else "false",
            "blocklist": "true",
            "skipRedownload": "true",
        }
    )
    try:
        call(f"{app['base']}/queue/{qid}?{qs}", key, method="DELETE")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        log(f"{app['name']} queue {qid} delete {type(e).__name__} {e}")
        return
    title = item.get("title") or item.get("downloadId") or qid
    log(f"{app['name']} fail {title} removeClient={remove_from_client} — {reason}")
    write_note(title_id_of(item, app["media_key"]), reason)


def seed_failed_handling(app: dict, key: str) -> None:
    url = f"{app['base']}/config/downloadclient"
    try:
        cfg = call(url, key)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return
    if not isinstance(cfg, dict):
        return
    changed = False
    for field in ("autoRedownloadFailed", "autoRedownloadFailedFromInteractiveSearch"):
        if cfg.get(field):
            cfg[field] = False
            changed = True
    if not changed:
        return
    try:
        call(url, key, method="PUT", body=cfg)
        log(f"{app['name']} autoRedownloadFailed off")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        log(f"{app['name']} downloadclient config {type(e).__name__} {e}")


def heal_fuse_if_stale(state: dict) -> bool:
    if not fuse_stale():
        return False
    last = float(state.get("fuseRestartAt") or 0)
    now = time.time()
    if now - last < FUSE_RESTART_BACKOFF:
        log("fuse stale — backoff")
        return True
    log("fuse Socket not connected — remount decypharr and restart *arr readers")
    subprocess.run(["docker", "restart", "decypharr"], check=False, capture_output=True)
    time.sleep(4)
    for name in ("reelos-jellyfin-1", "reelos-radarr-1", "reelos-sonarr-1"):
        subprocess.run(["docker", "restart", name], check=False, capture_output=True)
    state["fuseRestartAt"] = now
    return True


def kick_import() -> None:
    wire = Path(__file__).resolve().with_name("wire-engines.py")
    if not wire.is_file():
        return
    log("recover — wire-engines import (relink + *arr scan)")
    try:
        subprocess.run([sys.executable, str(wire), "import"], check=False, timeout=120)
    except Exception as e:
        log(f"import {type(e).__name__} {e}")


def movie_id_of(item: dict) -> int | None:
    raw = item.get("movieId")
    if raw:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    movie = item.get("movie") if isinstance(item.get("movie"), dict) else {}
    if movie.get("id"):
        try:
            return int(movie["id"])
        except (TypeError, ValueError):
            pass
    return None


def retry_arr_import(app: dict, key: str, item: dict) -> None:
    """Re-scan + ManualImport now that FUSE can stat the file. Does not re-add to TorBox."""
    path = content_path_of(item)
    scan_name = "DownloadedMoviesScan" if app["name"] == "radarr" else "DownloadedEpisodesScan"
    folders = path_candidates(path)
    if not folders:
        folders = [f"/mnt/symlinks/{app['category']}", "/mnt/symlinks"]
    for folder in folders:
        try:
            call(
                f"{app['base']}/command",
                key,
                method="POST",
                body={"name": scan_name, "path": folder},
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            log(f"{app['name']} scan {folder} {type(e).__name__} {e}")
    try:
        call(
            f"{app['base']}/command",
            key,
            method="POST",
            body={"name": "RefreshMonitoredDownloads"},
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        log(f"{app['name']} refresh downloads {type(e).__name__} {e}")
    if app["name"] == "radarr":
        _radarr_manual_import(app, key, item, folders)


def _radarr_manual_import(app: dict, key: str, item: dict, folders: list[str]) -> None:
    movie_id = movie_id_of(item)
    files: list[dict] = []
    download_id = str(item.get("downloadId") or "")
    for folder in folders:
        qs = {"folder": folder, "filterExistingFiles": "false"}
        if download_id:
            qs["downloadId"] = download_id
        try:
            rows = call(f"{app['base']}/manualimport?{urllib.parse.urlencode(qs)}", key)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            log(f"{app['name']} manualimport list {folder} {type(e).__name__} {e}")
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            pth = row.get("path")
            if not pth or Path(pth).suffix.lower() not in MEDIA_EXT:
                continue
            movie = row.get("movie") if isinstance(row.get("movie"), dict) else {}
            mid = movie.get("id") or movie_id
            if not mid:
                continue
            files.append(
                {
                    "path": pth,
                    "movieId": mid,
                    "quality": row.get("quality")
                    or {"quality": {"id": 1}, "revision": {"version": 1, "real": 0}},
                    "languages": row.get("languages") or [{"id": 1}],
                    "indexerFlags": row.get("indexerFlags") or 0,
                }
            )
    by_path = {f["path"]: f for f in files}
    files = list(by_path.values())
    if not files:
        return
    try:
        call(
            f"{app['base']}/command",
            key,
            method="POST",
            body={"name": "ManualImport", "files": files[:20], "importMode": "copy"},
        )
        log(f"{app['name']} manualimport {len(files[:20])} files")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        log(f"{app['name']} manualimport {type(e).__name__} {e}")


def sweep() -> int:
    if source() == "local-vpn":
        return 0
    now = time.time()
    state = load_json(STATE / "stuck-downloads.json", {})
    if not isinstance(state, dict):
        state = {}
    seen = state.get("seen") if isinstance(state.get("seen"), dict) else {}
    live_keys: set[str] = set()
    if heal_fuse_if_stale(state):
        time.sleep(6)
        if not fuse_stale():
            log("fuse green — retry *arr import")
            kick_import()
        state["seen"] = seen
        save_json(STATE / "stuck-downloads.json", state)
        return 0

    torrents = decypharr_torrents()
    extras = extra_duplicate_torrents(torrents)
    if extras:
        log(f"decypharr duplicate hashes={len(extras)} (not deleting by hash — would drop the live add)")

    recover = False
    for app in APPS:
        key = api_key(app["xml"])
        if not key:
            continue
        seed_failed_handling(app, key)
        records = queue_records(app, key)
        extra_ids = {id(x) for x in extra_duplicate_queue_items(records)}
        for item in records:
            download_id = str(item.get("downloadId") or "")
            h = normalize_hash(download_id)
            sk = f"{app['name']}:{h or item.get('id')}"
            live_keys.add(sk)
            prev = seen.get(sk) if isinstance(seen.get(sk), dict) else {}
            first_seen = prev.get("firstSeen")
            if first_seen is None:
                first_seen = now
            ratio = queue_progress_ratio(item) or 0.0
            last_progress = prev.get("lastProgress")
            if ratio > (last_progress or 0):
                last_progress = ratio
            debrid = torrent_for_hash(torrents, download_id)
            path = content_path_of(item)
            exists = path_is_visible(path)
            readable = path_is_readable(path) if exists else False
            action = decide_queue_action(
                item,
                now=now,
                first_seen=first_seen,
                last_progress=last_progress,
                threshold_sec=STUCK_ZERO_SEC,
                symlink_threshold_sec=STUCK_SYMLINK_SEC,
                debrid=debrid,
                path_exists=exists,
                recover_attempted=bool(prev.get("recoverAt")),
                duplicate_of_active=id(item) in extra_ids,
                path_readable=readable,
                last_retry=prev.get("retryAt"),
                retry_interval_sec=IMPORT_RETRY_SEC,
            )
            title = item.get("title") or download_id or sk
            if action == "fail_duplicate":
                fail_queue_item(
                    app,
                    key,
                    item,
                    remove_from_client=False,
                    reason="Same torrent hash already queued — not re-adding to TorBox",
                )
                seen.pop(sk, None)
                continue
            if action == "recover":
                log(f"{app['name']} recover {title} — debrid done, symlink path missing")
                recover = True
                seen[sk] = {
                    "firstSeen": first_seen,
                    "lastProgress": last_progress or 0.0,
                    "recoverAt": now,
                    "retryAt": prev.get("retryAt"),
                }
                continue
            if action == "retry_import":
                log(
                    f"{app['name']} retry import {title} — "
                    f"importPending/unexpected error, FUSE readable"
                )
                retry_arr_import(app, key, item)
                recover = True
                seen[sk] = {
                    "firstSeen": first_seen,
                    "lastProgress": last_progress or 0.0,
                    "recoverAt": prev.get("recoverAt"),
                    "retryAt": now,
                }
                continue
            if action == "fail":
                if debrid_complete(debrid) and not exists:
                    reason = "Cached on TorBox but symlink/import path never appeared"
                else:
                    reason = f"Stuck at 0% for {STUCK_ZERO_SEC}s — cleared, not re-grabbed"
                fail_queue_item(app, key, item, remove_from_client=True, reason=reason)
                seen.pop(sk, None)
                continue
            if action == "ignore":
                seen.pop(sk, None)
                continue
            seen[sk] = {
                "firstSeen": first_seen,
                "lastProgress": last_progress or 0.0,
                "recoverAt": prev.get("recoverAt"),
                "retryAt": prev.get("retryAt"),
            }

    if recover:
        kick_import()

    state["seen"] = {k: v for k, v in seen.items() if k in live_keys}
    save_json(STATE / "stuck-downloads.json", state)
    return 0


def _self_test() -> int:
    import unittest

    class Guards(unittest.TestCase):
        def test_normalize_hash_plain(self):
            self.assertEqual(normalize_hash("ABCDEF12"), "abcdef12")

        def test_normalize_hash_magnet(self):
            self.assertEqual(
                normalize_hash("magnet:?xt=urn:btih:AaBbCcDdEeFf0011&dn=x"),
                "aabbccddeeff0011",
            )

        def test_no_readd_when_queued(self):
            self.assertFalse(
                should_submit_hash("aabb", [{"hash": "AABB", "state": "downloading"}])
            )

        def test_no_readd_when_cached(self):
            self.assertFalse(
                should_submit_hash(
                    "aabb",
                    [{"hash": "aabb", "progress": 1.0, "state": "uploading", "cached": True}],
                )
            )

        def test_readd_when_unknown(self):
            self.assertTrue(
                should_submit_hash("deadbeef", [{"hash": "aabb", "state": "downloading"}])
            )

        def test_readd_when_only_error(self):
            self.assertTrue(should_submit_hash("aabb", [{"hash": "aabb", "state": "error"}]))

        def test_zero_wait_under_threshold(self):
            item = {
                "status": "downloading",
                "trackedDownloadStatus": "ok",
                "size": 100,
                "sizeleft": 100,
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1000,
                    first_seen=900,
                    last_progress=0,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid=None,
                    path_exists=False,
                    recover_attempted=False,
                ),
                "wait",
            )

        def test_zero_fail_over_threshold(self):
            item = {
                "status": "downloading",
                "trackedDownloadStatus": "ok",
                "size": 100,
                "sizeleft": 100,
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1000,
                    last_progress=0,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid=None,
                    path_exists=False,
                    recover_attempted=False,
                ),
                "fail",
            )

        def test_cached_no_path_recover_then_fail(self):
            item = {"status": "downloading", "size": 100, "sizeleft": 100}
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1000,
                    first_seen=999,
                    last_progress=0,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"progress": 1.0, "state": "uploading"},
                    path_exists=False,
                    recover_attempted=False,
                ),
                "recover",
            )
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1300,
                    first_seen=1000,
                    last_progress=0,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"cached": True},
                    path_exists=False,
                    recover_attempted=True,
                ),
                "fail",
            )

        def test_has_path_complete_ignore(self):
            item = {
                "status": "downloading",
                "size": 100,
                "sizeleft": 0,
                "outputPath": "/mnt/symlinks/radarr/X",
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"progress": 1},
                    path_exists=True,
                    recover_attempted=False,
                ),
                "ignore",
            )

        def test_duplicate_queue_marks_newer(self):
            items = [
                {"id": 1, "downloadId": "AA", "added": "2026-01-01T00:00:00Z"},
                {"id": 2, "downloadId": "aa", "added": "2026-01-01T00:05:00Z"},
            ]
            extras = extra_duplicate_queue_items(items)
            self.assertEqual([x["id"] for x in extras], [2])
            self.assertEqual(
                decide_queue_action(
                    extras[0],
                    now=10,
                    first_seen=10,
                    last_progress=0,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid=None,
                    path_exists=False,
                    recover_attempted=False,
                    duplicate_of_active=True,
                ),
                "fail_duplicate",
            )

        def test_safe_folder_colon(self):
            self.assertEqual(safe_folder_name("Spider-Man: Homecoming"), "Spider-Man - Homecoming")

        def test_path_candidates_symlinks_vs_mnt(self):
            self.assertIn("/mnt/symlinks/radarr/X", path_candidates("/symlinks/radarr/X"))
            self.assertIn("/symlinks/radarr/X", path_candidates("/mnt/symlinks/radarr/X"))

        def test_import_pending_unexpected_error_retries_when_readable(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "warning",
                "trackedDownloadState": "importPending",
                "statusMessages": [
                    {
                        "title": "Night at the Museum",
                        "messages": ["Unexpected error processing file"],
                    }
                ],
                "size": 100,
                "sizeleft": 0,
                "outputPath": "/mnt/symlinks/radarr/Night at the Museum",
                "movie": {"hasFile": False, "title": "Night at the Museum"},
            }
            self.assertTrue(import_is_stuck(item))
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"progress": 1, "cached": True},
                    path_exists=True,
                    recover_attempted=False,
                    path_readable=True,
                ),
                "retry_import",
            )

        def test_import_pending_wait_when_fuse_not_readable(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "warning",
                "trackedDownloadState": "importPending",
                "statusMessages": [{"messages": ["Unexpected error processing file"]}],
                "size": 100,
                "sizeleft": 0,
                "movie": {"hasFile": False},
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"cached": True},
                    path_exists=True,
                    recover_attempted=True,
                    path_readable=False,
                ),
                "wait",
            )

        def test_import_pending_hasfile_ignore(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "warning",
                "trackedDownloadState": "importPending",
                "movie": {"hasFile": True},
                "size": 100,
                "sizeleft": 0,
            }
            self.assertFalse(import_is_stuck(item))
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"progress": 1},
                    path_exists=True,
                    recover_attempted=False,
                    path_readable=True,
                ),
                "ignore",
            )

        def test_import_pending_error_status_does_not_fail(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "error",
                "trackedDownloadState": "importPending",
                "statusMessages": [{"messages": ["Unexpected error processing file"]}],
                "movie": {"hasFile": False},
                "size": 100,
                "sizeleft": 0,
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=2000,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"cached": True},
                    path_exists=True,
                    recover_attempted=False,
                    path_readable=True,
                ),
                "retry_import",
            )

        def test_import_pending_retry_rate_limit(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "warning",
                "trackedDownloadState": "importPending",
                "movie": {"hasFile": False},
                "size": 100,
                "sizeleft": 0,
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1089,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"cached": True},
                    path_exists=True,
                    recover_attempted=False,
                    path_readable=True,
                    last_retry=1000,
                    retry_interval_sec=90,
                ),
                "wait",
            )
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1090,
                    first_seen=1,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"cached": True},
                    path_exists=True,
                    recover_attempted=False,
                    path_readable=True,
                    last_retry=1000,
                    retry_interval_sec=90,
                ),
                "retry_import",
            )

        def test_import_pending_missing_symlink_still_recovers(self):
            item = {
                "status": "completed",
                "trackedDownloadStatus": "warning",
                "trackedDownloadState": "importPending",
                "movie": {"hasFile": False},
            }
            self.assertEqual(
                decide_queue_action(
                    item,
                    now=1000,
                    first_seen=999,
                    last_progress=1,
                    threshold_sec=900,
                    symlink_threshold_sec=180,
                    debrid={"progress": 1.0},
                    path_exists=False,
                    recover_attempted=False,
                    path_readable=False,
                ),
                "recover",
            )

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Guards)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit(sweep())
