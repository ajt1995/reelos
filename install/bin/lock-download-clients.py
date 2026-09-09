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

# 1.2.50.6 oneshot had no TimeoutStartSec (systemd default 90s) and waited 90s
# for every app including Lidarr, then sweep timeout=90. House movies+TV has no
# Lidarr key → wait never breaks → unit FAILED before stuck-downloads SeasonSearch.
WAIT_SEC = 12
SWEEP_SEC = 45
ONESHOT_DEFAULT_SEC = 90

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


def client_enabled(client: dict) -> bool:
    """A disabled Decypharr row is not a lock. MoviesSearch/SeasonSearch will not grab."""
    return client.get("enable") is not False


def client_needs_update(client: dict, app: dict) -> bool:
    """Keep Decypharr dumps until *arr hasFile. True wipe of sonarr/ dumps after complete."""
    if not client_enabled(client):
        return True
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


def wanted_apps(quick: bool = False, xml_exists=None) -> list:
    """Do not wait on Lidarr when the house never enabled music."""
    exists = xml_exists or (lambda p: Path(p).exists())
    names = ("sonarr", "radarr") if quick else None
    out = []
    for app in APPS:
        if names and app["name"] not in names:
            continue
        if exists(app["xml"]):
            out.append(app)
    if out:
        return out
    return [a for a in APPS if a["name"] in ("sonarr", "radarr")]


def keys_ready(apps) -> bool:
    present = [a for a in apps if Path(a["xml"]).exists()]
    if not present:
        return False
    return all(api_key(a["xml"]) for a in present)


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
                body["enable"] = True
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
    quick = "--quick" in sys.argv
    apps = wanted_apps(quick)
    deadline = time.time() + (8 if quick else WAIT_SEC)
    while time.time() < deadline:
        for app in apps:
            lock_app(app)
        if keys_ready(apps):
            break
        time.sleep(1 if quick else 2)
    for app in apps:
        lock_app(app)
    if quick:
        return 0
    sweep = Path(__file__).resolve().with_name("stuck-downloads.py")
    if sweep.is_file():
        try:
            subprocess.run([sys.executable, str(sweep)], check=False, timeout=SWEEP_SEC)
        except Exception:
            pass
    return 0


def _sandbox_lock_sonarr_missing_client():
    """HTTP mock: Sonarr has no Decypharr client → lock POSTs ReelOS-Decypharr."""
    import json
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from tempfile import TemporaryDirectory
    from threading import Thread

    store = {"clients": [], "posts": []}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_a):
            return

        def _json(self, code, obj):
            raw = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path.split("?")[0].endswith("/downloadclient"):
                self._json(200, store["clients"])
                return
            self._json(404, {})

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            store["posts"].append(body)
            row = dict(body)
            row["id"] = 7
            store["clients"].append(row)
            self._json(201, row)

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        port = httpd.server_address[1]
        with TemporaryDirectory() as td:
            xml = Path(td) / "config.xml"
            xml.write_text("<Config><ApiKey>testkey</ApiKey></Config>\n")
            app = dict(APPS[1])
            app["xml"] = xml
            app["base"] = f"http://127.0.0.1:{port}/api/v3"
            lock_app(app)
            return store["posts"], [p.get("name") for p in store["posts"]]
    finally:
        httpd.shutdown()
        httpd.server_close()


def _sandbox_lock_disabled_client():
    """HTTP mock: Decypharr exists but enable=False → lock PUTs enable True."""
    import json
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from tempfile import TemporaryDirectory
    from threading import Thread

    store = {
        "clients": [
            {
                "id": 3,
                "name": "ReelOS-Decypharr",
                "enable": False,
                "implementation": "QBittorrent",
                "removeCompletedDownloads": False,
                "fields": [
                    {"name": "host", "value": "decypharr"},
                    {"name": "port", "value": 8282},
                    {"name": "tvCategory", "value": "sonarr"},
                ],
            }
        ],
        "puts": [],
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_a):
            return

        def _json(self, code, obj):
            raw = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path.split("?")[0].endswith("/downloadclient"):
                self._json(200, store["clients"])
                return
            self._json(404, {})

        def do_PUT(self):
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            store["puts"].append(body)
            self._json(200, body)

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        port = httpd.server_address[1]
        with TemporaryDirectory() as td:
            xml = Path(td) / "config.xml"
            xml.write_text("<Config><ApiKey>testkey</ApiKey></Config>\n")
            app = dict(APPS[1])
            app["xml"] = xml
            app["base"] = f"http://127.0.0.1:{port}/api/v3"
            lock_app(app)
            return store["puts"], [p.get("name") for p in store["puts"]]
    finally:
        httpd.shutdown()
        httpd.server_close()


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
                "enable": True,
                "removeCompletedDownloads": False,
                "fields": [{"name": "tvCategory", "value": "sonarr"}],
            }
            self.assertFalse(client_needs_update(good, sonarr))
            disabled = {
                "enable": False,
                "removeCompletedDownloads": False,
                "fields": [{"name": "tvCategory", "value": "sonarr"}],
            }
            self.assertTrue(client_needs_update(disabled, sonarr))
            self.assertFalse(client_enabled(disabled))

        def test_sandbox_reenables_disabled_decypharr_client(self):
            puts, names = _sandbox_lock_disabled_client()
            self.assertEqual(names, ["ReelOS-Decypharr"])
            self.assertTrue(puts[0]["enable"])

        def test_upsert_category_field(self):
            fields = upsert_field([{"name": "host", "value": "decypharr"}], "tvCategory", "sonarr")
            self.assertEqual(field(fields, "tvCategory"), "sonarr")
            self.assertEqual(field(fields, "host"), "decypharr")

        def test_quick_lock_skips_stuck_sweep(self):
            src = Path(__file__).read_text()
            self.assertIn('quick = "--quick" in sys.argv', src)
            self.assertIn("if quick:", src)

        def test_house_without_lidarr_does_not_block_the_unit(self):
            apps = wanted_apps(False, xml_exists=lambda p: "lidarr" not in str(p))
            self.assertEqual([a["name"] for a in apps], ["radarr", "sonarr"])
            self.assertLess(WAIT_SEC + SWEEP_SEC, ONESHOT_DEFAULT_SEC)

        def test_v12506_wait_all_apps_exceeded_oneshot_default(self):
            """1.2.50.6: wait 90s for lidarr + sweep 90s vs default TimeoutStartSec=90."""
            old_wait, old_sweep = 90, 90
            self.assertGreater(old_wait + old_sweep, ONESHOT_DEFAULT_SEC)
            self.assertGreater(old_wait, ONESHOT_DEFAULT_SEC - 1)

        def test_sandbox_sonarr_posts_decypharr_when_missing(self):
            posted, names = _sandbox_lock_sonarr_missing_client()
            self.assertIn("ReelOS-Decypharr", names)
            self.assertEqual(posted[0]["implementation"], "QBittorrent")
            self.assertEqual(field(posted[0]["fields"], "host"), "decypharr")
            self.assertEqual(int(field(posted[0]["fields"], "port")), 8282)

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Lock)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(_self_test())
    raise SystemExit(main())
