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


def indexer_enabled(prow_key: str, name: str) -> bool:
    try:
        have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return False
    for ix in have if isinstance(have, list) else []:
        if ix.get("name") == name and ix.get("enable"):
            return True
    return False


def ensure_provider_indexer(prow_key: str) -> None:
    """One official provider indexer. Not a tracker roster. Skip local-vpn. Retry until enabled."""
    src = source()
    if src == "local-vpn":
        log_wire("provider indexer skipped (local-vpn)")
        return
    key = (answers().get("apiKey") or "").strip()
    if not key:
        log_wire("provider indexer failed: no apiKey")
        return
    name = f"ReelOS-{src}"
    deadline = time.time() + 90
    yml_tried = False
    while time.time() < deadline:
        try:
            have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"provider indexer list retry {e}")
            time.sleep(4)
            continue
        rows = have if isinstance(have, list) else []
        existing = next((ix for ix in rows if ix.get("name") == name), None)
        if existing:
            if existing.get("enable"):
                log_wire(f"provider indexer exists {name}")
                return
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
                return
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
                log_wire(f"provider indexer enable failed {e}")
        hit = None
        try:
            hit = _find_schema(prow_key, src)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"provider indexer schema retry {e}")
        if not hit and not yml_tried:
            log_wire(f"no first-party indexer in Prowlarr for {src} — installing official yml")
            if install_official_yml(src):
                yml_tried = True
                prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"
                prow_key = wait_key(prow_xml, 60) or prow_key
                try:
                    hit = _find_schema(prow_key, src)
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
                    log_wire(f"provider indexer schema after yml failed {e}")
        if not hit:
            log_wire(f"provider indexer missing after official yml for {src}")
            time.sleep(4)
            continue
        try:
            _add_from_schema(prow_key, name, key, hit)
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"provider indexer POST failed {e.code} {err}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            log_wire(f"provider indexer POST failed {e}")
        if indexer_enabled(prow_key, name):
            return
        time.sleep(4)
    log_wire(f"provider indexer missing after retry for {src}")


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
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
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


def bootstrap_jellyfin() -> None:
    deadline = time.time() + 120
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
    ensure_host_symlinks()
    complete_jellyfin_startup(user, password)
    intent = a.get("intent") or {}
    want: list[tuple[str, str]] = []
    if intent.get("movies", True):
        want.append(("Movies", "movies"))
    if intent.get("tv") or intent.get("anime"):
        want.append(("Shows", "tvshows"))
    if intent.get("music"):
        want.append(("Music", "music"))
    token = None
    ready = False
    while time.time() < deadline:
        complete_jellyfin_startup(user, password)
        token = jellyfin_token()
        if not token:
            log_wire("jellyfin auth retry")
            time.sleep(3)
            continue
        folders = jellyfin_folders(token)
        if libraries_ready(folders, want):
            ready = True
            break
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
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                log_wire(f"jellyfin library {name} {e}")
        time.sleep(3)
    if not token:
        log_wire("jellyfin auth failed")
        return
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
    if prow_key:
        ensure_provider_indexer(prow_key)

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
    if "--performance" in sys.argv:
        apply_jellyfin_performance()
        raise SystemExit(0)
    raise SystemExit(main())
