"""Prowlarr, Torznab, and public indexer configuration and synchronization."""
from __future__ import annotations

import importlib.util
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
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
    compose,
    compose_env,
    log_wire,
    source,
    wait_http,
    wait_key,
)
from .fuse import fuse_on_host, fuse_unstack_stale
from .jellyfin import (
    ensure_jellyfin_libraries,
    heal_hybrid_1080_companions,
    jellyfin_token,
    jellyfin_want_libraries,
)

SONARR_SYNC_CATEGORIES = (5000, 5010, 5020, 5030, 5040, 5045, 5050, 5090, 8000)
RADARR_SYNC_CATEGORIES = (2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 8000)

PROVIDER_HINTS = {
    "torbox": ("torbox",),
    "real-debrid": ("real-debrid", "realdebrid", "rd"),
    "alldebrid": ("alldebrid", "ad"),
    "debrid-link": ("debrid-link", "debridlink", "dl"),
}

OFFICIAL_YML = {
    "torbox": "https://raw.githubusercontent.com/TorBox-App/torbox-indexers/main/torbox.yml",
}

PUBLIC_INDEXERS = (
    ("ReelOS-1337x", ("1337x",)),
    ("ReelOS-tpb", ("thepiratebay", "tpb")),
    ("ReelOS-yts", ("yts",)),
    ("ReelOS-eztv", ("eztv",)),
)

def prowlarr_app_sync_level() -> str:
    return "fullSync"


def _set_app_field(fields: list[dict], name: str, value) -> None:
    hit = next((f for f in fields if isinstance(f, dict) and f.get("name") == name), None)
    if hit is None:
        fields.append({"name": name, "value": value})
    else:
        hit["value"] = value


def prowlarr_app_fields(name: str, fields, *, prow_url: str | None = None, arr_url: str | None = None) -> list[dict]:
    """TorrentRss reports only 8000/Other; Sonarr must opt into it to receive RSS feeds.

    Radarr needs movie cats (2000+) or YTS/TPB never attach — Prowlarr-green is not MoviesSearch.
    """
    out = [dict(f) for f in (fields or []) if isinstance(f, dict)]
    if prow_url:
        _set_app_field(out, "prowlarrUrl", prow_url)
    if arr_url:
        _set_app_field(out, "baseUrl", arr_url)
    if name == "Sonarr":
        cats, extra = SONARR_SYNC_CATEGORIES, (8000,)
    elif name == "Radarr":
        cats, extra = RADARR_SYNC_CATEGORIES, RADARR_SYNC_CATEGORIES
    else:
        return out
    hit = next((f for f in out if f.get("name") == "syncCategories"), None)
    if hit is None:
        out.append({"name": "syncCategories", "value": list(cats)})
        return out
    values = hit.get("value") if isinstance(hit.get("value"), list) else []
    hit["value"] = list(dict.fromkeys([*values, *extra]))
    return out


def prowlarr_movie_cats_present(have) -> bool:
    """8000/Other is not a movie category. Radarr needs 2000-2999 or YTS/TPB never sync."""
    for c in have or []:
        try:
            n = int(c)
        except (TypeError, ValueError):
            continue
        if 2000 <= n < 3000:
            return True
    return False


def prowlarr_app_needs_update(app: dict | None, *, prow_url: str | None = None, arr_url: str | None = None) -> bool:
    if not app:
        return False
    if app.get("enable") is False:
        return True
    if str(app.get("syncLevel") or "") != prowlarr_app_sync_level():
        return True
    name = str(app.get("name") or "")
    fields = app.get("fields") or []
    sync = next((f for f in fields if isinstance(f, dict) and f.get("name") == "syncCategories"), None)
    have = sync.get("value") if sync and isinstance(sync.get("value"), list) else []
    if name == "Sonarr" and (not sync or 8000 not in have):
        return True
    if name == "Radarr" and (not sync or not prowlarr_movie_cats_present(have)):
        return True
    if prow_url:
        cur = next((f.get("value") for f in fields if isinstance(f, dict) and f.get("name") == "prowlarrUrl"), None)
        if cur != prow_url:
            return True
    if arr_url:
        cur = next((f.get("value") for f in fields if isinstance(f, dict) and f.get("name") == "baseUrl"), None)
        if cur != arr_url:
            return True
    return False


def docker_service_ip(service: str) -> str | None:
    """Inspect by container name. `docker compose ps` ETIMEDOUT on the house Apply."""
    names = [f"reelos-{service}-1", service]
    if service == "decypharr":
        names = ["decypharr", "reelos-decypharr-1"]
    for name in names:
        try:
            ins = subprocess.run(
                [
                    "docker",
                    "inspect",
                    "-f",
                    "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}",
                    name,
                ],
                capture_output=True,
                text=True,
                timeout=3,
            )
            ip = next((p for p in (ins.stdout or "").split() if p), "")
            if ip:
                return ip
        except (OSError, subprocess.TimeoutExpired):
            continue
    return None


def docker_service_url(service: str, port: int, fallback: str) -> str:
    """Hostname survives recreate. dns: 1.1.1.1 is gone so radarr/prowlarr resolve."""
    return f"http://{fallback}:{port}"


def ensure_prowlarr_app(name: str, implementation: str, base_url: str, arr_key: str, prow_key: str) -> None:
    """Keep Prowlarr→*arr enabled at fullSync so YTS/TPB land in Radarr and EZTV in Sonarr."""
    url = "http://127.0.0.1:9696/api/v1/applications"
    prow_url = docker_service_url("prowlarr", 9696, "prowlarr")
    try:
        apps = call(url, prow_key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return
    for app in apps if isinstance(apps, list) else []:
        if app.get("name") != name:
            continue
        if app.get("id") is not None and prowlarr_app_needs_update(app, prow_url=prow_url, arr_url=base_url):
            body = dict(app)
            body["enable"] = True
            body["syncLevel"] = prowlarr_app_sync_level()
            body["fields"] = prowlarr_app_fields(
                name, body.get("fields"), prow_url=prow_url, arr_url=base_url
            )
            try:
                call(f"{url}/{app['id']}", prow_key, method="PUT", body=body)
                suffix = " + 8000/Other" if name == "Sonarr" else " + movie cats"
                log_wire(f"prowlarr app {name} fullSync{suffix}")
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
                pass
        return
    body = {
        "name": name,
        "enable": True,
        "syncLevel": prowlarr_app_sync_level(),
        "implementation": implementation,
        "implementationName": implementation,
        "configContract": f"{implementation}Settings",
        "fields": prowlarr_app_fields(
            name,
            [
                {"name": "prowlarrUrl", "value": prow_url},
                {"name": "baseUrl", "value": base_url},
                {"name": "apiKey", "value": arr_key},
            ],
            prow_url=prow_url,
            arr_url=base_url,
        ),
    }
    try:
        call(url, prow_key, method="POST", body=body)
        log_wire(f"prowlarr app {name} added fullSync")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        pass


def sync_prowlarr_apps(prow_key: str) -> None:
    """Push current Prowlarr indexers into *arr. Wait — fire-and-forget left house *arr empty."""
    for name in ("ApplicationIndexerSync", "IndexerSync"):
        try:
            cmd = call(
                "http://127.0.0.1:9696/api/v1/command",
                prow_key,
                method="POST",
                body={"name": name, "forceSync": True},
            )
            cid = (cmd or {}).get("id") if isinstance(cmd, dict) else None
            if cid is not None:
                status = "queued"
                for _ in range(20):
                    time.sleep(0.5)
                    try:
                        row = call(f"http://127.0.0.1:9696/api/v1/command/{cid}", prow_key) or {}
                    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
                        break
                    status = str((row or {}).get("status") or "").lower()
                    if status in ("completed", "failed", "aborted"):
                        break
                log_wire(f"prowlarr {name} forceSync {status}")
            else:
                log_wire(f"prowlarr {name} forceSync")
            return
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
            continue
    log_wire("prowlarr sync command skipped")


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
    call(
        "http://127.0.0.1:9696/api/v1/indexer?forceSave=true",
        prow_key,
        method="POST",
        body=body,
    )
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


def ensure_compose_dns() -> None:
    """Do not pin search-api. Do not inject dns: 1.1.1.1 — that hid service names."""
    p = COMPOSE / "docker-compose.yml"
    if not p.exists():
        log_wire("compose yml missing")
        return
    stripped = strip_compose_extra_hosts()
    text = p.read_text()
    stripper = _load_public_indexers()
    if stripper and getattr(stripper, "strip_compose_dns_text", None):
        new, n = stripper.strip_compose_dns_text(text)
    else:
        block = "    dns:\n      - 1.1.1.1\n      - 8.8.8.8\n"
        n = text.count(block)
        new = text.replace(block, "") if n else text
    if n:
        p.write_text(new)
        log_wire(f"stripped compose dns ({n}) — Docker service names")
        recreate_arrs()
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
    ]
    if fuse_on_host():
        log_wire("fuse live — recreate *arr without decypharr")
    else:
        fuse_unstack_stale()
        cmd.append("decypharr")
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
    ]
    if fuse_on_host():
        log_wire("fuse live — recreate prowlarr only, not decypharr")
    else:
        fuse_unstack_stale()
        cmd.append("decypharr")
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
        call("http://127.0.0.1:9696/api/v1/indexer?forceSave=true", prow_key, method="POST", body=body)
        log_wire(f"provider indexer added {name} via Torznab search-api")
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:400] if e.fp else str(e)
        set_releases_error(f"Prowlarr {e.code}: {err}")
        return indexer_enabled(prow_key, name)
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


def _load_public_indexers():
    import importlib.util

    for raw in (
        Path(__file__).resolve().parent.parent / "public_indexers.py",
        Path(__file__).resolve().with_name("public_indexers.py"),
        Path("/opt/reelos/bin/public_indexers.py"),
        Path("/opt/reelos/daemon/public_indexers.py"),
    ):
        if not raw.is_file():
            continue
        spec = importlib.util.spec_from_file_location("reelos_public_indexers", raw)
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    return None


def _public_roster() -> list:
    """(name, hints). Module adds ShowRSS + roles; fallback is the in-file tuple."""
    mod = _load_public_indexers()
    if mod and getattr(mod, "PUBLIC_INDEXERS", None):
        return [(n, hints) for n, hints, _role in mod.PUBLIC_INDEXERS]
    return [(n, hints) for n, hints in PUBLIC_INDEXERS]


def _post_public_indexer(prow_key: str, name: str, body: dict, via: str) -> bool:
    mod = _load_public_indexers()
    url = (
        mod.prowlarr_indexer_write_url()
        if mod and getattr(mod, "prowlarr_indexer_write_url", None)
        else "http://127.0.0.1:9696/api/v1/indexer?forceSave=true"
    )
    try:
        call(url, prow_key, method="POST", body=body)
        log_wire(f"public indexer added {name} via {via}")
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:300] if e.fp else str(e)
        log_wire(f"public indexer {name} {e.code}: {err}")
        if e.code == 400 and name.lower() in err.lower():
            return indexer_enabled(prow_key, name)
        return indexer_enabled(prow_key, name)
    except NET_ERR as e:
        log_wire(f"public indexer {name} {e}")
        return indexer_enabled(prow_key, name)


def _hard_tv_rss_body(name: str, url: str) -> dict:
    """Inline TorrentRss when public_indexers.py is missing from bin/."""
    return {
        "enable": True,
        "appProfileId": 1,
        "priority": 25,
        "name": name,
        "protocol": "torrent",
        "implementation": "TorrentRssIndexer",
        "implementationName": "Torrent RSS Feed",
        "configContract": "TorrentRssIndexerSettings",
        "fields": [
            {"name": "baseUrl", "value": url},
            {"name": "allowZeroSize", "value": True},
        ],
    }


def ensure_public_indexers(prow_key: str) -> None:
    """Add missing publics even on OTA. Cardigann miss → TorrentRss RSS fallback.

    Schema GET must not abort the hop: house Prowlarr often has native TPB +
    TorrentRss and no Cardigann `eztv`/`showrss`. `wire-engines.py indexers`
    runs even when compose.yml is unchanged (UI/bin OTA). lock-clients does
    not gate this hop.
    """
    ota = bool(os.environ.get("REELOS_OTA")) or "indexers" in sys.argv
    wait_prowlarr_api(prow_key, 60)
    try:
        have = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except NET_ERR as e:
        log_wire(f"public indexers list {e}")
        return
    try:
        schemas = call("http://127.0.0.1:9696/api/v1/indexer/schema", prow_key) or []
    except NET_ERR as e:
        log_wire(f"public indexer schema {e} — RSS fallback")
        schemas = []
    if not isinstance(schemas, list):
        schemas = []
    rows = have if isinstance(have, list) else []
    mod = _load_public_indexers()

    def _post(name, body, via):
        return _post_public_indexer(prow_key, name, body, via)

    if mod and getattr(mod, "apply_public_indexers", None):
        mod.apply_public_indexers(rows, schemas, post=_post, log=log_wire)
    else:
        names = {ix.get("name") for ix in rows if isinstance(ix, dict)}
        for name, url in (
            ("ReelOS-eztv", "https://eztvx.to/ezrss.xml"),
            ("ReelOS-showrss", "https://showrss.info/other/all.rss"),
        ):
            if name in names:
                continue
            _post_public_indexer(prow_key, name, _hard_tv_rss_body(name, url), "rss fallback")
    try:
        have2v = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
    except NET_ERR:
        have2v = []
    if mod and getattr(mod, "doctor_releases_detail", None):
        detail, ready = mod.doctor_releases_detail(mod.enabled_indexer_names(have2v))
        log_wire(f"public TV indexers {detail}")
        if not ready:
            for req in mod.required_tv_public_names():
                have_names = [ix.get("name") for ix in have2v if isinstance(ix, dict)]
                if req in have_names:
                    continue
                feeds = mod.rss_feeds_for(req)
                if not feeds:
                    continue
                body = mod.torrent_rss_body(
                    req,
                    feeds[0],
                    mod.match_schema(schemas, mod.RSS_SCHEMA_HINTS),
                )
                _post_public_indexer(prow_key, req, body, "rss fallback")
            try:
                have2v = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
            except NET_ERR:
                have2v = []
            detail, _ready = mod.doctor_releases_detail(mod.enabled_indexer_names(have2v))
            log_wire(f"public TV indexers {detail}")
    if ota:
        log_wire("OTA: public indexer add pass complete, skip live tests")
        return
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
                        f"http://127.0.0.1:9696/api/v1/indexer/{iid}?forceSave=true",
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
            log_wire(f"provider indexer attached {name} — live test failed, keep for house/LAN")
            return
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
                log_wire(f"provider indexer attached {name} — live test failed, keep for house/LAN")
                return
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


def ensure_arr_search_indexers(name: str, origin: str, arr_key: str, prow_key: str, role: str) -> bool:
    """After ApplicationIndexerSync: enable search flags, then Torznab-attach if *arr is still empty."""
    mod = _load_public_indexers()
    if not mod or not getattr(mod, "apply_arr_search_indexers", None):
        log_wire(f"{name} search indexers skip — no public_indexers")
        return False
    def read_prow_rows() -> list:
        try:
            rows = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
        except NET_ERR as e:
            log_wire(f"{name} prow list {e}")
            return []
        return rows if isinstance(rows, list) else []

    prow_rows = read_prow_rows()
    write_url = (
        mod.arr_indexer_write_url(origin)
        if getattr(mod, "arr_indexer_write_url", None)
        else f"{origin}/indexer?forceSave=true"
    )
    prow_host = "prowlarr"
    schema = None
    try:
        schemas = call(f"{origin}/indexer/schema", arr_key) or []
        schema = mod.pick_torznab_schema(schemas) if getattr(mod, "pick_torznab_schema", None) else None
    except NET_ERR as e:
        log_wire(f"{name} indexer schema {e}")

    def read_arr_rows() -> list:
        try:
            rows = call(f"{origin}/indexer", arr_key) or []
        except NET_ERR as e:
            log_wire(f"{name} indexer list {e}")
            rows = []
        return rows if isinstance(rows, list) else []

    def post(ix_name, body):
        try:
            call(write_url, arr_key, method="POST", body=body)
            log_wire(f"{name} torznab {ix_name}")
            status = 200
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"{name} torznab {ix_name} {e.code}: {err}")
            # 400 + name is not attached. House #67 treated it as success and left *arr empty.
            status = int(getattr(e, "code", 0) or 0)
        except NET_ERR as e:
            log_wire(f"{name} torznab {ix_name} {e}")
            return False
        rows = read_arr_rows()
        if getattr(mod, "arr_indexer_write_landed", None):
            return mod.arr_indexer_write_landed(status, rows, role)
        _, good = mod.arr_search_indexers_ok(rows, role)
        return 200 <= status < 300 and good

    def put(iid, body):
        put_url = (
            mod.arr_indexer_write_url(origin, iid)
            if getattr(mod, "arr_indexer_write_url", None)
            else f"{origin}/indexer/{iid}?forceSave=true"
        )
        try:
            call(put_url, arr_key, method="PUT", body=body)
            log_wire(f"{name} indexer {body.get('name')} search enabled")
            return True
        except NET_ERR as e:
            log_wire(f"{name} indexer enable {e}")
            return False

    # A just-(re)created arr answers /indexer with an error for 10-30s (longer on
    # a loaded low-power box). The short attach loop below then reads zero rows
    # and wrongly logs "no enabled indexer" heal red even though the indexers are
    # persisted on the config volume. Wait for the API to come up first so the
    # check judges a ready arr, not a starting one.
    for _ in range(45):
        try:
            status = call(f"{origin}/system/status", arr_key)
            if isinstance(status, dict) and status.get("version"):
                break
        except NET_ERR:
            pass
        time.sleep(2)

    arr_rows: list = []
    for attempt in range(5):
        arr_rows = read_arr_rows()
        detail, good = mod.arr_search_indexers_ok(arr_rows, role)
        if good:
            log_wire(f"{name} search indexers {detail}")
            return True
        # A one-shot Prowlarr read makes every retry a no-op and turns a blip into heal red.
        if not prow_rows:
            prow_rows = read_prow_rows()
        if schema is None:
            try:
                schemas = call(f"{origin}/indexer/schema", arr_key) or []
                schema = mod.pick_torznab_schema(schemas) if getattr(mod, "pick_torznab_schema", None) else None
            except NET_ERR:
                schema = None
        landed = mod.apply_arr_search_indexers(
            prow_rows, arr_rows, role, prow_key, post, put, schema=schema, prow_host=prow_host
        )
        if landed:
            log_wire(f"{name} attached {','.join(landed)}")
            # Re-read immediately so a last-attempt attach is not judged on stale pre-apply rows.
            arr_rows = read_arr_rows()
            detail, good = mod.arr_search_indexers_ok(arr_rows, role)
            if good:
                log_wire(f"{name} search indexers {detail}")
                return True
        elif attempt < 4:
            time.sleep(0.4)
    # Final ok must re-read post-apply rows, not stale pre-apply.
    arr_rows = read_arr_rows()
    detail, good = mod.arr_search_indexers_ok(arr_rows, role)
    if not good:
        log_wire(f"{name} search indexers heal red {detail}")
    else:
        log_wire(f"{name} search indexers {detail}")
    return good


def research_missing_after_indexers() -> None:
    """Lock Decypharr client, then SeasonSearch 0-file seasons against new EZTV/ShowRSS."""
    lock = ROOT / "bin" / "lock-download-clients.py"
    if not lock.is_file():
        lock = Path("/opt/reelos/bin/lock-download-clients.py")
    if lock.is_file():
        try:
            subprocess.run([sys.executable, str(lock), "--quick"], check=False, timeout=20)
            log_wire("download client locked before SeasonSearch")
        except Exception as e:
            log_wire(f"lock-clients {type(e).__name__} {e}")
    sweep = ROOT / "bin" / "stuck-downloads.py"
    if not sweep.is_file():
        sweep = Path("/opt/reelos/bin/stuck-downloads.py")
    if not sweep.is_file():
        return
    try:
        subprocess.run(
            [sys.executable, str(sweep), "--research-missing"],
            check=False,
            timeout=90,
        )
        log_wire("SeasonSearch re-fired after indexer sync")
        heal_hybrid_1080_companions()
    except Exception as e:
        log_wire(f"research-missing {type(e).__name__} {e}")


def ensure_indexers_and_sync() -> int:
    """OTA/Apply hop: add missing public TV indexers and fullSync them to *arr."""
    prow_xml = COMPOSE / "configs" / "prowlarr" / "config.xml"
    prow_key = wait_key(prow_xml, 40)
    if not prow_key:
        log_wire("indexers skip — no Prowlarr key")
        return 0
    try:
        ensure_public_indexers(prow_key)
    except Exception as e:
        log_wire(f"public indexers {type(e).__name__} {e}")
    a = answers()
    intent = a.get("intent") or {}
    radarr_key = wait_key(COMPOSE / "configs" / "radarr" / "config.xml") if intent.get("movies", True) else None
    sonarr_key = wait_key(COMPOSE / "configs" / "sonarr" / "config.xml") if intent.get("tv") or intent.get("anime") else None
    rc_sync = True
    try:
        if radarr_key:
            ensure_prowlarr_app(
                "Radarr", "Radarr", docker_service_url("radarr", 7878, "radarr"), radarr_key, prow_key
            )
        if sonarr_key:
            ensure_prowlarr_app(
                "Sonarr", "Sonarr", docker_service_url("sonarr", 8989, "sonarr"), sonarr_key, prow_key
            )
        sync_prowlarr_apps(prow_key)
        if radarr_key and not ensure_arr_search_indexers(
            "Radarr", "http://127.0.0.1:7878/api/v3", radarr_key, prow_key, "movie"
        ):
            rc_sync = False
        if sonarr_key and not ensure_arr_search_indexers(
            "Sonarr", "http://127.0.0.1:8989/api/v3", sonarr_key, prow_key, "tv"
        ):
            rc_sync = False
        if not rc_sync:
            log_wire("prowlarr fullSync did not land search indexers on *arr")
    except Exception as e:
        log_wire(f"prowlarr sync {type(e).__name__} {e}")
        rc_sync = False
    try:
        from .arr import widen_sonarr_hybrid
        widen_sonarr_hybrid()
    except Exception as e:
        log_wire(f"sonarr hybrid {type(e).__name__} {e}")
    try:
        from .arr import widen_radarr_hybrid
        widen_radarr_hybrid()
    except Exception as e:
        log_wire(f"radarr hybrid {type(e).__name__} {e}")
    rc = 0 if rc_sync else 1
    try:
        jf_token = jellyfin_token()
        frontend = (a.get("frontend") or "jellyfin")
        if jf_token:
            want = jellyfin_want_libraries()
            if ensure_jellyfin_libraries(jf_token, want, collapse_dumps=False):
                log_wire("jellyfin libraries one dump path each")
            else:
                log_wire("jellyfin libraries missing after retry")
                rc = 1
        elif frontend in ("jellyfin", "both"):
            log_wire("jellyfin libraries skip — no token")
            rc = 1
    except Exception as e:
        log_wire(f"jellyfin libraries {type(e).__name__} {e}")
        rc = 1
    if prow_key:
        try:
            rows = call("http://127.0.0.1:9696/api/v1/indexer", prow_key) or []
            mod = _load_public_indexers()
            names = mod.enabled_indexer_names(rows) if mod else []
            if mod:
                _detail, good = mod.doctor_releases_detail(names)
                if not good:
                    log_wire(f"indexers heal red {_detail}")
                    rc = 1
        except Exception as e:
            log_wire(f"indexers verify {type(e).__name__} {e}")
            rc = 1
    try:
        if rc == 0:
            research_missing_after_indexers()
        else:
            log_wire("research-missing skipped — indexer heal red")
    except Exception as e:
        log_wire(f"research-missing {type(e).__name__} {e}")
    return rc
