#!/usr/bin/env python3
"""ReelOS: stop TorBox/Decypharr re-add spam and purge stuck 0% *arr queue items.

Piggybacks on reelos-lock-clients.timer (OTA copies this file to /opt/reelos/bin).
Does not talk to the swarm. Does not add indexers.
"""
from __future__ import annotations

import json
import os
import re
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
SEARCH_INTERVAL_SEC = int(os.environ.get("REELOS_MISSING_SEARCH_SEC", "900"))
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


def queue_season_key(item: dict) -> str | None:
    """seriesId+season so a second Seerr grab of the same season is an extra."""
    series = item.get("series") if isinstance(item.get("series"), dict) else {}
    sid = item.get("seriesId") or series.get("id")
    if not sid:
        return None
    season = item.get("seasonNumber")
    ep = item.get("episode") if isinstance(item.get("episode"), dict) else {}
    if season is None:
        season = ep.get("seasonNumber")
    if season is None:
        for e in item.get("episodes") or []:
            if isinstance(e, dict) and e.get("seasonNumber") is not None:
                season = e.get("seasonNumber")
                break
    if season is None:
        title = str(item.get("title") or "")
        m = re.search(r"[Ss](\d{1,2})", title)
        season = int(m.group(1)) if m else None
    if season is None:
        return None
    try:
        return f"series:{int(sid)}:s{int(season)}"
    except (TypeError, ValueError):
        return None


def is_season_pack_row(item: dict) -> bool:
    """True for a whole-season grab, not one SxxExx queue row."""
    ep = item.get("episode") if isinstance(item.get("episode"), dict) else {}
    if ep.get("episodeNumber"):
        return False
    eps = [e for e in (item.get("episodes") or []) if isinstance(e, dict)]
    if len(eps) == 1 and eps[0].get("episodeNumber") and not eps[0].get("seasonNumber"):
        return False
    if len(eps) == 1 and eps[0].get("episodeNumber") and len(eps) < 2:
        title = str(item.get("title") or "")
        if re.search(r"[Ss]\d{1,2}\s*[Ee]\d", title) or re.search(r"\d{1,2}[xX]\d", title):
            return False
    title = str(item.get("title") or "")
    if re.search(r"[Ss]\d{1,2}\s*[.\-_ ]?\s*[Ee]\d", title):
        return False
    return queue_season_key(item) is not None


def extra_duplicate_queue_items(items: list) -> list:
    """Newer *arr queue rows that repeat a hash, or a second season-pack of the same series+season."""
    seen: dict[str, dict] = {}
    seen_season: dict[str, dict] = {}
    extras: list[dict] = []

    def sort_key(it: dict) -> tuple:
        raw = str(it.get("added") or "")
        return (raw, int(it.get("id") or 0))

    for it in sorted((i for i in items if isinstance(i, dict)), key=sort_key):
        marked = False
        h = normalize_hash(it.get("downloadId") or it.get("download_id") or "")
        if h:
            if h in seen:
                extras.append(it)
                marked = True
            else:
                seen[h] = it
        if is_season_pack_row(it):
            sk = queue_season_key(it)
            if sk:
                if sk in seen_season:
                    if not marked:
                        extras.append(it)
                else:
                    seen_season[sk] = it
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


FUSE_READERS = ("reelos-radarr-1", "reelos-sonarr-1", "reelos-jellyfin-1")


def fuse_error_is_stale(msg: str, errno: int | None = None) -> bool:
    blob = str(msg or "").lower()
    if "not connected" in blob or "transport endpoint" in blob:
        return True
    return errno in (107, 116)


def fuse_stale_host(path: str = "/mnt/debrid") -> bool:
    try:
        os.listdir(path)
        return False
    except OSError as e:
        return fuse_error_is_stale(str(e), getattr(e, "errno", None))


def docker_exec_fuse_stale(returncode: int, stderr: str, stdout: str = "") -> bool:
    """Parse `docker exec ls /mnt/debrid`. Missing/stopped container is not FUSE-stale."""
    if returncode == 0:
        return False
    blob = f"{stderr} {stdout}".lower()
    if "no such container" in blob or "is not running" in blob:
        return False
    return fuse_error_is_stale(blob)


def fuse_stale_in_container(name: str, path: str = "/mnt/debrid") -> bool:
    try:
        r = subprocess.run(
            ["docker", "exec", name, "ls", path],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return docker_exec_fuse_stale(r.returncode, r.stderr or "", r.stdout or "")


def fuse_stale(path: str = "/mnt/debrid") -> bool:
    """True if host OR *arr/Jellyfin rslave bind is ENOTCONN.

    House: host `ls /mnt/debrid` listed while radarr/sonarr `docker exec` got
    Socket not connected after Decypharr remounted and rslave did not follow.
    """
    if fuse_stale_host(path):
        return True
    for name in FUSE_READERS:
        if fuse_stale_in_container(name, path):
            return True
    return False


def make_mnt_rshared() -> None:
    subprocess.run(["mount", "--make-rshared", "/mnt"], check=False, capture_output=True)


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
    host_stale = fuse_stale_host()
    stale_readers = [n for n in FUSE_READERS if fuse_stale_in_container(n)]
    if not host_stale and not stale_readers:
        return False
    last = float(state.get("fuseRestartAt") or 0)
    now = time.time()
    if now - last < FUSE_RESTART_BACKOFF:
        log("fuse stale — backoff")
        return True
    log(
        "fuse Socket not connected — "
        f"host={'stale' if host_stale else 'ok'} "
        f"containers={','.join(stale_readers) or 'ok'} — "
        "rshared /mnt then remount/restart readers"
    )
    make_mnt_rshared()
    if host_stale:
        subprocess.run(["docker", "restart", "decypharr"], check=False, capture_output=True)
        time.sleep(4)
        make_mnt_rshared()
    for name in FUSE_READERS:
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


def _load_relink_mod():
    import importlib.util

    for raw in (
        Path(__file__).resolve().with_name("relink_dumps.py"),
        Path("/opt/reelos/bin/relink_dumps.py"),
        Path("/opt/reelos/daemon/relink_dumps.py"),
    ):
        if not raw.is_file():
            continue
        spec = importlib.util.spec_from_file_location("reelos_relink_dumps", raw)
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    return None


def _catalog_paths() -> dict:
    root = Path("/mnt/debrid/__all__")
    try:
        return {p.name.lower(): p for p in root.iterdir()}
    except OSError:
        return {}


def _dump_has_media(mod, category: str, title: str) -> bool:
    stem = mod.relink_stem(title) if mod else ""
    if len(stem) < 8:
        return False
    for root in (Path(f"/mnt/symlinks/{category}"), Path(f"/symlinks/{category}")):
        try:
            kids = list(root.iterdir())
        except OSError:
            continue
        for dump in kids:
            if not mod.stems_equal(mod.relink_stem(dump.name), stem):
                continue
            if getattr(mod, "dump_has_media", None) and mod.dump_has_media(dump):
                return True
            if path_is_readable(str(dump)):
                return True
    return False


def _torrent_for_title(title: str, torrents: list, hit) -> tuple[bool, bool]:
    has_torrent = False
    torrent_complete = False
    for t in torrents or []:
        if not isinstance(t, dict):
            continue
        tname = str(t.get("name") or t.get("title") or "")
        if hit and hit.name.lower() in tname.lower():
            return True, debrid_complete(t)
        if title and title.lower() in tname.lower():
            has_torrent = True
            torrent_complete = debrid_complete(t)
            break
    return has_torrent, torrent_complete


def _try_fill_dump(mod, category: str, title: str, hit) -> bool:
    if not mod or hit is None:
        return False
    dest = Path(f"/mnt/symlinks/{category}") / hit.name
    try:
        added = int(mod.fill_dump_from_pack(dest, hit) or 0)
    except (OSError, TypeError, ValueError):
        return False
    return added > 0 or _dump_has_media(mod, category, title)


def _should_search_missing(searched: dict, sk: str, now: float) -> bool:
    last = float(searched.get(sk) or 0)
    if last <= 0:
        return True
    return now - last >= SEARCH_INTERVAL_SEC


def recover_missing_series(app: dict, key: str, torrents: list, state: dict) -> bool:
    """0-file monitored seasons: relink from FUSE or SeasonSearch. Relink mod optional."""
    if app["name"] != "sonarr":
        return False
    try:
        series = call(f"{app['base']}/series", key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False
    if not isinstance(series, list):
        return False
    mod = _load_relink_mod()
    catalog = _catalog_paths() if mod else {}
    searched = state.get("searched") if isinstance(state.get("searched"), dict) else {}
    now = time.time()
    kicked = False
    for s in series:
        if not isinstance(s, dict) or not s.get("id"):
            continue
        title = str(s.get("title") or "")
        for season in s.get("seasons") or []:
            if not isinstance(season, dict):
                continue
            try:
                n = int(season.get("seasonNumber"))
            except (TypeError, ValueError):
                continue
            if n <= 0:
                continue
            stats = season.get("statistics") if isinstance(season.get("statistics"), dict) else {}
            try:
                files = int(stats.get("episodeFileCount") or 0)
            except (TypeError, ValueError):
                files = 0
            if files > 0 or season.get("monitored") is False or s.get("monitored") is False:
                continue
            hit = mod.match_catalog(title, catalog) if mod and catalog else None
            has_torrent, torrent_complete = _torrent_for_title(title, torrents, hit)
            if mod:
                action = mod.decide_missing_action(
                    has_files=False,
                    dump_has_media=_dump_has_media(mod, "sonarr", title),
                    has_catalog_hit=bool(hit),
                    has_torrent=has_torrent,
                    torrent_complete=torrent_complete,
                )
            else:
                action = "wait" if has_torrent and not torrent_complete else "search"
            sk = f"missing:{s['id']}:s{n}"
            if action == "relink":
                filled = _try_fill_dump(mod, "sonarr", title, hit)
                log(f"sonarr recover empty-symlink {title} S{n:02d} — create dump from FUSE")
                kicked = True
                if filled:
                    continue
                action = "search"
            if action == "import":
                log(f"sonarr recover dump-present {title} S{n:02d} — ManualImport")
                kicked = True
            elif action == "search":
                if not _should_search_missing(searched, sk, now):
                    continue
                try:
                    call(
                        f"{app['base']}/command",
                        key,
                        method="POST",
                        body={"name": "SeasonSearch", "seriesId": int(s["id"]), "seasonNumber": n},
                    )
                    log(f"sonarr SeasonSearch {title} S{n:02d} — no FUSE/cache hit")
                    searched[sk] = now
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
                    log(f"sonarr SeasonSearch {title} {type(e).__name__} {e}")
    state["searched"] = searched
    return kicked


def recover_missing_movies(app: dict, key: str, torrents: list, state: dict) -> bool:
    """0-file monitored movies: relink from FUSE or MoviesSearch. House Interstellar sat forever."""
    if app["name"] != "radarr":
        return False
    try:
        movies = call(f"{app['base']}/movie", key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False
    if not isinstance(movies, list):
        return False
    mod = _load_relink_mod()
    catalog = _catalog_paths() if mod else {}
    searched = state.get("searched") if isinstance(state.get("searched"), dict) else {}
    now = time.time()
    kicked = False
    for m in movies:
        if not isinstance(m, dict) or not m.get("id") or m.get("monitored") is False:
            continue
        stats = m.get("statistics") if isinstance(m.get("statistics"), dict) else {}
        try:
            files = int(stats.get("movieFileCount") or 0)
        except (TypeError, ValueError):
            files = 0
        if m.get("hasFile") is True or files > 0:
            continue
        title = str(m.get("title") or "")
        hit = mod.match_catalog(title, catalog) if mod and catalog else None
        has_torrent, torrent_complete = _torrent_for_title(title, torrents, hit)
        if mod:
            action = mod.decide_missing_action(
                has_files=False,
                dump_has_media=_dump_has_media(mod, "radarr", title),
                has_catalog_hit=bool(hit),
                has_torrent=has_torrent,
                torrent_complete=torrent_complete,
            )
        else:
            action = "wait" if has_torrent and not torrent_complete else "search"
        sk = f"missing:movie:{m['id']}"
        if action == "relink":
            filled = _try_fill_dump(mod, "radarr", title, hit)
            log(f"radarr recover empty-symlink {title} — create dump from FUSE")
            kicked = True
            if filled:
                continue
            action = "search"
        if action == "import":
            log(f"radarr recover dump-present {title} — ManualImport")
            kicked = True
        elif action == "search":
            if not _should_search_missing(searched, sk, now):
                continue
            try:
                call(
                    f"{app['base']}/command",
                    key,
                    method="POST",
                    body={"name": "MoviesSearch", "movieIds": [int(m["id"])]},
                )
                log(f"radarr MoviesSearch {title} — no FUSE/cache hit")
                searched[sk] = now
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
                log(f"radarr MoviesSearch {title} {type(e).__name__} {e}")
    state["searched"] = searched
    return kicked


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


def category_folders(app: dict, path: str) -> list[str]:
    """Scan only this *arr's dump dir. Never /mnt/symlinks (Museum under Sonarr)."""
    folders = [f for f in path_candidates(path) if f]
    cat = app.get("category") or app["name"]
    own = f"/{cat}/"
    if folders:
        folders = [f for f in folders if own in (f.rstrip("/") + "/") or f.rstrip("/").endswith(f"/{cat}")]
    if not folders:
        folders = [f"/mnt/symlinks/{cat}", f"/symlinks/{cat}"]
    return folders


def retry_arr_import(app: dict, key: str, item: dict) -> None:
    """Re-scan + ManualImport now that FUSE can stat the file. Does not re-add to TorBox."""
    path = content_path_of(item)
    scan_name = "DownloadedMoviesScan" if app["name"] == "radarr" else "DownloadedEpisodesScan"
    folders = category_folders(app, path)
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
    elif app["name"] == "sonarr":
        _sonarr_manual_import(key, item, folders)


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


def _sonarr_manual_import(key: str, item: dict, folders: list[str]) -> None:
    """Same harden as wire-engines: match S01.E01 / season packs, skip radarr dumps."""
    mod_path = Path(__file__).resolve().with_name("sonarr_manual_import.py")
    if not mod_path.is_file():
        mod_path = Path("/opt/reelos/daemon/sonarr_manual_import.py")
    if not mod_path.is_file():
        log("sonarr manualimport harden missing")
        return
    try:
        import importlib.util

        spec = importlib.util.spec_from_file_location("reelos_sonarr_manual_import", mod_path)
        if spec is None or spec.loader is None:
            return
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.bind(call_fn=call, log_fn=log)
        scan = [f for f in folders if f and "radarr" not in f.lower()]
        mod.sonarr_manual_import(key, hint=item, folders=scan or None)
    except Exception as e:
        log(f"sonarr manualimport {type(e).__name__} {e}")


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
            if action == "retry_import" or action == "reimport":
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

    for app in APPS:
        key = api_key(app["xml"])
        if not key:
            continue
        if recover_missing_series(app, key, torrents, state):
            recover = True
        if recover_missing_movies(app, key, torrents, state):
            recover = True

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

        def test_docker_exec_enotconn_is_stale(self):
            self.assertTrue(
                docker_exec_fuse_stale(1, "ls: /mnt/debrid: Transport endpoint is not connected")
            )
            self.assertTrue(docker_exec_fuse_stale(1, "Socket not connected"))
            self.assertFalse(docker_exec_fuse_stale(0, ""))
            self.assertFalse(docker_exec_fuse_stale(1, "Error: No such container: reelos-radarr-1"))
            self.assertFalse(docker_exec_fuse_stale(1, "container is not running"))

        def test_fuse_error_host_enotconn(self):
            self.assertTrue(fuse_error_is_stale("Socket not connected", 107))
            self.assertFalse(fuse_error_is_stale("permission denied", 13))

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

        def test_category_folders_never_scan_symlink_parent(self):
            radarr = {"name": "radarr", "category": "radarr"}
            sonarr = {"name": "sonarr", "category": "sonarr"}
            self.assertEqual(
                category_folders(sonarr, "/mnt/symlinks/sonarr/The Walking Dead"),
                ["/mnt/symlinks/sonarr/The Walking Dead", "/symlinks/sonarr/The Walking Dead"],
            )
            self.assertNotIn("/mnt/symlinks", category_folders(sonarr, ""))
            self.assertTrue(all("sonarr" in f for f in category_folders(sonarr, "")))
            self.assertTrue(all("radarr" in f for f in category_folders(radarr, "")))
            self.assertFalse(any("radarr" in f for f in category_folders(sonarr, "/mnt/symlinks/radarr/Museum")))

        def test_duplicate_season_pack_marks_newer_grab(self):
            items = [
                {
                    "id": 1,
                    "seriesId": 9,
                    "seasonNumber": 1,
                    "downloadId": "AA",
                    "added": "2026-01-01T00:00:00Z",
                    "title": "The Walking Dead - S01",
                },
                {
                    "id": 2,
                    "seriesId": 9,
                    "seasonNumber": 1,
                    "downloadId": "BB",
                    "added": "2026-01-01T00:40:00Z",
                    "title": "The Walking Dead - S01",
                },
            ]
            extras = extra_duplicate_queue_items(items)
            self.assertEqual([x["id"] for x in extras], [2])
            self.assertEqual(queue_season_key(items[0]), "series:9:s1")

        def test_same_season_episode_rows_are_not_duplicates(self):
            items = [
                {
                    "id": 1,
                    "seriesId": 9,
                    "downloadId": "AA",
                    "added": "2026-01-01T00:00:00Z",
                    "title": "The Walking Dead - S01E01",
                    "episode": {"seasonNumber": 1, "episodeNumber": 1},
                },
                {
                    "id": 2,
                    "seriesId": 9,
                    "downloadId": "BB",
                    "added": "2026-01-01T00:00:01Z",
                    "title": "The Walking Dead - S01E02",
                    "episode": {"seasonNumber": 1, "episodeNumber": 2},
                },
            ]
            self.assertEqual(extra_duplicate_queue_items(items), [])

        def test_retry_import_calls_sonarr_harden(self):
            src = Path(__file__).read_text()
            self.assertIn("_sonarr_manual_import", src)
            self.assertIn("sonarr_manual_import.py", src)
            self.assertIn('elif app["name"] == "sonarr"', src)

        def test_empty_symlink_recovery_is_wired(self):
            src = Path(__file__).read_text()
            self.assertIn("recover_missing_series", src)
            self.assertIn("recover_missing_movies", src)
            self.assertIn("relink_dumps.py", src)
            self.assertIn("SeasonSearch", src)
            self.assertIn("MoviesSearch", src)
            self.assertIn("empty-symlink", src)
            self.assertIn('body={"name": "MoviesSearch"', src)

        def test_search_interval_allows_first_missing_movie(self):
            self.assertTrue(_should_search_missing({}, "missing:movie:1", 100.0))
            self.assertFalse(_should_search_missing({"missing:movie:1": 50.0}, "missing:movie:1", 100.0))
            self.assertTrue(_should_search_missing({"missing:movie:1": 50.0}, "missing:movie:1", 50.0 + SEARCH_INTERVAL_SEC))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Guards)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit(sweep())
