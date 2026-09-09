#!/usr/bin/env python3
"""ReelOS: engines may only send work to Decypharr.

Deletes every Radarr/Sonarr download client that is not the debrid adapter.
Does not run a torrent client. Does not talk to the swarm.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
COMPOSE = ROOT / "compose"
STATE = Path("/var/lib/reelos")
ALLOWED_HOST = "decypharr"
ALLOWED_PORT = 8282
ALLOWED_IMPL = "QBittorrent"

APPS = [
    {
        "name": "radarr",
        "xml": COMPOSE / "configs" / "radarr" / "config.xml",
        "base": "http://127.0.0.1:7878/api/v3",
        "category_field": "movieCategory",
        "category": "radarr",
    },
    {
        "name": "sonarr",
        "xml": COMPOSE / "configs" / "sonarr" / "config.xml",
        "base": "http://127.0.0.1:8989/api/v3",
        "category_field": "tvCategory",
        "category": "sonarr",
    },
    {
        "name": "lidarr",
        "xml": COMPOSE / "configs" / "lidarr" / "config.xml",
        "base": "http://127.0.0.1:8686/api/v1",
        "category_field": "musicCategory",
        "category": "lidarr",
    },
]


def source() -> str:
    env = COMPOSE / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SOURCE="):
                return line.split("=", 1)[1].strip()
    answers = STATE / "answers.json"
    if answers.exists():
        try:
            return json.loads(answers.read_text()).get("source") or "real-debrid"
        except json.JSONDecodeError:
            pass
    return "real-debrid"


def api_key(xml_path: Path) -> str | None:
    if not xml_path.exists():
        return None
    try:
        root = ET.parse(xml_path).getroot()
    except ET.ParseError:
        return None
    node = root.find("ApiKey")
    if node is None or not node.text:
        return None
    return node.text.strip()


def call(url: str, key: str, method: str = "GET", body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-Api-Key": key,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        raw = resp.read()
        if not raw:
            return None
        return json.loads(raw.decode())


def field(fields: list, name: str):
    for f in fields:
        if f.get("name") == name:
            return f.get("value")
    return None


def client_needs_update(client: dict, app: dict) -> bool:
    """Keep Decypharr dumps until *arr hasFile. True wipe of sonarr/ dumps after complete."""
    if client.get("removeCompletedDownloads") is True:
        return True
    fields = client.get("fields") or []
    return field(fields, app["category_field"]) != app["category"]


def upsert_field(fields: list, name: str, value) -> list:
    out = [dict(f) for f in (fields or []) if isinstance(f, dict)]
    for f in out:
        if f.get("name") == name:
            f["value"] = value
            return out
    out.append({"name": name, "value": value})
    return out


def is_allowed(client: dict) -> bool:
    if client.get("implementation") != ALLOWED_IMPL:
        return False
    fields = client.get("fields") or []
    host = str(field(fields, "host") or "")
    port = field(fields, "port")
    try:
        port_n = int(port)
    except (TypeError, ValueError):
        port_n = -1
    return host == ALLOWED_HOST and port_n == ALLOWED_PORT


def payload(app: dict) -> dict:
    return {
        "enable": True,
        "protocol": "torrent",
        "priority": 1,
        "removeCompletedDownloads": False,
        "removeFailedDownloads": True,
        "name": "ReelOS-Decypharr",
        "implementation": ALLOWED_IMPL,
        "implementationName": "qBittorrent",
        "configContract": "QBittorrentSettings",
        "fields": [
            {"name": "host", "value": ALLOWED_HOST},
            {"name": "port", "value": ALLOWED_PORT},
            {"name": "useSsl", "value": False},
            {"name": "urlBase", "value": ""},
            {"name": "username", "value": ""},
            {"name": "password", "value": ""},
            {"name": app["category_field"], "value": app["category"]},
        ],
    }


def lock_app(app: dict) -> None:
    key = api_key(app["xml"])
    if not key:
        return
    try:
        clients = call(f"{app['base']}/downloadclient", key) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return
    if not isinstance(clients, list):
        return
    kept = False
    for client in clients:
        cid = client.get("id")
        if is_allowed(client):
            kept = True
            if cid is not None and client_needs_update(client, app):
                body = dict(client)
                body["removeCompletedDownloads"] = False
                body["fields"] = upsert_field(body.get("fields") or [], app["category_field"], app["category"])
                try:
                    call(f"{app['base']}/downloadclient/{cid}", key, method="PUT", body=body)
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                    pass
            continue
        if cid is None:
            continue
        try:
            call(f"{app['base']}/downloadclient/{cid}", key, method="DELETE")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass
    if not kept:
        try:
            call(f"{app['base']}/downloadclient", key, method="POST", body=payload(app))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            pass


def main() -> int:
    if source() == "local-vpn":
        return 0
    deadline = time.time() + 90
    while time.time() < deadline:
        for app in APPS:
            lock_app(app)
        if all(api_key(app["xml"]) for app in APPS):
            break
        time.sleep(3)
    for app in APPS:
        lock_app(app)
    sweep = Path(__file__).resolve().with_name("stuck-downloads.py")
    if sweep.is_file():
        try:
            subprocess.run([sys.executable, str(sweep)], check=False, timeout=90)
        except Exception:
            pass
    return 0


def _self_test() -> int:
    import unittest

    class Lock(unittest.TestCase):
        def test_new_client_keeps_completed_dumps(self):
            body = payload(APPS[1])
            self.assertFalse(body["removeCompletedDownloads"])
            self.assertEqual(field(body["fields"], "tvCategory"), "sonarr")

        def test_existing_client_needs_update_when_it_wipes_dumps(self):
            sonarr = APPS[1]
            stale = {
                "removeCompletedDownloads": True,
                "fields": [{"name": "tvCategory", "value": "tv-sonarr"}],
            }
            self.assertTrue(client_needs_update(stale, sonarr))
            good = {
                "removeCompletedDownloads": False,
                "fields": [{"name": "tvCategory", "value": "sonarr"}],
            }
            self.assertFalse(client_needs_update(good, sonarr))

        def test_upsert_category_field(self):
            fields = upsert_field([{"name": "host", "value": "decypharr"}], "tvCategory", "sonarr")
            self.assertEqual(field(fields, "tvCategory"), "sonarr")
            self.assertEqual(field(fields, "host"), "decypharr")

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Lock)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit(main())
