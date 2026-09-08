#!/usr/bin/env python3
"""Idempotent engine wiring after wizard / Repair / OTA."""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
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
STATE = Path("/var/lib/reelos")
DECYPHARR = COMPOSE / "configs" / "decypharr" / "config.json"

PROVIDER = {
    "torbox": "torbox",
    "real-debrid": "realdebrid",
    "alldebrid": "alldebrid",
    "premiumize": "premiumize",
}
QUALITY = {"1080p": "HD-1080p", "hybrid": "Ultra-HD", "4k": "Ultra-HD", "custom": "Any"}


def answers() -> dict:
    p = STATE / "answers.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError:
        return {}


def source() -> str:
    env = COMPOSE / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SOURCE="):
                return line.split("=", 1)[1].strip()
    return answers().get("source") or "real-debrid"


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


NET_ERR = (
    urllib.error.URLError,
    urllib.error.HTTPError,
    TimeoutError,
    json.JSONDecodeError,
    ConnectionError,
    OSError,
)


def call(url: str, key: str | None = None, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    hdrs = {"Content-Type": "application/json"}
    if key:
        hdrs["X-Api-Key"] = key
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return json.loads(raw.decode()) if raw else None
    except urllib.error.HTTPError:
        raise
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        raise urllib.error.URLError(e)


def wait_key(xml: Path, seconds: int = 90) -> str | None:
    if not xml.exists():
        seconds = min(seconds, 12)
    deadline = time.time() + seconds
    while time.time() < deadline:
        k = api_key(xml)
        if k:
            return k
        time.sleep(2)
    return None


def compose_env() -> dict:
    env = os.environ.copy()
    p = COMPOSE / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env.setdefault(k.strip(), v.strip())
    return env


def compose(*args: str) -> None:
    subprocess.run(
        ["docker", "compose", *args],
        cwd=str(COMPOSE),
        env=compose_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )

def patch_decypharr() -> None:
    src = source()
    if src == "local-vpn":
        return
    slug = PROVIDER.get(src, "realdebrid")
    cfg: dict = {}
    if DECYPHARR.exists():
        try:
            cfg = json.loads(DECYPHARR.read_text())
        except json.JSONDecodeError:
            cfg = {}
    debrids = cfg.get("debrids") or [{}]
    entry = debrids[0] if debrids else {}
    entry["provider"] = slug
    entry["name"] = slug
    if answers().get("apiKey"):
        entry["api_key"] = answers()["apiKey"].strip()
    entry.setdefault("folder", "/mnt")
    entry["folder"] = "/mnt/debrid"
    entry["use_webdav"] = True
    cfg["debrids"] = [entry]
    Path("/mnt/debrid").mkdir(parents=True, exist_ok=True)
    Path("/opt/reelos/compose/configs/decypharr/cache/dfs").mkdir(parents=True, exist_ok=True)
    cfg["mount"] = {
        "type": "dfs",
        "mount_path": "/mnt/debrid",
        "dfs": {
            "cache_dir": "/app/cache/dfs",
            "uid": 1000,
            "gid": 1000,
            "umask": "002",
        },
    }
    cfg.setdefault(
        "qbittorrent",
        {"download_folder": "/mnt/symlinks", "categories": ["sonarr", "radarr", "lidarr"]},
    )
    cfg.setdefault("use_auth", False)
    cfg.setdefault("log_level", "info")
    cfg.setdefault("port", "8282")
    DECYPHARR.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(cfg, indent=2) + "\n"
    prev = DECYPHARR.read_text() if DECYPHARR.exists() else ""
    if text == prev:
        log_wire("decypharr config unchanged — restart to remount")
        subprocess.run(["docker", "restart", "decypharr"], check=False, capture_output=True)
        time.sleep(5)
        restart_fuse_readers()
        return
    DECYPHARR.write_text(text)
    compose("up", "-d", "--force-recreate", "decypharr")
    time.sleep(5)
    restart_fuse_readers()


def restart_fuse_readers() -> None:
    """Containers started before FUSE cannot see /mnt/debrid. Restart after mount."""
    if not Path("/mnt/debrid/version.txt").exists() and not Path("/mnt/debrid/__all__").exists():
        log_wire("fuse not up — skip reader restart")
        return
    for name in ("reelos-jellyfin-1", "reelos-radarr-1", "reelos-sonarr-1"):
        r = subprocess.run(["docker", "restart", name], capture_output=True, text=True, check=False)
        log_wire(f"restart {name} rc={r.returncode}")


def fuse_on_host() -> bool:
    return Path("/mnt/debrid/__all__").exists() or Path("/mnt/debrid/version.txt").exists()


def persist_mnt_shared() -> None:
    unit = """[Unit]
Description=ReelOS /mnt rshared so Decypharr FUSE is visible
DefaultDependencies=no
After=local-fs.target
Before=docker.service

[Service]
Type=oneshot
ExecStart=/bin/mkdir -p /mnt /mnt/debrid /mnt/symlinks
ExecStart=/bin/mount --bind /mnt /mnt
ExecStart=/bin/mount --make-rshared /mnt
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
"""
    path = Path("/etc/systemd/system/reelos-mnt-shared.service")
    try:
        if path.exists() and path.read_text() == unit:
            subprocess.run(["systemctl", "start", "reelos-mnt-shared"], check=False, capture_output=True)
            return
        path.write_text(unit)
        subprocess.run(["systemctl", "daemon-reload"], check=False, capture_output=True)
        subprocess.run(["systemctl", "enable", "--now", "reelos-mnt-shared"], check=False, capture_output=True)
        log_wire("mnt-shared unit enabled")
    except OSError as e:
        log_wire(f"mnt-shared unit {e}")


def wait_http(url: str, seconds: int = 40) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2).read()
            return True
        except Exception:
            time.sleep(1)
    return False


def kick_imports() -> None:
    wait_http("http://127.0.0.1:7878/ping", 40)
    wait_http("http://127.0.0.1:8989/ping", 40)
    radarr_xml = COMPOSE / "configs" / "radarr" / "config.xml"
    sonarr_xml = COMPOSE / "configs" / "sonarr" / "config.xml"
    rk = api_key(radarr_xml)
    sk = api_key(sonarr_xml)
    if rk:
        try:
            call(
                "http://127.0.0.1:7878/api/v3/command",
                rk,
                method="POST",
                body={"name": "DownloadedMoviesScan", "path": "/mnt/symlinks/radarr"},
            )
            call("http://127.0.0.1:7878/api/v3/command", rk, method="POST", body={"name": "RefreshMonitoredDownloads"})
            log_wire("radarr import scan")
        except Exception as e:
            log_wire(f"radarr scan {type(e).__name__} {e}")
    if sk:
        try:
            call(
                "http://127.0.0.1:8989/api/v3/command",
                sk,
                method="POST",
                body={"name": "DownloadedEpisodesScan", "path": "/mnt/symlinks/sonarr"},
            )
            call("http://127.0.0.1:8989/api/v3/command", sk, method="POST", body={"name": "RefreshMonitoredDownloads"})
            log_wire("sonarr import scan")
        except Exception as e:
            log_wire(f"sonarr scan {type(e).__name__} {e}")
    token = jellyfin_token()
    if token:
        try:
            call("http://127.0.0.1:8096/Library/Refresh", method="POST", headers={"X-Emby-Token": token})
            log_wire("jellyfin refresh after import")
        except Exception as e:
            log_wire(f"jellyfin refresh {type(e).__name__} {e}")
    else:
        log_wire("jellyfin refresh skipped — no token")


def ensure_fuse() -> None:
    persist_mnt_shared()
    share_mnt()
    if fuse_on_host():
        log_wire("fuse already on host")
        kick_imports()
        subprocess.run(["systemctl", "start", "caddy", "reelos"], check=False, capture_output=True)
        log_wire("door caddy/reelos started after fuse")
        return
    log_wire("fuse missing on host — recreate decypharr")
    subprocess.run(
        ["docker", "compose", "--profile", "debrid", "up", "-d", "--force-recreate", "decypharr"],
        cwd=str(COMPOSE),
        env=compose_env(),
        check=False,
        capture_output=True,
    )
    for _ in range(20):
        time.sleep(2)
        if fuse_on_host():
            log_wire("fuse on host")
            restart_fuse_readers()
            if not fuse_on_host():
                log_wire("fuse vanished after reader restart")
                continue
            kick_imports()
            subprocess.run(["systemctl", "start", "caddy", "reelos"], check=False, capture_output=True)
            log_wire("door caddy/reelos started after fuse")
            return
    log_wire("fuse still missing after recreate")



def root_paths(kind: str) -> list[str]:
    mode = answers().get("storageMode") or "both"
    paths: list[str] = []
    if mode in ("debrid", "both"):
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


HOST_FOR = {
    "/symlinks": "/mnt/symlinks",
    "/mnt/symlinks": "/mnt/symlinks",
    "/media/movies": "/srv/media/movies",
    "/media/tv": "/srv/media/tv",
    "/media/anime": "/srv/media/anime",
    "/media/music": "/srv/media/music",
}


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


def ensure_prowlarr_app(name: str, implementation: str, base_url: str, arr_key: str, prow_key: str) -> None:
    url = "http://127.0.0.1:9696/api/v1/applications"
    try:
        apps = call(url, prow_key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return
    for app in apps if isinstance(apps, list) else []:
        if app.get("name") == name:
            return
    body = {
        "name": name,
        "syncLevel": "addOnly",
        "implementation": implementation,
        "implementationName": implementation,
        "configContract": f"{implementation}Settings",
        "fields": [
            {"name": "prowlarrUrl", "value": "http://prowlarr:9696"},
            {"name": "baseUrl", "value": base_url},
            {"name": "apiKey", "value": arr_key},
        ],
    }
    try:
        call(url, prow_key, method="POST", body=body)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        pass


PROVIDER_HINTS = {
    "torbox": ("torbox",),
    "real-debrid": ("real-debrid", "realdebrid", "real debrid"),
    "alldebrid": ("alldebrid", "all-debrid", "all debrid"),
    "premiumize": ("premiumize",),
}

# Vendor-published Prowlarr Cardigann only. Not a tracker roster.
OFFICIAL_YML = {
    "torbox": "https://raw.githubusercontent.com/TorBox-App/torbox-prowlarr-indexers/main/torbox-torrents.yml",
}


def _schema_blob(schema: dict) -> str:
    parts = [
        str(schema.get("implementation") or ""),
        str(schema.get("implementationName") or ""),
        str(schema.get("name") or ""),
        str(schema.get("infoLink") or ""),
    ]
    for f in schema.get("fields") or []:
        if f.get("name") in ("definitionFile", "definitionName"):
            parts.append(str(f.get("value") or ""))
    return " ".join(parts).lower()


def _find_schema(prow_key: str, src: str):
    url = "http://127.0.0.1:9696/api/v1/indexer/schema"
    schemas = call(url, prow_key) or []
    hints = PROVIDER_HINTS.get(src, (src,))
    for schema in schemas if isinstance(schemas, list) else []:
        if any(h in _schema_blob(schema) for h in hints):
            return schema
    return None


def install_official_yml(src: str) -> bool:
    url = OFFICIAL_YML.get(src)
    if not url:
        log_wire(f"no official Prowlarr yml for {src}")
        return False
    dest_dir = COMPOSE / "configs" / "prowlarr" / "Definitions" / "Custom"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / Path(url).name
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ReelOS-wire"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
        log_wire(f"official yml {dest.name} -> {dest}")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        log_wire(f"official yml fetch failed {e}")
        return False
    subprocess.run(
        ["docker", "compose", "restart", "prowlarr"],
        cwd=str(COMPOSE),
        env=compose_env(),
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(12)
    return True


def _add_from_schema(prow_key: str, name: str, key: str, hit: dict) -> None:
    fields = []
    for f in hit.get("fields") or []:
        item = dict(f)
        n = str(item.get("name") or "")
        if n.lower() in ("apikey", "api_key", "api-key", "token"):
            item["value"] = key
        fields.append(item)
    body = {
        "enable": True,
        "appProfileId": hit.get("appProfileId") or 1,
        "priority": hit.get("priority") or 25,
        "name": name,
        "protocol": hit.get("protocol") or "torrent",
        "implementation": hit.get("implementation"),
        "implementationName": hit.get("implementationName"),
        "configContract": hit.get("configContract"),
        "fields": fields,
    }
    call("http://127.0.0.1:9696/api/v1/indexer", prow_key, method="POST", body=body)
    log_wire(f"provider indexer added {name} via {hit.get('implementation')}")


def torbox_search_ip() -> str:
    for cmd in (
        ["dig", "+short", "@1.1.1.1", "search-api.torbox.app", "A"],
        ["dig", "+short", "@8.8.8.8", "search-api.torbox.app", "A"],
        ["dig", "+short", "@1.1.1.1", "api.torbox.app", "A"],
    ):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
        for line in (r.stdout or "").splitlines():
            line = line.strip()
            if line.count(".") == 3 and line[0].isdigit():
                return line
    try:
        infos = socket.getaddrinfo("api.torbox.app", 443, socket.AF_INET)
        if infos:
            return str(infos[0][4][0])
    except OSError:
        pass
    return "172.66.170.114"


DNS_HOSTS = """    dns:
      - 1.1.1.1
      - 8.8.8.8
"""


def ensure_compose_dns() -> None:
    """Persist Docker DNS. Do not pin search-api to another hostname's A."""
    p = COMPOSE / "docker-compose.yml"
    if not p.exists():
        log_wire("compose yml missing")
        return
    stripped = strip_compose_extra_hosts()
    text = p.read_text()
    if "1.1.1.1" not in text:
        for port in ("9696:9696", "7878:7878", "8989:8989", "8282:8282"):
            old = f'      - "127.0.0.1:{port}"\n'
            new = f'      - "127.0.0.1:{port}"\n{DNS_HOSTS}'
            if old in text:
                text = text.replace(old, new, 1)
        p.write_text(text)
        log_wire("compose dns written")
        recreate_prowlarr()
        return
    if stripped or prowlarr_has_hosts():
        log_wire("dropping pinned extra_hosts")
        recreate_prowlarr()


def recreate_arrs() -> None:
    cmd = [
        "docker",
        "compose",
        "--profile",
        "indexers",
        "--profile",
        "movies",
        "--profile",
        "tv",
        "--profile",
        "debrid",
        "up",
        "-d",
        "--force-recreate",
        "--remove-orphans",
        "prowlarr",
        "radarr",
        "sonarr",
        "decypharr",
    ]
    r = subprocess.run(
        cmd,
        cwd=str(COMPOSE),
        env=compose_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    log_wire(f"compose recreate arrs rc={r.returncode}")
    time.sleep(10)


def prowlarr_has_hosts() -> bool:
    for name in ("reelos-prowlarr-1", "prowlarr"):
        r = subprocess.run(
            ["docker", "inspect", "-f", "{{json .HostConfig.ExtraHosts}}", name],
            capture_output=True,
            text=True,
            check=False,
        )
        if "search-api.torbox.app" in (r.stdout or ""):
            return True
    return False


def inject_search_api_hosts() -> None:
    """1.2.23: do not pin search-api.torbox.app to api.torbox.app's A."""
    log_wire("search-api extra_hosts skipped (use container DNS)")


def wait_prowlarr_api(prow_key: str, seconds: int = 90) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            call("http://127.0.0.1:9696/api/v1/indexer", prow_key)
            log_wire("prowlarr api ready")
            return True
        except NET_ERR as e:
            log_wire(f"prowlarr api wait {e}")
            time.sleep(3)
    set_releases_error("Prowlarr API never returned 200 after recreate")
    return False


def strip_compose_extra_hosts() -> bool:
    """Do not pin search-api to api.torbox.app's IP."""
    p = COMPOSE / "docker-compose.yml"
    if not p.exists():
        return False
    text = p.read_text()
    if "extra_hosts:" not in text:
        return False
    out = []
    skip = 0
    for line in text.splitlines(True):
        if skip:
            if line.startswith("      - ") and "torbox.app" in line:
                continue
            skip = 0
        if line.strip() == "extra_hosts:":
            skip = 1
            continue
        out.append(line)
    p.write_text("".join(out))
    log_wire("stripped extra_hosts from compose")
    return True


def set_releases_error(msg: str) -> None:
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        (STATE / "releases-error.txt").write_text(msg[:800] + "\n")
    except OSError:
        pass
    log_wire(msg)


def clear_releases_error() -> None:
    try:
        p = STATE / "releases-error.txt"
        if p.exists():
            p.unlink()
    except OSError:
        pass


def recreate_prowlarr() -> None:
    if os.environ.get("REELOS_OTA") and not prowlarr_has_hosts():
        running = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", "reelos-prowlarr-1"],
            capture_output=True,
            text=True,
            check=False,
        )
        if "true" in (running.stdout or ""):
            log_wire("prowlarr already up — skip recreate")
            return
    cmd = [
        "docker",
        "compose",
        "--profile",
        "indexers",
        "--profile",
        "debrid",
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "prowlarr",
        "decypharr",
    ]
    r = subprocess.run(
        cmd,
        cwd=str(COMPOSE),
        env=compose_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    log_wire(f"force-recreate prowlarr+decypharr rc={r.returncode}")
    time.sleep(8)


def add_torbox_torznab(prow_key: str, name: str, key: str) -> bool:
    """Generic Torznab at search-api.torbox.app. Schema optional."""
    impl = {
        "implementation": "Torznab",
        "implementationName": "Torznab",
        "configContract": "TorznabSettings",
        "appProfileId": 1,
        "protocol": "torrent",
    }
    fields = None
    try:
        schemas = call("http://127.0.0.1:9696/api/v1/indexer/schema", prow_key) or []
    except NET_ERR as e:
        log_wire(f"torznab schema {e}")
        schemas = []
    for schema in schemas if isinstance(schemas, list) else []:
        if str(schema.get("implementation") or "").lower() == "torznab":
            impl = schema
            fields = []
            for f in schema.get("fields") or []:
                item = dict(f)
                n = str(item.get("name") or "").lower()
                if n in ("baseurl", "base_url"):
                    item["value"] = "https://search-api.torbox.app"
                elif n in ("apipath", "api_path"):
                    item["value"] = "/torznab"
                elif n in ("apikey", "api_key"):
                    item["value"] = key
                fields.append(item)
            break
    if not fields:
        fields = [
            {"name": "baseUrl", "value": "https://search-api.torbox.app"},
            {"name": "apiPath", "value": "/torznab"},
            {"name": "apiKey", "value": key},
        ]
    body = {
        "enable": True,
        "appProfileId": impl.get("appProfileId") or 1,
        "priority": 25,
        "name": name,
        "protocol": impl.get("protocol") or "torrent",
        "implementation": impl.get("implementation") or "Torznab",
        "implementationName": impl.get("implementationName") or "Torznab",
        "configContract": impl.get("configContract") or "TorznabSettings",
        "fields": fields,
    }
    try:
        call("http://127.0.0.1:9696/api/v1/indexer", prow_key, method="POST", body=body)
        log_wire(f"provider indexer added {name} via Torznab search-api")
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:400] if e.fp else str(e)
        set_releases_error(f"Prowlarr {e.code}: {err}")
        if e.code == 400 and name.lower() in err.lower():
            return indexer_enabled(prow_key, name)
        return False
    except NET_ERR as e:
        set_releases_error(f"torznab POST failed {e}")
        return False


def indexer_test(prow_key: str, ix: dict) -> tuple[bool, str]:
    try:
        call(
            "http://127.0.0.1:9696/api/v1/indexer/test",
            prow_key,
            method="POST",
            body=ix,
        )
        return True, ""
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:400] if e.fp else str(e)
        return False, err or f"Prowlarr test {e.code}"
    except NET_ERR as e:
        return False, f"indexer test {e}"


def indexer_enabled(prow_key: str, name: str) -> bool:
    try:
        have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except NET_ERR:
        return False
    for ix in have if isinstance(have, list) else []:
        if ix.get("name") == name and ix.get("enable"):
            return True
    return False


# Prowlarr first-party public defs. Owner ordered EvoSeedbox-style fallback
# after search-api.torbox.app has no DNS.
PUBLIC_INDEXERS = (
    ("ReelOS-1337x", ("1337x",)),
    ("ReelOS-tpb", ("thepiratebay", "the pirate bay")),
    ("ReelOS-yts", ("yts", "yify")),
    ("ReelOS-eztv", ("eztv",)),
)


def ensure_public_indexers(prow_key: str) -> None:
    if os.environ.get("REELOS_OTA"):
        log_wire("OTA: skip public indexer tests")
        return
    wait_prowlarr_api(prow_key, 60)
    try:
        schemas = call("http://127.0.0.1:9696/api/v1/indexer/schema", prow_key) or []
        have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except NET_ERR as e:
        log_wire(f"public indexers list {e}")
        return
    if not isinstance(schemas, list):
        schemas = []
    rows = have if isinstance(have, list) else []
    names = {ix.get("name") for ix in rows}
    for name, hints in PUBLIC_INDEXERS:
        if name in names:
            log_wire(f"public indexer exists {name}")
            continue
        hit = next((s for s in schemas if any(h in _schema_blob(s) for h in hints)), None)
        if not hit:
            log_wire(f"public indexer no schema {name}")
            continue
        try:
            _add_from_schema(prow_key, name, "", hit)
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:300] if e.fp else str(e)
            log_wire(f"public indexer {name} {e.code}: {err}")
        except NET_ERR as e:
            log_wire(f"public indexer {name} {e}")
    tested = []
    try:
        have2 = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except NET_ERR:
        return
    for ix in have2 if isinstance(have2, list) else []:
        if not ix.get("enable"):
            continue
        ok_t, terr = indexer_test(prow_key, ix)
        n = ix.get("name")
        if ok_t:
            tested.append(str(n))
            log_wire(f"public indexer test ok {n}")
        else:
            log_wire(f"public indexer test fail {n} {terr[:200]}")
    if tested:
        clear_releases_error()
        log_wire("releases via " + ",".join(tested))
    elif not (STATE / "releases-error.txt").exists():
        set_releases_error("No public indexer passed Prowlarr test")


def ensure_provider_indexer(prow_key: str) -> None:
    """One official provider indexer. Failure is a log line, never a crash."""
    try:
        _ensure_provider_indexer(prow_key)
    except Exception as e:
        set_releases_error(f"provider indexer {type(e).__name__} {e}")


def _ensure_provider_indexer(prow_key: str) -> None:
    src = source()
    if src == "local-vpn":
        log_wire("provider indexer skipped (local-vpn)")
        return
    if os.environ.get("REELOS_OTA"):
        log_wire("OTA: skip torbox indexer wait")
        return
    key = (answers().get("apiKey") or "").strip()
    if not key:
        log_wire("provider indexer failed: no apiKey")
        return
    name = f"ReelOS-{src}"
    ensure_compose_dns()
    if not os.environ.get("REELOS_OTA"):
        recreate_prowlarr()
    prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"
    prow_key = wait_key(prow_xml, 90) or prow_key
    wait_prowlarr_api(prow_key, 90)
    inject_search_api_hosts()
    deadline = time.time() + 120
    yml_tried = False
    torznab_tried = False
    while time.time() < deadline:
        try:
            have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
        except NET_ERR as e:
            set_releases_error(f"Prowlarr list {e}")
            time.sleep(4)
            continue
        rows = have if isinstance(have, list) else []
        existing = next((ix for ix in rows if ix.get("name") == name), None)
        if existing:
            if not existing.get("enable"):
                try:
                    existing["enable"] = True
                    iid = existing.get("id")
                    call(
                        f"http://127.0.0.1:9696/api/v1/indexer/{iid}",
                        prow_key,
                        method="PUT",
                        body=existing,
                    )
                    log_wire(f"provider indexer enabled {name}")
                except urllib.error.HTTPError as e:
                    err = e.read().decode()[:400] if e.fp else str(e)
                    set_releases_error(f"Prowlarr enable {e.code}: {err}")
                    time.sleep(4)
                    continue
                except NET_ERR as e:
                    set_releases_error(f"provider indexer enable failed {e}")
                    time.sleep(4)
                    continue
            ok_t, terr = indexer_test(prow_key, existing)
            if ok_t:
                log_wire(f"provider indexer exists {name}")
                clear_releases_error()
                return
            set_releases_error(terr)
            time.sleep(4)
            continue
        hit = None
        try:
            hit = _find_schema(prow_key, src)
        except NET_ERR as e:
            log_wire(f"provider indexer schema retry {e}")
        if not hit and not yml_tried:
            log_wire(f"no first-party indexer in Prowlarr for {src} — installing official yml")
            if install_official_yml(src):
                yml_tried = True
                prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"
                prow_key = wait_key(prow_xml, 60) or prow_key
                wait_prowlarr_api(prow_key, 60)
                try:
                    hit = _find_schema(prow_key, src)
                except NET_ERR as e:
                    log_wire(f"provider indexer schema after yml failed {e}")
        if not hit:
            if src == "torbox" and not torznab_tried:
                torznab_tried = True
                add_torbox_torznab(prow_key, name, key)
                ix = next(
                    (
                        r
                        for r in (call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or [])
                        if r.get("name") == name and r.get("enable")
                    ),
                    None,
                )
                if ix:
                    ok_t, terr = indexer_test(prow_key, ix)
                    if ok_t:
                        clear_releases_error()
                        return
                    set_releases_error(terr)
            set_releases_error(f"{name} not in Prowlarr — no first-party schema")
            time.sleep(4)
            continue
        try:
            _add_from_schema(prow_key, name, key, hit)
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:400] if e.fp else str(e)
            set_releases_error(f"Prowlarr {e.code}: {err}")
            if "resolv" in err.lower():
                if os.environ.get("REELOS_OTA"):
                    log_wire("Name does not resolve — skip recreate during OTA")
                else:
                    log_wire("Name does not resolve — recreating Prowlarr")
                    recreate_prowlarr()
                    prow_key = wait_key(prow_xml, 60) or prow_key
                    inject_search_api_hosts()
        except NET_ERR as e:
            set_releases_error(f"provider indexer POST failed {e}")
        if indexer_enabled(prow_key, name):
            have2 = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
            ix = next((r for r in have2 if r.get("name") == name), None)
            if ix:
                ok_t, terr = indexer_test(prow_key, ix)
                if ok_t:
                    clear_releases_error()
                    return
                set_releases_error(terr)
        if src == "torbox" and not torznab_tried:
            torznab_tried = True
            add_torbox_torznab(prow_key, name, key)
            if indexer_enabled(prow_key, name):
                clear_releases_error()
                return
        time.sleep(4)
    err_now = ""
    try:
        err_now = (STATE / "releases-error.txt").read_text()
    except OSError:
        err_now = ""
    if "530" in err_now or "resolv" in err_now.lower():
        log_wire("STAMP FAIL keeping Prowlarr error")
        return
    set_releases_error(f"STAMP FAIL {name} missing after retry")


def transcode_override() -> None:
    dri = Path("/dev/dri")
    override = COMPOSE / "compose.override.yml"
    if not dri.exists():
        return
    override.write_text(
        "services:\n"
        "  jellyfin:\n"
        "    devices:\n"
        "      - /dev/dri:/dev/dri\n"
        "  plex:\n"
        "    devices:\n"
        "      - /dev/dri:/dev/dri\n"
    )
    subprocess.run(
        ["docker", "compose", "up", "-d"],
        cwd=str(COMPOSE),
        env=compose_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def mount_extra_disks() -> None:
    try:
        _mount_extra_disks()
    except Exception as exc:
        print(f"wire-engines: extra disks skipped: {exc}", file=sys.stderr)


def _mount_extra_disks() -> None:
    a = answers()
    selected = a.get("selectedDisks") or []
    format_ok = set(a.get("formatDisks") or [])
    os_dev = None
    try:
        os_dev = os.path.realpath("/dev/disk/by-label/cloudimg-rootfs")
    except OSError:
        pass
    for raw in selected:
        name = raw.replace("/dev/", "").strip()
        if not name or name.endswith("n1") and "nvme" in name and Path("/").stat().st_dev:
            pass
        dev = Path("/dev") / name
        if not dev.exists():
            continue
        real = os.path.realpath(dev)
        if os_dev and real == os_dev:
            continue
        # never format the disk that holds /
        try:
            root_src = subprocess.check_output(["findmnt", "-n", "-o", "SOURCE", "/"], text=True).strip()
            if real in root_src or root_src.startswith(real):
                continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        mnt = Path("/srv/media") / name
        mnt.mkdir(parents=True, exist_ok=True)
        try:
            if name in format_ok and not str(name).startswith("sdb"):
                mounted = subprocess.run(["findmnt", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
                has_fs = subprocess.run(["blkid", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
                if not mounted and not has_fs:
                    subprocess.run(["mkfs.ext4", "-F", "-L", f"reelos-{name}", str(dev)], check=False)
            line = f"{dev} {mnt} auto defaults,nofail 0 2"
            fstab = Path("/etc/fstab")
            text = fstab.read_text() if fstab.exists() else ""
            if str(dev) not in text:
                fstab.write_text(text.rstrip() + "\n" + line + "\n")
            r = subprocess.run(["mount", str(mnt)], check=False, capture_output=True, text=True)
            if r.returncode != 0:
                print(f"wire-engines: mount {dev} skipped: {(r.stderr or r.stdout or '').strip()}", file=sys.stderr)
        except Exception as exc:
            print(f"wire-engines: disk {name} skipped: {exc}", file=sys.stderr)


def jellyfin_authenticate(user: str, password: str) -> str | None:
    body = json.dumps({"Username": user, "Pw": password}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8096/Users/AuthenticateByName",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Emby-Authorization": 'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos", Version="1.2.1"',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            return data.get("AccessToken")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError, ConnectionError, OSError):
        return None


def jellyfin_token() -> str | None:
    a = answers()
    user = (a.get("adminName") or "reelos").strip() or "reelos"
    pw = (a.get("adminPassword") or "").strip()
    names: list[str] = []
    for n in (user, "reelos"):
        if n and n not in names:
            names.append(n)
    try:
        public = call("http://127.0.0.1:8096/Users/Public") or []
        for row in public if isinstance(public, list) else []:
            n = str(row.get("Name") or "").strip()
            if n and n not in names:
                names.append(n)
    except NET_ERR:
        pass
    pws: list[str] = []
    for p in (pw, "reelos", user):
        if p and p not in pws:
            pws.append(p)
    for n in names:
        for p in pws:
            tok = jellyfin_authenticate(n, p)
            if tok:
                log_wire(f"jellyfin auth as {n}")
                return tok
    return None


def log_wire(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {msg}\n"
    try:
        (STATE / "wire.log").open("a").write(line)
    except OSError:
        pass


def performance_low() -> bool:
    p = STATE / "performance.json"
    if not p.exists():
        try:
            STATE.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({"low": True}) + "\n")
        except OSError:
            return True
        return True
    try:
        return bool(json.loads(p.read_text()).get("low", True))
    except json.JSONDecodeError:
        return True


def apply_jellyfin_performance(token: str | None = None) -> None:
    token = token or jellyfin_token()
    if not token:
        log_wire("performance: jellyfin auth failed")
        return
    low = performance_low()
    flags = {
        "EnableTrickplayImageExtraction": not low,
        "ExtractTrickplayImagesDuringLibraryScan": not low,
        "EnableChapterImageExtraction": not low,
        "ExtractChapterImagesDuringLibraryScan": not low,
        "DummyChapterDuration": 0 if low else 300,
    }
    hdr = {"X-Emby-Token": token}
    try:
        folders = call("http://127.0.0.1:8096/Library/VirtualFolders", headers=hdr) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance folders {e}")
        folders = []
    for folder in folders if isinstance(folders, list) else []:
        fid = folder.get("ItemId") or folder.get("Guid") or folder.get("Id")
        if not fid:
            continue
        opts = dict(folder.get("LibraryOptions") or {})
        opts.update(flags)
        try:
            call(
                "http://127.0.0.1:8096/Library/VirtualFolders/LibraryOptions",
                method="POST",
                body={"Id": fid, "LibraryOptions": opts},
                headers=hdr,
            )
            log_wire(f"performance library {folder.get('Name')} low={low}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"performance library {folder.get('Name')} {e}")
    try:
        tasks = call("http://127.0.0.1:8096/ScheduledTasks", headers=hdr) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance tasks {e}")
        tasks = []
    for task in tasks if isinstance(tasks, list) else []:
        name = str(task.get("Name") or "")
        if "Trickplay" not in name and "Chapter Image" not in name and "Chapter Images" not in name:
            continue
        tid = task.get("Id")
        if not tid:
            continue
        try:
            if low:
                call(
                    f"http://127.0.0.1:8096/ScheduledTasks/{tid}/Triggers",
                    method="POST",
                    body=[],
                    headers=hdr,
                )
                log_wire(f"performance disabled task {name}")
            else:
                log_wire(f"performance left task {name} (flags restored)")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"performance task {name} {e}")


def jellyfin_folders(token: str):
    try:
        folders = call("http://127.0.0.1:8096/Library/VirtualFolders", headers={"X-Emby-Token": token}) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return []
    return folders if isinstance(folders, list) else []


def folder_has_symlinks(folder: dict) -> bool:
    locs = [str(x).rstrip("/") for x in (folder.get("Locations") or [])]
    opts = folder.get("LibraryOptions") or {}
    paths = [str(p.get("Path") or "").rstrip("/") for p in (opts.get("PathInfos") or [])]
    return "/symlinks" in locs + paths


def complete_jellyfin_startup(user: str, password: str) -> None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8096/System/Info/Public", timeout=5) as resp:
            info = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return
    if info.get("StartupWizardCompleted"):
        return
    try:
        call(
            "http://127.0.0.1:8096/Startup/Configuration",
            method="POST",
            body={
                "UICulture": "en-US",
                "MetadataCountryCode": "US",
                "PreferredMetadataLanguage": "en",
            },
        )
        call(
            "http://127.0.0.1:8096/Startup/RemoteAccess",
            method="POST",
            body={"EnableRemoteAccess": True, "EnableAutomaticPortMapping": False},
        )
        call(
            "http://127.0.0.1:8096/Startup/User",
            method="POST",
            body={"Name": user, "Password": password},
        )
        call("http://127.0.0.1:8096/Startup/Complete", method="POST", body={})
        log_wire("jellyfin startup complete")
        time.sleep(3)
    except NET_ERR as e:
        log_wire(f"jellyfin startup {e}")


def ensure_host_symlinks() -> None:
    Path("/mnt/symlinks").mkdir(parents=True, exist_ok=True)
    try:
        os.chmod("/mnt/symlinks", 0o777)
    except OSError:
        pass
    for name in ("reelos-jellyfin-1", "jellyfin"):
        r = subprocess.run(
            ["docker", "exec", name, "mkdir", "-p", "/symlinks"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if r.returncode == 0:
            break


def create_jellyfin_library(token: str, name: str, ctype: str) -> None:
    q = urllib.parse.urlencode(
        {
            "name": name,
            "collectionType": ctype,
            "refreshLibrary": "true",
            "paths": "/symlinks",
        }
    )
    body = {
        "LibraryOptions": {
            "EnableRealtimeMonitor": True,
            "EnableTrickplayImageExtraction": False,
            "ExtractTrickplayImagesDuringLibraryScan": False,
            "EnableChapterImageExtraction": False,
            "ExtractChapterImagesDuringLibraryScan": False,
            "DummyChapterDuration": 0,
            "PathInfos": [{"Path": "/symlinks"}],
        }
    }
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders?{q}",
        method="POST",
        body=body,
        headers={"X-Emby-Token": token},
    )


def add_jellyfin_path(token: str, name: str) -> None:
    q = urllib.parse.urlencode({"refreshLibrary": "true"})
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders/Paths?{q}",
        method="POST",
        body={"Name": name, "Path": "/symlinks", "PathInfo": {"Path": "/symlinks"}},
        headers={"X-Emby-Token": token},
    )


def libraries_ready(folders: list, want: list[tuple[str, str]]) -> bool:
    by_name = {str(f.get("Name") or ""): f for f in folders}
    for name, _ctype in want:
        folder = by_name.get(name)
        if not folder or not folder_has_symlinks(folder):
            return False
    return True


def reset_jellyfin_config() -> None:
    cfg = COMPOSE / "configs" / "jellyfin"
    log_wire("jellyfin config reset (keep images/volumes)")
    compose("stop", "jellyfin")
    if cfg.exists():
        for child in list(cfg.iterdir()):
            try:
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            except OSError as e:
                log_wire(f"jellyfin reset skip {child.name} {e}")
    compose("up", "-d", "jellyfin")


def wait_jellyfin(seconds: int = 90) -> dict | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8096/System/Info/Public", timeout=3) as resp:
                return json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError, OSError):
            time.sleep(2)
    return None


def ensure_jellyfin_libraries(token: str, want: list[tuple[str, str]]) -> bool:
    deadline = time.time() + 60
    while time.time() < deadline:
        folders = jellyfin_folders(token)
        if libraries_ready(folders, want):
            return True
        by_name = {str(f.get("Name") or ""): f for f in folders}
        for name, ctype in want:
            folder = by_name.get(name)
            try:
                if folder is None:
                    create_jellyfin_library(token, name, ctype)
                    log_wire(f"jellyfin library {name}")
                elif not folder_has_symlinks(folder):
                    add_jellyfin_path(token, name)
                    log_wire(f"jellyfin path {name} /symlinks")
            except urllib.error.HTTPError as e:
                err = e.read().decode()[:240] if e.fp else str(e)
                log_wire(f"jellyfin library {name} {e.code} {err}")
            except NET_ERR as e:
                log_wire(f"jellyfin library {name} {e}")
        time.sleep(3)
    return libraries_ready(jellyfin_folders(token), want)


def bootstrap_jellyfin() -> None:
    info = wait_jellyfin(90)
    if not info:
        log_wire("jellyfin not up")
        return
    a = answers()
    user = (a.get("adminName") or "reelos").strip() or "reelos"
    password = (a.get("adminPassword") or "reelos").strip() or "reelos"
    for path in ("/mnt/symlinks", "/srv/media/movies", "/srv/media/tv"):
        Path(path).mkdir(parents=True, exist_ok=True)
    ensure_host_symlinks()
    if not info.get("StartupWizardCompleted"):
        complete_jellyfin_startup(user, password)
    intent = a.get("intent") or {}
    want: list[tuple[str, str]] = []
    if intent.get("movies", True):
        want.append(("Movies", "movies"))
    if intent.get("tv") or intent.get("anime"):
        want.append(("Shows", "tvshows"))
    if intent.get("music"):
        want.append(("Music", "music"))
    token = jellyfin_token()
    if not token:
        if os.environ.get("REELOS_OTA"):
            log_wire("jellyfin auth mismatch — not resetting during OTA")
            return
        log_wire("jellyfin auth mismatch — resetting jellyfin config")
        reset_jellyfin_config()
        if not wait_jellyfin(90):
            log_wire("jellyfin not up after reset")
            return
        complete_jellyfin_startup(user, password)
        token = jellyfin_token()
    if not token:
        log_wire("jellyfin auth failed")
        return
    ready = ensure_jellyfin_libraries(token, want)
    if not ready:
        log_wire("jellyfin libraries missing after retry")
    else:
        log_wire("jellyfin libraries ready")
    apply_jellyfin_performance(token)
    try:
        call(
            "http://127.0.0.1:8096/Library/Refresh",
            method="POST",
            headers={"X-Emby-Token": token},
        )
        log_wire("jellyfin refresh")
    except NET_ERR as e:
        log_wire(f"jellyfin refresh {e}")


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


def wire_bazarr(radarr_key: str | None, sonarr_key: str | None) -> None:
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


def share_mnt() -> None:
    Path("/mnt").mkdir(parents=True, exist_ok=True)
    Path("/mnt/symlinks").mkdir(parents=True, exist_ok=True)
    Path("/mnt/debrid").mkdir(parents=True, exist_ok=True)
    subprocess.run(["mount", "--bind", "/mnt", "/mnt"], check=False, capture_output=True)
    r = subprocess.run(["mount", "--make-rshared", "/mnt"], check=False, capture_output=True, text=True)
    if r.returncode:
        log_wire(f"rshared /mnt skipped: {(r.stderr or r.stdout or '')[:160]}")
    else:
        log_wire("rshared /mnt")
    for p in ("/mnt/debrid", "/mnt/symlinks"):
        try:
            os.chmod(p, 0o777)
            os.chown(p, 1000, 1000)
        except OSError as e:
            log_wire(f"chmod {p} {e}")
    log_wire("fuse mountpoint writable")


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
                ensure_prowlarr_app("Radarr", "Radarr", "http://radarr:7878", radarr_key, prow_key)
        if sonarr_key:
            kind = "anime" if intent.get("anime") and not intent.get("tv") else "tv"
            ensure_roots("http://127.0.0.1:8989/api/v3", sonarr_key, kind)
            if intent.get("anime"):
                ensure_roots("http://127.0.0.1:8989/api/v3", sonarr_key, "anime")
            engine["sonarrQuality"] = quality_id("http://127.0.0.1:8989/api/v3", sonarr_key)
            if prow_key:
                ensure_prowlarr_app("Sonarr", "Sonarr", "http://sonarr:8989", sonarr_key, prow_key)
        if lidarr_key:
            ensure_roots("http://127.0.0.1:8686/api/v1", lidarr_key, "music")
            if prow_key:
                ensure_prowlarr_app("Lidarr", "Lidarr", "http://lidarr:8686", lidarr_key, prow_key)
    except Exception as e:
        log_wire(f"arr wire {type(e).__name__} {e}")

    try:
        wire_bazarr(radarr_key, sonarr_key)
    except Exception as e:
        log_wire(f"bazarr {type(e).__name__} {e}")
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
    return 0


if __name__ == "__main__":
    if "--performance" in sys.argv:
        apply_jellyfin_performance()
        raise SystemExit(0)
    if "fuse" in sys.argv:
        raise SystemExit(0 if ensure_fuse() is None else 0)
    raise SystemExit(main())
