"""Radarr, Sonarr, Bazarr, and Jellyseerr setup and hybrid profiles."""
from __future__ import annotations

import http.cookiejar
import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from .common import (
    COMPOSE,
    NET_ERR,
    QUALITY,
    ROOT,
    STATE,
    answers,
    call,
    log_wire,
    wait_http,
    wait_key,
)
from .hardware import arr_debrid_media_patch
from .indexers import _load_public_indexers, docker_service_url

HOST_FOR = {
    "/symlinks": "/mnt/symlinks",
    "/symlinks/radarr": "/mnt/symlinks/radarr",
    "/symlinks/sonarr": "/mnt/symlinks/sonarr",
    "/srv/media/movies": "/srv/media/movies",
    "/srv/media/tv": "/srv/media/tv",
    "/srv/media/anime": "/srv/media/anime",
    "/srv/media/books": "/srv/media/books",
}

SEERR_HOUSEHOLD = 2 | 16 | 32 | 128 | 256 | 131072 | 262144 | 524288
HYBRID_RECYCLE = Path("/mnt/symlinks/.reel-recycle")

def root_paths(kind: str) -> list[str]:
    mode = answers().get("storageMode") or "both"
    paths: list[str] = []
    if mode in ("debrid", "both"):
        if kind == "movie":
            paths.append("/symlinks/radarr")
            paths.append("/mnt/symlinks/radarr")
        elif kind == "tv":
            paths.append("/symlinks/sonarr")
            paths.append("/mnt/symlinks/sonarr")
        else:
            paths.append("/symlinks")
            paths.append("/mnt/symlinks")
        if kind == "anime":
            paths.append("/mnt/symlinks/anime")
        if kind == "music":
            paths.append("/mnt/symlinks/music")
    if mode in ("local", "both"):
        folder = {"movie": "movies", "tv": "tv", "anime": "anime", "music": "music"}.get(kind, "movies")
        paths.append(f"/media/{folder}")
    return paths or ["/mnt/symlinks"]


def ensure_roots(base: str, key: str, kind: str) -> None:
    try:
        existing = call(f"{base}/rootfolder", key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return
    have = {r.get("path") for r in existing if isinstance(r, dict)}
    for path in root_paths(kind):
        host = Path(HOST_FOR.get(path, path))
        try:
            host.mkdir(parents=True, exist_ok=True)
            if hasattr(os, "chown"):
                os.chown(host, 1000, 1000)
        except OSError:
            pass
        if path in have:
            continue
        try:
            call(f"{base}/rootfolder", key, method="POST", body={"path": path})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
            pass


def quality_id(base: str, key: str, want: str | None = None) -> int | None:
    name = want or QUALITY.get(answers().get("quality") or "hybrid", "Ultra-HD")
    try:
        profiles = call(f"{base}/qualityprofile", key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return None
    if not isinstance(profiles, list):
        return None
    for p in profiles:
        if p.get("name") == name:
            return p.get("id")
    for p in profiles:
        if p.get("name") == "Any":
            return p.get("id")
    return profiles[0].get("id") if profiles else None


def widen_sonarr_hybrid() -> None:
    """Hybrid is '1080p / 4K when available'. Stock Ultra-HD is 2160p-only and
    rejects EZTV 720p WEB-DL. Widen in place so existing B99/TWD series keep
    the same profile id."""
    want_q = answers().get("quality") or "hybrid"
    if want_q != "hybrid":
        return
    xml = COMPOSE / "configs" / "sonarr" / "config.xml"
    key = wait_key(xml, 20)
    if not key:
        return
    mod = _load_public_indexers()
    if not mod or not getattr(mod, "widen_hybrid_profile_items", None):
        return
    name = QUALITY.get(want_q, "Ultra-HD")
    try:
        profiles = call("http://127.0.0.1:8989/api/v3/qualityprofile", key) or []
    except NET_ERR:
        return
    for p in profiles if isinstance(profiles, list) else []:
        if p.get("name") != name:
            continue
        items = p.get("items") or []
        if not mod.widen_hybrid_profile_items(items):
            log_wire(f"sonarr {name} already allows HD+UHD")
            return
        body = dict(p)
        body["items"] = items
        body["upgradeAllowed"] = True
        try:
            call(
                f"http://127.0.0.1:8989/api/v3/qualityprofile/{p.get('id')}",
                key,
                method="PUT",
                body=body,
            )
            log_wire(f"sonarr {name} allows 720p/1080p/2160p (hybrid)")
        except NET_ERR as e:
            log_wire(f"sonarr hybrid profile {e}")
        return


def ensure_hybrid_recycle_bin(key: str | None = None) -> bool:
    """Radarr upgrade deletes the 1080. Recycle keeps it so restore can put it back.

    Hybrid only. Never /media. Cleanup days 0 — do not auto-empty the 1080.
    """
    if (answers().get("quality") or "hybrid") != "hybrid":
        return False
    rec = HYBRID_RECYCLE.as_posix()
    try:
        Path(rec).mkdir(parents=True, exist_ok=True)
        # Radarr's FolderWritableValidator 400s the mediamanagement PUT unless the
        # recycle bin is writable by the container user (PUID 1000). OTA runs
        # wire-engines as root, so a bare mkdir leaves it root-owned and every
        # Apply logs "radarr hybrid recycle put HTTP Error 400". Hand it back.
        os.chmod(rec, 0o775)
        if hasattr(os, "chown"):
            os.chown(rec, 1000, 1000)
    except OSError as e:
        log_wire(f"radarr hybrid recycle mkdir {e}")
    if not key:
        xml = COMPOSE / "configs" / "radarr" / "config.xml"
        key = wait_key(xml, 20)
    if not key:
        return False
    try:
        cfg = call("http://127.0.0.1:7878/api/v3/config/mediamanagement", key)
    except NET_ERR as e:
        log_wire(f"radarr hybrid recycle {e}")
        return False
    if not isinstance(cfg, dict) or not cfg.get("id"):
        return False
    if (
        str(cfg.get("recycleBin") or "").rstrip("/") == rec.rstrip("/")
        and int(cfg.get("recycleBinCleanupDays") or -1) == 0
        and cfg.get("enableMediaInfo") is False
    ):
        return True
    body = arr_debrid_media_patch(cfg)
    body["recycleBin"] = rec
    body["recycleBinCleanupDays"] = 0
    try:
        call(
            f"http://127.0.0.1:7878/api/v3/config/mediamanagement/{cfg['id']}",
            key,
            method="PUT",
            body=body,
        )
        log_wire("radarr hybrid recycle keeps upgraded 1080")
        return True
    except NET_ERR as e:
        log_wire(f"radarr hybrid recycle put {e}")
        return False


def widen_radarr_hybrid() -> None:
    """MoviesSearch against Ultra-HD 2160p-only rejects 1080p National Treasure.

    Upgrade is still allowed so 4K can land; recycle + restore keep the 1080.
    """
    want_q = answers().get("quality") or "hybrid"
    if want_q != "hybrid":
        return
    xml = COMPOSE / "configs" / "radarr" / "config.xml"
    key = wait_key(xml, 20)
    if not key:
        return
    ensure_hybrid_recycle_bin(key)
    mod = _load_public_indexers()
    if not mod or not getattr(mod, "widen_hybrid_profile_items", None):
        return
    name = QUALITY.get(want_q, "Ultra-HD")
    try:
        profiles = call("http://127.0.0.1:7878/api/v3/qualityprofile", key) or []
    except NET_ERR:
        return
    for p in profiles if isinstance(profiles, list) else []:
        if p.get("name") != name:
            continue
        items = p.get("items") or []
        widened = bool(mod.widen_hybrid_profile_items(items))
        if not widened and p.get("upgradeAllowed") is True:
            log_wire(f"radarr {name} already allows HD+UHD")
            return
        body = dict(p)
        body["items"] = items
        body["upgradeAllowed"] = True
        try:
            call(
                f"http://127.0.0.1:7878/api/v3/qualityprofile/{p.get('id')}",
                key,
                method="PUT",
                body=body,
            )
            log_wire(f"radarr {name} allows 720p/1080p/2160p (hybrid)")
        except NET_ERR as e:
            log_wire(f"radarr hybrid profile {e}")
        return


def bazarr_key() -> str | None:
    for p in (
        COMPOSE / "configs" / "bazarr" / "config" / "config.yaml",
        COMPOSE / "configs" / "bazarr" / "config.yaml",
    ):
        if not p.exists():
            continue
        m = re.search(r"apikey:\s*['\"]?([A-Za-z0-9]+)", p.read_text())
        if m:
            return m.group(1)
    return None


def configure_bazarr_subtitles() -> None:
    for p in (
        COMPOSE / "configs" / "bazarr" / "config" / "config.yaml",
        COMPOSE / "configs" / "bazarr" / "config.yaml",
    ):
        if not p.exists():
            continue
        try:
            txt = p.read_text(encoding="utf-8")
            changed = False
            if "languages:" not in txt:
                txt += "\nsubtitles:\n  languages: ['en']\n  single: true\n"
                changed = True
            if "adaptive_searching:" not in txt:
                txt += "\nsubtitles:\n  adaptive_searching: false\n  minimum_score: 80\n"
                changed = True
            if "subtitles_search_interval:" not in txt:
                txt += "\nsubtitles:\n  subtitles_search_interval: 60\n"
                changed = True
            if "threads:" not in txt:
                txt += "\nperformance:\n  threads: 1\n"
                changed = True
            if "multithreading:" not in txt:
                txt += "\ngeneral:\n  multithreading: false\n"
                changed = True
            if "use_radarr: false" in txt:
                txt = txt.replace("use_radarr: false", "use_radarr: true")
                changed = True
            if "use_sonarr: false" in txt:
                txt = txt.replace("use_sonarr: false", "use_sonarr: true")
                changed = True
            if changed:
                p.write_text(txt, encoding="utf-8")
        except OSError:
            pass


def wire_bazarr(radarr_key: str | None, sonarr_key: str | None) -> None:
    configure_bazarr_subtitles()
    deadline = time.time() + 90
    key = None
    while time.time() < deadline:
        key = bazarr_key()
        if key:
            break
        time.sleep(2)
    if not key:
        return
    if radarr_key:
        try:
            call(
                "http://127.0.0.1:6767/api/radarr",
                key,
                method="POST",
                body={
                    "name": "Radarr",
                    "address": "radarr",
                    "port": 7878,
                    "apikey": radarr_key,
                    "ssl": False,
                    "path_mapping": [["/movies", "/symlinks/radarr"], ["/symlinks/radarr", "/symlinks/radarr"]],
                    "minimum_score": 70,
                },
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
            pass
    if sonarr_key:
        try:
            call(
                "http://127.0.0.1:6767/api/sonarr",
                key,
                method="POST",
                body={
                    "name": "Sonarr",
                    "address": "sonarr",
                    "port": 8989,
                    "apikey": sonarr_key,
                    "ssl": False,
                    "path_mapping": [["/tv", "/symlinks/sonarr"], ["/symlinks/sonarr", "/symlinks/sonarr"]],
                    "minimum_score": 70,
                },
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
            pass


def extra_access() -> None:
    if os.environ.get("REELOS_OTA") == "1":
        return
    script = ROOT / "bin" / "reelos-access.sh"
    if script.exists():
        subprocess.run(["bash", str(script)], check=False)


class Seerr:
    def __init__(self) -> None:
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))

    def call(self, path: str, method: str = "GET", body: dict | None = None):
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            "http://127.0.0.1:5055" + path,
            data=data,
            method=method,
            headers=headers,
        )
        with self.op.open(req, timeout=25) as resp:
            raw = resp.read().decode() or "{}"
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw[:200]}


def _seerr_service_rows(rows) -> list:
    items = rows if isinstance(rows, list) else (rows or {}).get("results") or rows or []
    if not isinstance(items, list):
        return []
    return [x for x in items if isinstance(x, dict)]


def _seerr_has_service(rows, name: str) -> bool:
    return any(str(x.get("name") or "") == name for x in _seerr_service_rows(rows))


def _seerr_find_service(rows, name: str) -> dict | None:
    for x in _seerr_service_rows(rows):
        if str(x.get("name") or "") == name:
            return x
    return None


def seerr_needs_search_enable(service: dict | None, body: dict | None = None) -> bool:
    """Old house Seerr can sit on preventSearch=true, or hostname radarr that DNS cannot resolve."""
    return seerr_needs_arr_update(service, body)


def seerr_needs_arr_update(service: dict | None, body: dict | None = None) -> bool:
    if not service:
        return False
    if service.get("preventSearch") is True:
        return True
    if not body:
        return False
    if str(service.get("hostname") or "") != str(body.get("hostname") or ""):
        return True
    if body.get("apiKey") and str(service.get("apiKey") or "") != str(body.get("apiKey") or ""):
        return True
    return False


def ensure_seerr_arr_service(s, kind: str, existing, body: dict) -> str:
    """POST if missing. PUT preventSearch=False so Request actually searches *arr."""
    name = str(body.get("name") or "")
    hit = _seerr_find_service(existing, name)
    if not hit:
        s.call(f"/api/v1/settings/{kind}", "POST", body)
        return "created"
    if not seerr_needs_arr_update(hit, body):
        return "ok"
    upd = dict(hit)
    upd["preventSearch"] = False
    if body.get("hostname"):
        upd["hostname"] = body.get("hostname")
    if body.get("apiKey"):
        upd["apiKey"] = body.get("apiKey")
    sid = hit.get("id")
    path = f"/api/v1/settings/{kind}/{sid}" if sid is not None else f"/api/v1/settings/{kind}"
    s.call(path, "PUT", upd)
    return "updated"


def bootstrap_seerr(radarr_key: str | None, sonarr_key: str | None) -> None:
    a = answers()
    user = (a.get("adminName") or "reelos").strip() or "reelos"
    password = (a.get("adminPassword") or "reelos").strip() or "reelos"
    up = False
    for _ in range(90):
        try:
            urllib.request.urlopen("http://127.0.0.1:5055/api/v1/status", timeout=3).read()
            up = True
            break
        except NET_ERR:
            time.sleep(2)
    if not up:
        log_wire("seerr not up")
        return
    s = Seerr()
    try:
        pub = s.call("/api/v1/settings/public")
    except NET_ERR as e:
        log_wire(f"seerr public {e}")
        return
    if not pub.get("initialized"):
        try:
            s.call(
                "/api/v1/auth/jellyfin",
                "POST",
                {
                    "username": user,
                    "password": password,
                    "hostname": "jellyfin",
                    "port": 8096,
                    "useSsl": False,
                    "urlBase": "",
                    "email": f"{user}@reelos.local",
                    "serverType": 2,
                },
            )
            log_wire("seerr jellyfin login")
        except NET_ERR as e:
            try:
                s.call("/api/v1/auth/jellyfin", "POST", {"username": user, "password": password})
                log_wire("seerr jellyfin login (reauth)")
            except NET_ERR:
                log_wire(f"seerr setup {type(e).__name__} {e}")
                return
        try:
            s.call("/api/v1/settings/initialize", "POST")
            log_wire("seerr initialized")
        except NET_ERR:
            pass
    else:
        try:
            s.call("/api/v1/auth/jellyfin", "POST", {"username": user, "password": password})
        except NET_ERR as e:
            log_wire(f"seerr reauth {type(e).__name__} {e}")
    try:
        libs = s.call("/api/v1/settings/jellyfin/library?sync=true")
        rows = libs if isinstance(libs, list) else libs.get("libraries") or []
        enabled = []
        for lib in rows:
            item = dict(lib)
            item["enabled"] = True
            enabled.append(item)
        if enabled:
            s.call("/api/v1/settings/jellyfin", "POST", {"libraries": enabled})
    except NET_ERR as e:
        log_wire(f"seerr libraries {type(e).__name__} {e}")
    qid = quality_id("http://127.0.0.1:7878/api/v3", radarr_key) if radarr_key else 1
    if radarr_key:
        try:
            existing = s.call("/api/v1/settings/radarr")
            body = {
                "name": "Radarr",
                "hostname": "radarr",
                "port": 7878,
                "apiKey": radarr_key,
                "useSsl": False,
                "activeProfileId": qid or 1,
                "activeProfileName": QUALITY.get(answers().get("quality") or "hybrid", "Ultra-HD"),
                "activeDirectory": "/symlinks/radarr",
                "isDefault": True,
                "is4k": False,
                "minimumAvailability": "released",
                "syncEnabled": True,
                "preventSearch": False,
                "tagRequests": False,
                "tags": [],
            }
            op = ensure_seerr_arr_service(s, "radarr", existing, body)
            if op == "created":
                log_wire("seerr radarr")
            elif op == "updated":
                log_wire("seerr radarr search enabled")
        except NET_ERR as e:
            log_wire(f"seerr radarr {type(e).__name__} {e}")
    sqid = quality_id("http://127.0.0.1:8989/api/v3", sonarr_key) if sonarr_key else 1
    if sonarr_key:
        try:
            existing = s.call("/api/v1/settings/sonarr")
            body = {
                "name": "Sonarr",
                "hostname": "sonarr",
                "port": 8989,
                "apiKey": sonarr_key,
                "useSsl": False,
                "activeProfileId": sqid or 1,
                "activeProfileName": QUALITY.get(answers().get("quality") or "hybrid", "Ultra-HD"),
                "activeDirectory": "/symlinks/sonarr",
                "isDefault": True,
                "is4k": False,
                "syncEnabled": True,
                "preventSearch": False,
                "tagRequests": False,
                "enableSeasonFolders": True,
                "tags": [],
            }
            op = ensure_seerr_arr_service(s, "sonarr", existing, body)
            if op == "created":
                log_wire("seerr sonarr")
            elif op == "updated":
                log_wire("seerr sonarr search enabled")
        except NET_ERR as e:
            log_wire(f"seerr sonarr {type(e).__name__} {e}")
    try:
        main = s.call("/api/v1/settings/main") or {}
        main["localLogin"] = True
        main["mediaServerLogin"] = True
        main["hideAvailable"] = True
        main["defaultPermissions"] = SEERR_HOUSEHOLD
        s.call("/api/v1/settings/main", "POST", main)
    except NET_ERR as e:
        log_wire(f"seerr main {type(e).__name__} {e}")
    try:
        users = s.call("/api/v1/user")
        rows = users if isinstance(users, list) else users.get("results") or []
        for u in rows:
            uid = u.get("id")
            if not uid:
                continue
            s.call(f"/api/v1/user/{uid}", "PUT", {"permissions": SEERR_HOUSEHOLD, "id": uid})
        log_wire("seerr auto-approve household")
    except NET_ERR as e:
        log_wire(f"seerr users {type(e).__name__} {e}")
    try:
        settings = Path("/opt/reelos/compose/configs/seerr/settings.json")
        if settings.exists():
            j = json.loads(settings.read_text())
            key = (j.get("main") or {}).get("apiKey")
            if key:
                (STATE / "seerr.key").write_text(str(key) + "\n")
    except (OSError, json.JSONDecodeError, TypeError):
        pass
