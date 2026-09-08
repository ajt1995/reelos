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


def releases_hop(answers: dict) -> dict:
    src = answers.get("source") or ""
    want = f"ReelOS-{src}"
    key = xml_key_text(COMPOSE / "configs" / "prowlarr" / "config.xml")
    if not key:
        return ok("releases", last_releases_error() or "Prowlarr has no API key", False)
    try:
        import urllib.error
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
    enabled = [ix for ix in rows if ix.get("enable")]
    if not enabled:
        return ok("releases", last_releases_error() or "No indexer enabled", False)
    last = last_releases_error()
    for hit in enabled:
        try:
            import urllib.error
            import urllib.request

            req = urllib.request.Request(
                "http://127.0.0.1:9696/api/v1/indexer/test",
                data=json.dumps(hit).encode(),
                method="POST",
                headers={"X-Api-Key": key, "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                resp.read()
            return ok("releases", str(hit.get("name") or "indexer"), True)
        except urllib.error.HTTPError as e:
            last = e.read().decode()[:240] if e.fp else str(e)
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    return ok("releases", last or "Indexer test failed", False)


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
        checks.append(ok("Download lock", "Decypharr is the only client path", True))
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

    radarr_up = listening(7878) and api_key(COMPOSE / "configs" / "radarr" / "config.xml")
    checks.append(ok("Request hop", "Radarr accepts adds" if radarr_up else "request dead — Radarr", radarr_up))

    checks.append(container_hop("decypharr", "Decypharr hop", 8282))

    prow = listening(9696) and api_key(COMPOSE / "configs" / "prowlarr" / "config.xml")
    checks.append(ok("Prowlarr hop", "Prowlarr accepts indexers" if prow else "indexers dead — Prowlarr", prow))

    checks.append(container_hop("reelos-jellyfin-1", "Jellyfin hop", 8096))

    print(json.dumps({"version": version, "checks": checks}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
