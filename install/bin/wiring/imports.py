"""Manual imports, relinking debrid downloads, and catch-up processing."""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from .common import (
    COMPOSE,
    NET_ERR,
    ROOT,
    STATE,
    answers,
    api_key,
    call,
    log_wire,
    source,
    wait_http,
    wait_key,
)
from .fuse import (
    fuse_host_mount_count,
    fuse_on_host,
    fuse_unstack_stale,
    wait_fuse_ready,
)
from .hardware import (
    apply_arr_debrid_media_info,
    ffprobe_is_stubbed,
    hw,
)
from .jellyfin import (
    apply_jellyfin_performance,
    collapse_movie_named_dumps,
    collapse_season_named_dumps,
    drop_extra_jellyfin_libraries,
    ensure_host_symlinks,
    ensure_jellyfin_libraries,
    heal_hybrid_1080_companions,
    heal_merge_movie_versions,
    heal_movie_dump_items,
    heal_season_folder_items,
    jellyfin_folders,
    jellyfin_headers,
    jellyfin_token,
    jellyfin_want_libraries,
    jf_merge_wait_sec,
    label_jellyfin_movie_versions,
    park_extra_movie_files,
    restore_hybrid_movie_versions,
)

def _load_relink_dumps():
    import importlib.util
    from pathlib import Path as _Path

    mod_path = _Path(__file__).resolve().parent.parent / "relink_dumps.py"
    if not mod_path.is_file():
        mod_path = _Path(__file__).with_name("relink_dumps.py")
    if not mod_path.is_file():
        mod_path = _Path("/opt/reelos/bin/relink_dumps.py")
    if not mod_path.is_file():
        mod_path = _Path("/opt/reelos/daemon/relink_dumps.py")
    if not mod_path.is_file():
        return None
    spec = importlib.util.spec_from_file_location("reelos_relink_dumps", mod_path)
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_debrid_adopt():
    import importlib.util
    from pathlib import Path as _Path

    for cand in [
        _Path(__file__).with_name("debrid_adopt.py"),
        _Path(__file__).resolve().parent / "debrid_adopt.py",
        _Path(__file__).resolve().parent / "wiring" / "debrid_adopt.py",
        _Path(__file__).resolve().parent.parent / "wiring" / "debrid_adopt.py",
        _Path("/opt/reelos/bin/wiring/debrid_adopt.py"),
        _Path("/opt/reelos/bin/debrid_adopt.py"),
    ]:
        if cand.is_file():
            spec = importlib.util.spec_from_file_location("reelos_debrid_adopt", cand)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                return mod
    return None


def _relink_stem(name: str) -> str:
    """Title stem only — do not match Museum into a Walking Dead dump via 20-char prefix."""
    mod = _load_relink_dumps()
    if mod:
        return mod.relink_stem(name)
    s = re.sub(r"[^a-z0-9]+", "", str(name or "").lower())
    s = re.split(r"(?:19|20)\d{2}|2160p|1080p|720p|webdl|webrip|bluray", s, maxsplit=1)[0]
    return s


def _queue_records(payload) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("records"), list):
        return payload["records"]
    return []


def wanted_relink_stems(rk: str | None, sk: str | None) -> dict:
    """*arr series/movies/queue titles → stems. Empty if *arr is down (still fill existing dumps)."""
    mod = _load_relink_dumps()
    series, movies, sq, rq = [], [], [], []
    if sk:
        try:
            series = call("http://127.0.0.1:8989/api/v3/series", sk) or []
        except Exception as e:
            log_wire(f"relink series {type(e).__name__} {e}")
        try:
            sq = _queue_records(call("http://127.0.0.1:8989/api/v3/queue?pageSize=200", sk))
        except Exception as e:
            log_wire(f"relink sonarr queue {type(e).__name__} {e}")
    if rk:
        try:
            movies = call("http://127.0.0.1:7878/api/v3/movie", rk) or []
        except Exception as e:
            log_wire(f"relink movies {type(e).__name__} {e}")
        try:
            rq = _queue_records(call("http://127.0.0.1:7878/api/v3/queue?pageSize=200", rk))
        except Exception as e:
            log_wire(f"relink radarr queue {type(e).__name__} {e}")
    if not mod:
        return {"sonarr": [], "radarr": []}
    return mod.wanted_from_arr_rows(series=series, movies=movies, sonarr_queue=sq, radarr_queue=rq)


def relink_from_debrid(rk: str | None = None, sk: str | None = None) -> int:
    """Empty *arr dump dirs, or missing dumps after Apply/wipe, from FUSE /mnt/debrid/__all__.

    Only write category folders. Scanning /mnt/symlinks mixed Museum into Sonarr.
    Create missing dumps when FUSE has the pack and *arr knows the title.
    """
    mod = _load_relink_dumps()
    if mod is None:
        log_wire("relink skip — relink_dumps module missing")
        return 0
    wanted = wanted_relink_stems(rk, sk)
    return mod.relink_dumps(
        all_root=Path("/mnt/debrid/__all__"),
        symlink_root=Path("/mnt/symlinks"),
        wanted=wanted,
        log=log_wire,
    )


def sonarr_manual_import(sk: str, hint=None, folders=None, *, catch_up: bool = False) -> None:
    """Dump folders are not a series library. Copy matched episodes into the series folder."""
    import importlib.util
    from pathlib import Path as _Path
    mod_path = _Path(__file__).resolve().parent.parent / "sonarr_manual_import.py"
    if not mod_path.is_file():
        mod_path = _Path(__file__).with_name("sonarr_manual_import.py")
    if not mod_path.is_file():
        mod_path = _Path("/opt/reelos/bin/sonarr_manual_import.py")
    if not mod_path.is_file():
        mod_path = _Path("/opt/reelos/daemon/sonarr_manual_import.py")
    spec = importlib.util.spec_from_file_location("reelos_sonarr_manual_import", mod_path)
    if spec is None or spec.loader is None:
        log_wire("sonarr manualimport harden module missing")
        return
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.bind(call_fn=call, log_fn=log_wire)
    mod.sonarr_manual_import(sk, hint=hint, folders=folders, catch_up=catch_up)


def write_library_progress(**fields):
    """Phone library clock. Same JSON the splash / /api/ready read."""
    path = STATE / "library-progress.json"
    log_path = STATE / "library.log"
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
    if status in ("done", "stopped", "idle"):
        prev["needsImport"] = False
    needs = bool(prev.get("needsImport"))
    live = None
    try:
        from pathlib import Path as _P
        import sonarr_manual_import as _smi
    except Exception:
        _smi = None
    if _smi is not None:
        try:
            live = _smi.catchup_is_live()
        except Exception:
            live = None
    prev["splashLock"] = status == "running" and needs and live is not False
    if "message" not in fields and not prev.get("message"):
        prev["message"] = "Library catching up" if (status == "running" and needs) else ""
    if status in ("done", "stopped") or (status == "running" and not needs):
        msg = str(prev.get("message") or "")
        if (not msg) or msg.startswith("Library catching up") or "backing off" in msg:
            skipped = int(prev.get("skipped") or 0)
            timeouts = int(prev.get("timeouts") or 0)
            if status in ("done", "stopped") or skipped:
                prev["message"] = (
                    f"Library catch-up done — {skipped} skipped, {timeouts} timeouts"
                    if skipped or timeouts
                    else "Library catch-up done"
                )
                if status == "running" and skipped and not needs:
                    prev["status"] = "done"
                    status = "done"
    prev["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(prev) + "\n")
        with log_path.open("a") as fh:
            fh.write(prev["updatedAt"] + " " + str(prev.get("message") or "") + "\n")
    except OSError:
        pass
    log_wire(str(prev.get("message") or "library progress"))
    return prev


def ffprobe_d_state_count() -> int:
    try:
        r = subprocess.run(["ps", "-eo", "state,comm"], capture_output=True, text=True, check=False)
    except OSError:
        return 0
    n = 0
    for line in (r.stdout or "").splitlines():
        parts = line.split()
        if len(parts) >= 2 and "D" in parts[0] and "ffprobe" in parts[1]:
            n += 1
    return n


def kick_imports(*, catch_up: bool = False) -> bool:
    lock_file = None
    if catch_up:
        try:
            import fcntl
            lock_path = Path("/var/lib/reelos/library-catchup.lock")
            lock_path.parent.mkdir(parents=True, exist_ok=True)
            lock_file = open(lock_path, "w")
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError):
            log_wire("import catch-up already running — not stacking")
            return True
        except Exception:
            pass
    ping_wait = 20 if catch_up else 90
    if catch_up:
        write_library_progress(status="running", message="Library catching up", needsImport=False)
        if fuse_on_host():
            n = fuse_host_mount_count()
            log_wire(f"import catch-up — fuse listed ({n}), do not remount if listed")
        d_state = ffprobe_d_state_count()
        limit = 1
        try:
            m = hw()
            if m is not None:
                limit = int(m.d_backoff_limit())
        except Exception:
            limit = 1
        if d_state >= limit and not ffprobe_is_stubbed():
            log_wire(f"import catch-up idle — ffprobe D-state {d_state} (not piling more)")
            write_library_progress(
                status="idle",
                needsImport=False,
                splashLock=False,
                message="",
            )
            return True
        if d_state >= limit:
            log_wire(f"import catch-up — ffprobe stubbed, skip-existing dumps (D-state {d_state})")
    if wait_fuse_ready(20 if catch_up else 40):
        log_wire("import — FUSE ready")
    else:
        log_wire("import — FUSE not ready, scan anyway")
    wait_http("http://127.0.0.1:7878/ping", ping_wait)
    wait_http("http://127.0.0.1:8989/ping", ping_wait)
    radarr_xml = COMPOSE / "configs" / "radarr" / "config.xml"
    sonarr_xml = COMPOSE / "configs" / "sonarr" / "config.xml"
    rk = api_key(radarr_xml)
    sk = api_key(sonarr_xml)
    if catch_up:
        log_wire("import catch-up — skip FUSE relink (no dfs walk)")
        # Never ensure_fuse / remount from the library worker.
    else:
        relink_from_debrid(rk=rk, sk=sk)
        adopt_mod = _load_debrid_adopt()
        if adopt_mod and hasattr(adopt_mod, "adopt_debrid_movies"):
            try:
                adopt_mod.adopt_debrid_movies(rk=rk, log=log_wire)
            except Exception as e:
                log_wire(f"debrid adopt non-fatal {e}")
    if rk:
        for attempt in range(5):
            try:
                # *arr sees /symlinks/... — do not list host+container paths twice.
                call(
                    "http://127.0.0.1:7878/api/v3/command",
                    rk,
                    method="POST",
                    body={"name": "DownloadedMoviesScan", "path": "/symlinks/radarr"},
                )
                call("http://127.0.0.1:7878/api/v3/command", rk, method="POST", body={"name": "RefreshMonitoredDownloads"})
                log_wire("radarr import scan")
                break
            except Exception as e:
                log_wire(f"radarr scan try {attempt + 1} {type(e).__name__} {e}")
                time.sleep(8)
    if sk:
        for attempt in range(5):
            try:
                call(
                    "http://127.0.0.1:8989/api/v3/command",
                    sk,
                    method="POST",
                    body={"name": "DownloadedEpisodesScan", "path": "/symlinks/sonarr"},
                )
                call("http://127.0.0.1:8989/api/v3/command", sk, method="POST", body={"name": "RefreshMonitoredDownloads"})
                log_wire("sonarr import scan")
                break
            except Exception as e:
                log_wire(f"sonarr scan try {attempt + 1} {type(e).__name__} {e}")
                time.sleep(8)
        sonarr_manual_import(sk, catch_up=catch_up)
    # Scan/relink first. Collapse + JF refresh happen in heal_after_import so
    # this Apply cannot re-ingest the duplicate dumps it just healed.
    # Never RescanSeries with no id (all shows) on Apply.
    log_wire("import collapse season-folder dumps before jellyfin refresh")
    if catch_up:
        write_library_progress(status="done", needsImport=False, splashLock=False)
    return heal_after_import(catch_up=catch_up)


def heal_after_import(*, catch_up: bool = False) -> bool:
    """Collapse leftover dumps AFTER *arr scan, then heal JF. Never scan again.

    Same Apply must not Library/Refresh the season-named dumps we just collapsed.
    If #62's heal_season_folder_items is present, call it.
    Catch-up (Apply after stamp) must not bolt a hybrid 1080 grab onto the path.
    """
    dropped = collapse_season_named_dumps()
    dropped += collapse_movie_named_dumps()
    dropped += restore_hybrid_movie_versions()
    dropped += park_extra_movie_files()
    dropped += label_jellyfin_movie_versions()
    log_wire("import collapse season-folder dumps before jellyfin refresh")
    log_wire("import collapse movie dumps before jellyfin refresh")
    token = jellyfin_token()
    healed = 0
    if token:
        try:
            healed = int(heal_season_folder_items(token) or 0)
        except Exception as e:
            log_wire(f"jellyfin season-folder item {e}")
        try:
            healed += int(heal_movie_dump_items(token) or 0)
        except Exception as e:
            log_wire(f"jellyfin movie dump item {e}")
    ready = True
    if token:
        want = jellyfin_want_libraries()
        ready = ensure_jellyfin_libraries(token, want, collapse_dumps=False)
        if dropped or healed or not ready:
            try:
                call(
                    "http://127.0.0.1:8096/Library/Refresh",
                    method="POST",
                    headers=jellyfin_headers(token),
                )
                log_wire("jellyfin refresh after post-import heal")
            except NET_ERR as e:
                log_wire(f"jellyfin refresh {e}")
            time.sleep(jf_merge_wait_sec())
        # Merge LAST. Library/Refresh after MergeVersions splits one poster into two.
        try:
            healed += int(heal_merge_movie_versions(token) or 0)
        except Exception as e:
            log_wire(f"jellyfin merge movie versions {e}")
    elif dropped:
        log_wire("import collapse season-folder dumps (no jellyfin token)")
    frontend = str((answers() or {}).get("frontend") or "jellyfin")
    if not token and frontend in ("jellyfin", "both"):
        log_wire("jellyfin heal red — no token")
        return False
    if catch_up:
        log_wire("import catch-up — skip hybrid 1080 grab")
    else:
        heal_hybrid_1080_companions()
    return ready


def ota_clean_bounded_heal() -> None:
    """API-only leftover JF rows. Not a dump walk. Not docker restart Sonarr."""
    apply_jellyfin_performance()
    apply_arr_debrid_media_info()
    fuse_unstack_stale()
    token = jellyfin_token()
    if token:
        try:
            heal_season_folder_items(token)
        except Exception as e:
            log_wire(f"ota-clean season-folder {e}")
        try:
            heal_movie_dump_items(token)
        except Exception as e:
            log_wire(f"ota-clean movie dump {e}")
        try:
            want = jellyfin_want_libraries()
            folders = jellyfin_folders(token)
            if folders:
                drop_extra_jellyfin_libraries(token, folders, want)
        except Exception as e:
            log_wire(f"ota-clean extra libraries {e}")
    log_wire("ota-clean bounded heal")
