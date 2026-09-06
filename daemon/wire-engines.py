#!/usr/bin/env python3
"""Idempotent engine wiring after wizard / Repair / OTA."""
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


def call(url: str, key: str | None = None, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    hdrs = {"Content-Type": "application/json"}
    if key:
        hdrs["X-Api-Key"] = key
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
        return json.loads(raw.decode()) if raw else None


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
    entry.setdefault("folder", "/mnt/debrid")
    entry["use_webdav"] = False
    cfg["debrids"] = [entry]
    cfg.setdefault(
        "qbittorrent",
        {"download_folder": "/mnt/symlinks", "categories": ["sonarr", "radarr", "lidarr"]},
    )
    cfg.setdefault("use_auth", False)
    cfg.setdefault("log_level", "info")
    cfg.setdefault("port", "8282")
    DECYPHARR.parent.mkdir(parents=True, exist_ok=True)
    DECYPHARR.write_text(json.dumps(cfg, indent=2) + "\n")
    compose("up", "-d", "--force-recreate", "decypharr")


def root_paths(kind: str) -> list[str]:
    mode = answers().get("storageMode") or "both"
    paths: list[str] = []
    if mode in ("debrid", "both"):
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
        if name in format_ok:
            # only if nothing is mounted and no filesystem
            mounted = subprocess.run(["findmnt", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
            has_fs = subprocess.run(["blkid", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
            if not mounted and not has_fs:
                subprocess.run(["mkfs.ext4", "-F", "-L", f"reelos-{name}", str(dev)], check=False)
        line = f"{dev} {mnt} auto defaults,nofail 0 2"
        fstab = Path("/etc/fstab")
        text = fstab.read_text() if fstab.exists() else ""
        if str(dev) not in text:
            fstab.write_text(text.rstrip() + "\n" + line + "\n")
        subprocess.run(["mount", str(mnt)], check=False)


def jellyfin_token() -> str | None:
    a = answers()
    user = a.get("adminName") or "reelos"
    password = a.get("adminPassword") or "reelos"
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
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return None


def log_wire(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {msg}\n"
    try:
        (STATE / "wire.log").open("a").write(line)
    except OSError:
        pass


def bootstrap_jellyfin() -> None:
    deadline = time.time() + 90
    info = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8096/System/Info/Public", timeout=3) as resp:
                info = json.loads(resp.read().decode())
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(2)
    if not info:
        log_wire("jellyfin not up")
        return
    a = answers()
    user = a.get("adminName") or "reelos"
    password = a.get("adminPassword") or "reelos"
    for path in ("/mnt/symlinks", "/srv/media/movies", "/srv/media/tv"):
        Path(path).mkdir(parents=True, exist_ok=True)
    if not info.get("StartupWizardCompleted"):
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
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"jellyfin startup {e}")
    token = jellyfin_token()
    if not token:
        log_wire("jellyfin auth failed")
        return
    intent = a.get("intent") or {}
    libs = []
    if intent.get("movies", True):
        libs.append(("Movies", "movies", ["/symlinks"]))
    if intent.get("tv") or intent.get("anime"):
        libs.append(("Shows", "tvshows", ["/symlinks"]))
    if intent.get("music"):
        libs.append(("Music", "music", ["/symlinks"]))
    existing = []
    try:
        folders = call("http://127.0.0.1:8096/Library/VirtualFolders", headers={"X-Emby-Token": token}) or []
        existing = [str(x.get("Name") or "") for x in folders]
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        existing = []
    for name, ctype, paths in libs:
        if name in existing:
            continue
        q = urllib.parse.urlencode({"name": name, "collectionType": ctype, "refreshLibrary": "true"})
        try:
            call(
                f"http://127.0.0.1:8096/Library/VirtualFolders?{q}",
                method="POST",
                body={
                    "LibraryOptions": {
                        "EnableRealtimeMonitor": True,
                        "PathInfos": [{"Path": p} for p in paths],
                    }
                },
                headers={"X-Emby-Token": token},
            )
            log_wire(f"jellyfin library {name}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"jellyfin library {name} {e}")
    try:
        call(
            "http://127.0.0.1:8096/Library/Refresh",
            method="POST",
            headers={"X-Emby-Token": token},
        )
        log_wire("jellyfin refresh")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
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


def main() -> int:
    STATE.mkdir(parents=True, exist_ok=True)
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
        patch_decypharr()
    transcode_override()

    a = answers()
    intent = a.get("intent") or {}
    frontend = a.get("frontend") or "jellyfin"

    radarr_xml = COMPOSE / "configs" / "radarr" / "config.xml"
    sonarr_xml = COMPOSE / "configs" / "sonarr" / "config.xml"
    lidarr_xml = COMPOSE / "configs" / "lidarr" / "config.xml"
    prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"

    radarr_key = wait_key(radarr_xml) if intent.get("movies", True) else None
    sonarr_key = wait_key(sonarr_xml) if intent.get("tv") or intent.get("anime") else None
    lidarr_key = wait_key(lidarr_xml) if intent.get("music") else None
    prow_key = wait_key(prow_xml)

    engine: dict = {"wiredAt": int(time.time()), "quality": a.get("quality")}

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

    if frontend in ("jellyfin", "both"):
        bootstrap_jellyfin()
    wire_bazarr(radarr_key, sonarr_key)
    extra_access()

    (STATE / "engine.json").write_text(json.dumps(engine, indent=2) + "\n")

    lock = ROOT / "bin" / "lock-download-clients.py"
    if lock.exists() and source() != "local-vpn":
        subprocess.run([sys.executable, str(lock)], check=False)
    kiosk = ROOT / "bin" / "kiosk.sh"
    if os.environ.get("REELOS_OTA") != "1" and kiosk.exists() and Path("/dev/dri").exists():
        subprocess.run(["bash", str(kiosk)], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
