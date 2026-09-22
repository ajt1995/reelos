"""Main appliance provision and bootstrap coordinator."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from .arr import (
    bootstrap_seerr,
    ensure_roots,
    extra_access,
    quality_id,
    widen_radarr_hybrid,
    widen_sonarr_hybrid,
    wire_bazarr,
)
from .common import (
    COMPOSE,
    NET_ERR,
    ROOT,
    STATE,
    answers,
    compose,
    compose_env,
    log_wire,
    source,
    wait_http,
    wait_key,
)
from .fuse import (
    ensure_fuse,
    fuse_unstack_stale,
    patch_decypharr,
    persist_mnt_shared,
    share_mnt,
)
from .hardware import (
    apply_arr_debrid_media_info,
    has_vaapi_dri,
    hw,
    performance_low,
    stub_container_ffprobe,
)
from .imports import (
    heal_after_import,
    kick_imports,
    relink_from_debrid,
)
from .indexers import (
    add_torbox_torznab,
    clear_releases_error,
    docker_service_ip,
    docker_service_url,
    ensure_arr_search_indexers,
    ensure_compose_dns,
    ensure_prowlarr_app,
    ensure_provider_indexer,
    ensure_public_indexers,
    indexer_test,
    recreate_arrs,
    recreate_prowlarr,
    research_missing_after_indexers,
    set_releases_error,
    sync_prowlarr_apps,
    wait_prowlarr_api,
)
from .jellyfin import (
    apply_jellyfin_performance,
    apply_jellyfin_playback_policies,
    bootstrap_jellyfin,
    ensure_jellyfin_libraries,
    heal_hybrid_1080_companions,
    jellyfin_token,
    jellyfin_want_libraries,
    mount_extra_disks,
    persist_jellyfin_encoding_xml,
    persist_transcode_state,
    seed_jellyfin_encoding_xml,
    seed_jellyfin_network_xml,
    transcode_override,
)

def main() -> int:
    STATE.mkdir(parents=True, exist_ok=True)
    share_mnt()
    for d in (
        "/srv/media/movies",
        "/srv/media/tv",
        "/srv/media/anime",
        "/srv/media/music",
        "/srv/media/downloads",
        "/mnt/symlinks",
        "/mnt/symlinks/radarr",
        "/mnt/symlinks/sonarr",
        "/mnt/symlinks/anime",
        "/mnt/symlinks/music",
    ):
        Path(d).mkdir(parents=True, exist_ok=True)
    mount_extra_disks()
    if source() != "local-vpn":
        try:
            patch_decypharr()
        except Exception as e:
            log_wire(f"decypharr {type(e).__name__} {e}")
    try:
        transcode_override()
    except Exception as e:
        log_wire(f"transcode {type(e).__name__} {e}")

    a = answers()
    intent = a.get("intent") or {}
    frontend = a.get("frontend") or "jellyfin"

    if frontend in ("jellyfin", "both"):
        try:
            bootstrap_jellyfin()
        except Exception as e:
            log_wire(f"jellyfin bootstrap {type(e).__name__} {e}")

    radarr_xml = COMPOSE / "configs" / "radarr" / "config.xml"
    sonarr_xml = COMPOSE / "configs" / "sonarr" / "config.xml"
    lidarr_xml = COMPOSE / "configs" / "lidarr" / "config.xml"
    prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"

    radarr_key = wait_key(radarr_xml) if intent.get("movies", True) else None
    sonarr_key = wait_key(sonarr_xml) if intent.get("tv") or intent.get("anime") else None
    lidarr_key = wait_key(lidarr_xml) if intent.get("music") else None
    prow_key = wait_key(prow_xml)
    try:
        if prow_key:
            ensure_provider_indexer(prow_key)
            ensure_public_indexers(prow_key)
    except Exception as e:
        log_wire(f"provider indexer {type(e).__name__} {e}")

    engine: dict = {"wiredAt": int(time.time()), "quality": a.get("quality")}

    try:
        if radarr_key:
            ensure_roots("http://127.0.0.1:7878/api/v3", radarr_key, "movie")
            engine["radarrQuality"] = quality_id("http://127.0.0.1:7878/api/v3", radarr_key)
            if prow_key:
                ensure_prowlarr_app(
                    "Radarr",
                    "Radarr",
                    docker_service_url("radarr", 7878, "radarr"),
                    radarr_key,
                    prow_key,
                )
        if sonarr_key:
            kind = "anime" if intent.get("anime") and not intent.get("tv") else "tv"
            ensure_roots("http://127.0.0.1:8989/api/v3", sonarr_key, kind)
            if intent.get("anime"):
                ensure_roots("http://127.0.0.1:8989/api/v3", sonarr_key, "anime")
            engine["sonarrQuality"] = quality_id("http://127.0.0.1:8989/api/v3", sonarr_key)
            if prow_key:
                ensure_prowlarr_app(
                    "Sonarr",
                    "Sonarr",
                    docker_service_url("sonarr", 8989, "sonarr"),
                    sonarr_key,
                    prow_key,
                )
        if lidarr_key:
            ensure_roots("http://127.0.0.1:8686/api/v1", lidarr_key, "music")
            if prow_key:
                ensure_prowlarr_app(
                    "Lidarr",
                    "Lidarr",
                    docker_service_url("lidarr", 8686, "lidarr"),
                    lidarr_key,
                    prow_key,
                )
        if prow_key:
            sync_prowlarr_apps(prow_key)
        apply_arr_debrid_media_info()
        widen_sonarr_hybrid()
        widen_radarr_hybrid()
    except Exception as e:
        log_wire(f"arr wire {type(e).__name__} {e}")

    try:
        wire_bazarr(radarr_key, sonarr_key)
    except Exception as e:
        log_wire(f"bazarr {type(e).__name__} {e}")
    if frontend in ("jellyfin", "both"):
        try:
            bootstrap_seerr(radarr_key, sonarr_key)
        except Exception as e:
            log_wire(f"seerr bootstrap {type(e).__name__} {e}")
    extra_access()

    try:
        ensure_fuse()
    except Exception as e:
        log_wire(f"fuse {type(e).__name__} {e}")

    (STATE / "engine.json").write_text(json.dumps(engine, indent=2) + "\n")

    lock = ROOT / "bin" / "lock-download-clients.py"
    if lock.exists() and source() != "local-vpn":
        subprocess.run([sys.executable, str(lock)], check=False)
    kiosk = ROOT / "bin" / "kiosk.sh"
    if os.environ.get("REELOS_OTA") != "1" and kiosk.exists() and Path("/dev/dri").exists():
        subprocess.run(["bash", str(kiosk)], check=False)
    if os.environ.get("REELOS_OTA") != "1":
        try:
            log_wire("first provision — library walk")
            kick_imports(catch_up=False)
        except Exception as e:
            log_wire(f"provision import {e}")
    return 0
