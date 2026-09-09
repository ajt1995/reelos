#!/usr/bin/env python3
"""ReelOS doctor — JSON health for Settings and the CLI."""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
COMPOSE = ROOT / "compose"
STATE = Path("/var/lib/reelos")


def ok(label: str, detail: str, good: bool = True) -> dict:
    return {"ok": good, "label": label, "detail": detail}


def last_log(name: str) -> str:
    try:
        out = subprocess.check_output(
            ["docker", "logs", "--tail", "1", name],
            text=True,
            timeout=4,
            stderr=subprocess.STDOUT,
        )
        return (out or "").strip().splitlines()[-1][:120] if out.strip() else ""
    except Exception:
        return ""


def container_hop(name: str, label: str, port: int) -> dict:
    status = ""
    try:
        status = subprocess.check_output(
            ["docker", "ps", "-a", "--filter", f"name={name}", "--format", "{{.Status}}"],
            text=True,
            timeout=4,
        ).strip()
    except Exception:
        status = ""
    if "Restarting" in status:
        line = last_log(name)
        return ok(label, f"{name} restarting" + (f" — {line}" if line else ""), False)
    if listening(port) or status.startswith("Up"):
        return ok(label, f"{name} up", True)
    return ok(label, f"{name} dead {status}"[:80], False)


def api_key(xml: Path) -> bool:
    if not xml.exists():
        return False
    try:
        node = ET.parse(xml).getroot().find("ApiKey")
    except ET.ParseError:
        return False
    return bool(node is not None and node.text)


def xml_key_text(xml: Path) -> str:
    if not xml.exists():
        return ""
    try:
        node = ET.parse(xml).getroot().find("ApiKey")
    except ET.ParseError:
        return ""
    return (node.text or "").strip() if node is not None else ""


def last_releases_error() -> str:
    p = STATE / "releases-error.txt"
    try:
        t = p.read_text().strip()
    except OSError:
        return ""
    return t[:240]


def _load_public_indexers():
    import importlib.util

    for raw in (
        Path(__file__).resolve().with_name("public_indexers.py"),
        Path("/opt/reelos/bin/public_indexers.py"),
        Path("/workspace/daemon/public_indexers.py"),
    ):
        if not raw.is_file():
            continue
        spec = importlib.util.spec_from_file_location("reelos_public_indexers_doc", raw)
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    return None


def releases_hop(answers: dict) -> dict:
    """List every enabled Prowlarr indexer. Do not hide EZTV behind a TPB live test."""
    key = xml_key_text(COMPOSE / "configs" / "prowlarr" / "config.xml")
    if not key:
        return ok("releases", last_releases_error() or "Prowlarr has no API key", False)
    try:
        import urllib.request

        req = urllib.request.Request(
            "http://127.0.0.1:9696/api/v1/indexer",
            headers={"X-Api-Key": key},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode() or "[]")
    except Exception as e:
        return ok("releases", last_releases_error() or f"{type(e).__name__}: {e}", False)
    rows = data if isinstance(data, list) else []
    mod = _load_public_indexers()
    if mod:
        names = mod.enabled_indexer_names(rows)
        detail, good = mod.doctor_releases_detail(names)
        if not names:
            return ok("releases", last_releases_error() or "No indexer enabled", False)
        return ok("releases", detail, good)
    enabled = [ix for ix in rows if isinstance(ix, dict) and ix.get("enable")]
    if not enabled:
        return ok("releases", last_releases_error() or "No indexer enabled", False)
    names = [str(ix.get("name") or "") for ix in enabled if ix.get("name")]
    return ok("releases", ",".join(names), True)


def _decypharr_client_ok(rows) -> bool:
    clients = rows if isinstance(rows, list) else []
    for c in clients:
        if not isinstance(c, dict) or c.get("implementation") != "QBittorrent":
            continue
        if c.get("enable") is False:
            continue
        host = ""
        port = None
        for f in c.get("fields") or []:
            if not isinstance(f, dict):
                continue
            if f.get("name") == "host":
                host = str(f.get("value") or "")
            if f.get("name") == "port":
                port = f.get("value")
        if host == "decypharr" and int(port or 0) == 8282:
            return True
    return False


def download_lock_hop() -> dict:
    """Do not always-OK. SeasonSearch/MoviesSearch with no Decypharr client grabs nothing."""
    failed = False
    try:
        r = subprocess.run(
            ["systemctl", "is-failed", "reelos-lock-clients.service"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        failed = r.returncode == 0
    except Exception:
        failed = False
    import urllib.request

    parts = []
    missing = []
    for name, port, missing_detail in (
        ("Sonarr", 8989, "Sonarr has no Decypharr client — SeasonSearch cannot grab"),
        ("Radarr", 7878, "Radarr has no Decypharr client — MoviesSearch cannot grab"),
    ):
        key = xml_key_text(COMPOSE / "configs" / name.lower() / "config.xml")
        if not key:
            continue
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/v3/downloadclient",
                headers={"X-Api-Key": key},
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                rows = json.loads(resp.read().decode() or "[]")
            if _decypharr_client_ok(rows):
                parts.append(f"{name} → Decypharr")
            else:
                missing.append(missing_detail)
        except Exception as e:
            missing.append(f"{name} downloadclient {type(e).__name__}")
    if missing:
        detail = "; ".join(missing)
        if failed:
            detail += " (lock-clients unit failed last run)"
        return ok("Download lock", detail, False)
    if parts:
        detail = ", ".join(parts)
        if failed:
            detail += " (lock-clients unit failed last run)"
        return ok("Download lock", detail, True)
    if failed:
        return ok("Download lock", "reelos-lock-clients.service FAILED", False)
    return ok("Download lock", "Could not probe Radarr/Sonarr download clients", False)


def jellyfin_folder_paths(folder: dict) -> list[str]:
    locs = folder.get("Locations") or []
    infos = ((folder.get("LibraryOptions") or {}).get("PathInfos") or [])
    paths = [str(p) for p in locs if p]
    for info in infos:
        if isinstance(info, dict) and info.get("Path"):
            paths.append(str(info["Path"]))
    return paths


def doctor_jellyfin_library_detail(folders, want=("Movies", "Shows")) -> tuple[str, bool]:
    """TCP :8096 is not a library heal. Movies/Shows must have dump paths, not extra dump roots."""
    rows = folders if isinstance(folders, list) else []
    by_name = {str(f.get("Name") or ""): f for f in rows if isinstance(f, dict)}
    problems = []
    parts = []
    expect = {"Movies": "radarr", "Shows": "sonarr"}
    for name in want:
        folder = by_name.get(name)
        if not folder:
            problems.append(f"{name} missing")
            continue
        paths = jellyfin_folder_paths(folder)
        needle = expect.get(name) or ""
        dump_ok = any(needle in p.replace("\\", "/") for p in paths) or any("/media/" in p for p in paths)
        if not dump_ok:
            problems.append(f"{name} has no dump/keep path")
        if any(p.rstrip("/") in ("/symlinks", "/mnt/symlinks") for p in paths):
            problems.append(f"{name} extra dump root")
        parts.append(f"{name}:{','.join(paths) or 'none'}")
    extra = [n for n in by_name if n not in want and n in ("TV", "Movies 2", "TV Shows")]
    if extra:
        problems.append("extra " + ",".join(extra))
    if problems:
        return f"{'; '.join(problems)} ({'; '.join(parts)})", False
    return "; ".join(parts) or "no libraries", True


def _arr_json(url: str, key: str):
    import urllib.request

    req = urllib.request.Request(url, headers={"X-Api-Key": key, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode() or "[]")


def _indexer_can_search(ix: dict) -> bool:
    if not isinstance(ix, dict) or not ix.get("enable"):
        return False
    if ix.get("enableAutomaticSearch") is False and ix.get("enableInteractiveSearch") is False:
        return False
    return True


def lookup_is_usable(lookup) -> bool:
    if not isinstance(lookup, list) or not lookup:
        return False
    return any(isinstance(x, dict) and (x.get("tmdbId") or x.get("title")) for x in lookup)


def request_hop_detail(*, radarr_up: bool, clients, indexers, lookup=None) -> tuple[str, bool]:
    """Port+key is not a request hop. MoviesSearch needs client + search indexer + lookup."""
    if not radarr_up:
        return "request dead — Radarr", False
    if not _decypharr_client_ok(clients):
        return "Radarr has no Decypharr client — MoviesSearch cannot land", False
    enabled = [ix for ix in (indexers or []) if _indexer_can_search(ix)]
    if not enabled:
        return "Radarr has no search indexer — MoviesSearch cannot land", False
    if lookup is not None and not lookup_is_usable(lookup):
        return "Radarr movie lookup failed — add/search path dead", False
    return "Radarr accepts adds + search path", True


def request_hop() -> dict:
    key = xml_key_text(COMPOSE / "configs" / "radarr" / "config.xml")
    up = listening(7878) and bool(key)
    if not up:
        return ok("Request hop", "request dead — Radarr", False)
    try:
        clients = _arr_json("http://127.0.0.1:7878/api/v3/downloadclient", key)
        indexers = _arr_json("http://127.0.0.1:7878/api/v3/indexer", key)
    except Exception as e:
        return ok("Request hop", f"Radarr API {type(e).__name__}", False)
    detail, good = request_hop_detail(radarr_up=True, clients=clients, indexers=indexers)
    if not good:
        return ok("Request hop", detail, False)
    try:
        from urllib.parse import quote

        lookup = _arr_json(f"http://127.0.0.1:7878/api/v3/movie/lookup?term={quote('Batman')}", key)
    except Exception as e:
        return ok("Request hop", f"Radarr movie lookup {type(e).__name__}", False)
    detail, good = request_hop_detail(radarr_up=True, clients=clients, indexers=indexers, lookup=lookup)
    return ok("Request hop", detail, good)


def sonarr_indexers_hop() -> dict:
    key = xml_key_text(COMPOSE / "configs" / "sonarr" / "config.xml")
    if not key:
        return ok("Sonarr indexers", "Sonarr has no API key", False)
    if not listening(8989):
        return ok("Sonarr indexers", "Sonarr not up", False)
    try:
        rows = _arr_json("http://127.0.0.1:8989/api/v3/indexer", key)
    except Exception as e:
        return ok("Sonarr indexers", f"{type(e).__name__}: {e}", False)
    mod = _load_public_indexers()
    if mod and getattr(mod, "doctor_sonarr_indexers_detail", None):
        detail, good = mod.doctor_sonarr_indexers_detail(rows if isinstance(rows, list) else [])
        return ok("Sonarr indexers", detail, good)
    enabled = [ix for ix in (rows or []) if isinstance(ix, dict) and ix.get("enable")]
    if not enabled:
        return ok("Sonarr indexers", "Sonarr has no enabled indexer — SeasonSearch cannot land", False)
    return ok("Sonarr indexers", ",".join(str(ix.get("name") or "") for ix in enabled), True)


def jellyfin_api_token() -> str:
    try:
        return (STATE / "jellyfin.token").read_text().strip()
    except OSError:
        return ""


def jellyfin_libraries_hop() -> dict:
    """TCP :8096 is not a library. Read VirtualFolders with the house token."""
    if not listening(8096):
        return ok("Jellyfin libraries", "Not up", False)
    token = jellyfin_api_token()
    if not token:
        return ok("Jellyfin libraries", "Cannot read virtual folders (no token)", False)
    import urllib.request

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8096/Library/VirtualFolders",
            headers={"X-Emby-Token": token, "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            folders = json.loads(resp.read().decode() or "[]")
    except Exception as e:
        return ok("Jellyfin libraries", f"Cannot read virtual folders ({type(e).__name__})", False)
    detail, good = doctor_jellyfin_library_detail(folders if isinstance(folders, list) else [])
    return ok("Jellyfin libraries", detail, good)


def tailscale_hop() -> dict:
    bin_path = shutil.which("tailscale")
    if not bin_path:
        return ok("Tailscale", "Not installed", False)
    try:
        raw = subprocess.check_output(
            [bin_path, "status", "--json"],
            text=True,
            timeout=8,
            stderr=subprocess.DEVNULL,
        )
        st = json.loads(raw or "{}")
    except Exception:
        return ok("Tailscale", "NeedsLogin", False)
    backend = str(st.get("BackendState") or "")
    ips = (st.get("Self") or {}).get("TailscaleIPs") or []
    ip100 = next((str(x) for x in ips if str(x).startswith("100.")), None)
    auth = str(st.get("AuthURL") or "").strip()
    if backend == "Running" and ip100:
        dns = str((st.get("Self") or {}).get("DNSName") or "").rstrip(".")
        return ok("Tailscale", ip100 + (f" {dns}" if dns else ""), True)
    if auth:
        return ok("Tailscale", f"NeedsLogin {auth}", False)
    return ok("Tailscale", backend or "NeedsLogin", False)


def listening(port: int) -> bool:
    s = socket.socket()
    s.settimeout(0.4)
    try:
        s.connect(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def main() -> int:
    answers = {}
    if (STATE / "answers.json").exists():
        try:
            answers = json.loads((STATE / "answers.json").read_text())
        except json.JSONDecodeError:
            answers = {}
    src = answers.get("source") or "real-debrid"
    intent = answers.get("intent") or {}
    frontend = answers.get("frontend") or "jellyfin"
    version = "unknown"
    inst = STATE / "installed-version"
    if inst.exists():
        version = inst.read_text().strip() or version
    elif (ROOT / "VERSION").exists():
        version = (ROOT / "VERSION").read_text().strip()

    checks = []
    docker = shutil.which("docker") is not None
    checks.append(ok("Docker", "Engine present" if docker else "Docker missing", docker))

    compose_ok = (COMPOSE / "docker-compose.yml").exists()
    checks.append(ok("Compose", "Project on disk" if compose_ok else "Compose missing", compose_ok))

    media = Path("/srv/media").is_dir()
    checks.append(ok("Media path", "/srv/media" if media else "Not mounted", media))

    if src != "local-vpn":
        cfg = COMPOSE / "configs" / "decypharr" / "config.json"
        good = False
        detail = "Decypharr config missing"
        if cfg.exists():
            try:
                d = json.loads(cfg.read_text())
                entry = (d.get("debrids") or [{}])[0]
                good = bool(entry.get("api_key") and entry.get("provider"))
                detail = f"Provider {entry.get('provider') or 'unset'}"
            except json.JSONDecodeError:
                detail = "Decypharr config unreadable"
        checks.append(ok("Source adapter", detail, good))
        checks.append(download_lock_hop())
    else:
        checks.append(ok("Source adapter", "Local + VPN (Gluetun)", listening(8085)))

    if intent.get("movies", True):
        checks.append(ok("Movies engine", "Radarr API key" if api_key(COMPOSE / "configs" / "radarr" / "config.xml") else "Radarr not ready", api_key(COMPOSE / "configs" / "radarr" / "config.xml")))
    if intent.get("tv") or intent.get("anime"):
        checks.append(ok("TV engine", "Sonarr API key" if api_key(COMPOSE / "configs" / "sonarr" / "config.xml") else "Sonarr not ready", api_key(COMPOSE / "configs" / "sonarr" / "config.xml")))
    if intent.get("music"):
        checks.append(ok("Music engine", "Lidarr API key" if api_key(COMPOSE / "configs" / "lidarr" / "config.xml") else "Lidarr not ready", api_key(COMPOSE / "configs" / "lidarr" / "config.xml")))

    checks.append(ok("Indexers", "Prowlarr API key" if api_key(COMPOSE / "configs" / "prowlarr" / "config.xml") else "Prowlarr not ready", api_key(COMPOSE / "configs" / "prowlarr" / "config.xml")))
    checks.append(releases_hop(answers))

    if frontend in ("jellyfin", "both"):
        checks.append(ok("Jellyfin", "Responding" if listening(8096) else "Not up", listening(8096)))
        checks.append(jellyfin_libraries_hop())
    if frontend in ("plex", "both"):
        checks.append(ok("Plex", "Responding" if listening(32400) else "Not up", listening(32400)))

    dri = Path("/dev/dri").exists()
    checks.append(
        ok(
            "Hardware transcode",
            "/dev/dri present" if dri else "No GPU node. Software encode.",
            dri,
        )
    )

    avahi = shutil.which("avahi-daemon") is not None or Path("/usr/sbin/avahi-daemon").exists()
    checks.append(ok("Discovery", "reelos.local" if avahi else "Avahi missing", avahi))

    access = answers.get("access") or "lan"
    if access == "tailscale" or shutil.which("tailscale"):
        checks.append(tailscale_hop())
    if access == "cloudflare":
        cf = Path("/etc/systemd/system/cloudflared.service").exists()
        checks.append(ok("Cloudflare Tunnel", "Unit present" if cf else "Token not applied", cf))

    checks.append(ok("ReelOS", f"Version {version}", True))

    checks.append(request_hop())
    if intent.get("tv") or intent.get("anime"):
        checks.append(sonarr_indexers_hop())

    checks.append(container_hop("decypharr", "Decypharr hop", 8282))
    fuse_detail = "Decypharr is up but /mnt/debrid is empty — TV cannot see grabs"
    fuse_ok = False
    try:
        kids = list(Path("/mnt/debrid").iterdir()) if Path("/mnt/debrid").exists() else []
        fuse_ok = Path("/mnt/debrid/__all__").exists() or Path("/mnt/debrid/version.txt").exists() or bool(kids)
        fuse_detail = "FUSE visible on the box" if fuse_ok else fuse_detail
    except OSError as e:
        fuse_ok = False
        fuse_detail = f"FUSE stale ({e}) — remount Decypharr and restart *arrs"
    checks.append(ok("Debrid files", fuse_detail, fuse_ok))

    prow = listening(9696) and api_key(COMPOSE / "configs" / "prowlarr" / "config.xml")
    checks.append(ok("Prowlarr hop", "Prowlarr accepts indexers" if prow else "indexers dead — Prowlarr", prow))

    checks.append(container_hop("reelos-jellyfin-1", "Jellyfin hop", 8096))
    if frontend in ("jellyfin", "both"):
        checks.append(container_hop("seerr", "Seerr hop", 5055))

    print(json.dumps({"version": version, "checks": checks}))
    return 0


def _self_test() -> int:
    import unittest

    class Doctor(unittest.TestCase):
        def test_releases_lists_every_indexer_not_first_live_test(self):
            src = Path(__file__).read_text()
            hop = src[src.find("def releases_hop") : src.find("def download_lock_hop")]
            self.assertIn("doctor_releases_detail", hop)
            self.assertIn("enabled_indexer_names", hop)
            self.assertNotIn("/indexer/" + "test", hop)
            self.assertIn('ok("releases", detail, good)', hop)

        def test_download_lock_probes_sonarr_decypharr_client(self):
            src = Path(__file__).read_text()
            hop = src[src.find("def _decypharr_client_ok") : src.find("def tailscale_hop")]
            self.assertIn("/downloadclient", hop)
            self.assertIn("decypharr", hop)
            self.assertIn("8282", hop)
            self.assertIn("SeasonSearch cannot grab", hop)
            self.assertIn("7878", hop)
            self.assertIn("MoviesSearch cannot grab", hop)
            self.assertIn("Could not probe Radarr/Sonarr download clients", hop)
            self.assertIn("enable", hop[: hop.find("def download_lock_hop")])

        def test_disabled_decypharr_client_is_not_a_lock(self):
            row = {
                "implementation": "QBittorrent",
                "enable": False,
                "fields": [
                    {"name": "host", "value": "decypharr"},
                    {"name": "port", "value": 8282},
                ],
            }
            self.assertFalse(_decypharr_client_ok([row]))
            row["enable"] = True
            self.assertTrue(_decypharr_client_ok([row]))
            self.assertFalse(_decypharr_client_ok([]))

        def test_request_hop_needs_client_and_indexer(self):
            dead, dead_ok = request_hop_detail(radarr_up=False, clients=[], indexers=[])
            self.assertFalse(dead_ok)
            self.assertIn("request dead", dead)
            no_client, nc_ok = request_hop_detail(radarr_up=True, clients=[], indexers=[{"enable": True, "name": "YTS"}])
            self.assertFalse(nc_ok)
            self.assertIn("Decypharr", no_client)
            client = {
                "implementation": "QBittorrent",
                "enable": True,
                "fields": [{"name": "host", "value": "decypharr"}, {"name": "port", "value": 8282}],
            }
            no_ix, nix_ok = request_hop_detail(radarr_up=True, clients=[client], indexers=[])
            self.assertFalse(nix_ok)
            self.assertIn("indexer", no_ix)
            muted, muted_ok = request_hop_detail(
                radarr_up=True,
                clients=[client],
                indexers=[
                    {
                        "enable": True,
                        "name": "ReelOS-yts",
                        "enableAutomaticSearch": False,
                        "enableInteractiveSearch": False,
                    }
                ],
            )
            self.assertFalse(muted_ok)
            self.assertIn("search indexer", muted)
            dead_lookup, dl_ok = request_hop_detail(
                radarr_up=True,
                clients=[client],
                indexers=[{"enable": True, "name": "ReelOS-yts"}],
                lookup=[],
            )
            self.assertFalse(dl_ok)
            self.assertIn("lookup", dead_lookup)
            ok_detail, good = request_hop_detail(
                radarr_up=True,
                clients=[client],
                indexers=[{"enable": True, "name": "ReelOS-yts"}],
                lookup=[{"tmdbId": 268, "title": "Batman"}],
            )
            self.assertTrue(good)
            self.assertIn("search path", ok_detail)

        def test_jellyfin_libraries_hop_is_not_tcp_only(self):
            detail, good = doctor_jellyfin_library_detail(
                [
                    {"Name": "Movies", "Locations": ["/symlinks", "/symlinks/radarr"]},
                    {"Name": "Shows", "Locations": ["/symlinks/sonarr"]},
                    {"Name": "TV", "Locations": ["/mnt/symlinks/sonarr"]},
                ]
            )
            self.assertFalse(good)
            self.assertIn("extra dump root", detail)
            self.assertIn("extra TV", detail)
            ok_detail, ok = doctor_jellyfin_library_detail(
                [
                    {"Name": "Movies", "Locations": ["/symlinks/radarr", "/media/movies"]},
                    {"Name": "Shows", "Locations": ["/symlinks/sonarr"]},
                ]
            )
            self.assertTrue(ok)
            self.assertIn("Movies:/symlinks/radarr", ok_detail)
            missing, miss_ok = doctor_jellyfin_library_detail([{"Name": "Movies", "Locations": ["/media/movies"]}])
            self.assertFalse(miss_ok)
            self.assertIn("Shows missing", missing)
            tcp_only = Path(__file__).read_text()
            hop = tcp_only[tcp_only.find("def jellyfin_api_token") : tcp_only.find("def tailscale_hop")]
            self.assertIn("VirtualFolders", hop)
            self.assertIn("jellyfin.token", hop)
            self.assertIn("no token", hop)
            self.assertIn("doctor_jellyfin_library_detail", hop)
            self.assertIn("X-Emby-Token", hop)
            self.assertIn("jellyfin_api_token", hop)

        def test_tpb_only_house_is_a_failed_releases_hop(self):
            mod = _load_public_indexers()
            self.assertIsNotNone(mod)
            detail, good = mod.doctor_releases_detail(["ReelOS-tpb"])
            self.assertFalse(good)
            self.assertIn("ReelOS-tpb", detail)
            self.assertIn("ReelOS-eztv", detail)
            self.assertIn("ReelOS-showrss", detail)

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Doctor)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit(main())
