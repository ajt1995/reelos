"""Common paths, constants, network helpers, and logging for ReelOS wiring."""
from __future__ import annotations

import http.cookiejar
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
    "debrid-link": "debridlink",
}

QUALITY = {"1080p": "HD-1080p", "hybrid": "Ultra-HD", "4k": "Ultra-HD", "custom": "Ultra-HD"}

NET_ERR = (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, socket.timeout, ConnectionError, OSError)


def log_wire(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        with open(STATE / "wire.log", "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def answers() -> dict:
    p = STATE / "answers.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError:
        return {}


def source() -> str:
    a = answers()
    return a.get("source") or a.get("debrid_provider") or "torbox"


def api_key(xml_path: Path) -> str | None:
    if not xml_path.exists():
        return None
    try:
        tree = ET.parse(xml_path)
        elem = tree.find("ApiKey")
        if elem is not None and elem.text and elem.text.strip():
            return elem.text.strip()
    except ET.ParseError:
        pass
    return None


def call(url: str, key: str | None = None, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    h = dict(headers or {})
    if key:
        h["X-Api-Key"] = key
    if body is not None:
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read().decode()
        if not content.strip():
            return None
        return json.loads(content)


def wait_key(xml: Path, seconds: int = 90) -> str | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        k = api_key(xml)
        if k:
            return k
        time.sleep(1)
    return None


def wait_http(url: str, seconds: int = 40) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status < 500:
                    return True
        except NET_ERR:
            pass
        time.sleep(1)
    return False


def compose_env() -> dict:
    env = os.environ.copy()
    env["COMPOSE_PROJECT_NAME"] = "reelos"
    env.setdefault("PUID", str(os.getuid() if hasattr(os, "getuid") else 1000))
    env.setdefault("PGID", str(os.getgid() if hasattr(os, "getgid") else 1000))
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
