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


def api_key(xml: Path) -> bool:
    if not xml.exists():
        return False
    try:
        node = ET.parse(xml).getroot().find("ApiKey")
    except ET.ParseError:
        return False
    return bool(node is not None and node.text)


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
    if (ROOT / "VERSION").exists():
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

    checks.append(ok("Indexers", "Prowlarr ready (empty until you add one)", api_key(COMPOSE / "configs" / "prowlarr" / "config.xml")))

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
    if access == "tailscale":
        ts = shutil.which("tailscale") is not None
        checks.append(ok("Tailscale", "tailscale binary" if ts else "Not installed", ts))
    if access == "cloudflare":
        cf = Path("/etc/systemd/system/cloudflared.service").exists()
        checks.append(ok("Cloudflare Tunnel", "Unit present" if cf else "Token not applied", cf))

    checks.append(ok("ReelOS", f"Version {version}", True))

    # Hops: lookup / request / decypharr / jellyfin
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8080/api/lookup?q=x", timeout=4) as r:
            raw = r.read().decode()
        hop = '"titles"' in raw
        checks.append(ok("Lookup hop", "GET /api/lookup answered" if hop else "lookup dead", hop))
    except Exception as e:
        checks.append(ok("Lookup hop", f"lookup dead ({e.__class__.__name__})", False))

    radarr_up = listening(7878) and api_key(COMPOSE / "configs" / "radarr" / "config.xml")
    checks.append(ok("Request hop", "Radarr accepts adds" if radarr_up else "request dead — Radarr", radarr_up))

    decy = False
    detail = "decypharr dead"
    if listening(8282):
        decy = True
        detail = "Decypharr :8282"
    else:
        try:
            out = subprocess.check_output(
                ["docker", "ps", "--filter", "name=decypharr", "--format", "{{.Status}}"],
                text=True,
                timeout=4,
            )
            if "Up" in out:
                decy = True
                detail = "Decypharr up"
            elif out.strip():
                detail = "decypharr dead"
        except Exception:
            pass
    checks.append(ok("Decypharr hop", detail, decy))

    prow = listening(9696) and api_key(COMPOSE / "configs" / "prowlarr" / "config.xml")
    checks.append(ok("Prowlarr hop", "Prowlarr accepts indexers" if prow else "indexers dead — Prowlarr", prow))

    jf = listening(8096)
    checks.append(ok("Jellyfin hop", "Jellyfin :8096" if jf else "jellyfin dead", jf))

    print(json.dumps({"version": version, "checks": checks}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
