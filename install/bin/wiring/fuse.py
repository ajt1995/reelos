"""FUSE mount management, unstacking, and filesystem binding for ReelOS."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

from .common import (
    COMPOSE,
    DECYPHARR,
    PROVIDER,
    STATE,
    answers,
    compose,
    compose_env,
    log_wire,
    source,
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
    cfg.setdefault("default_download_action", "symlink")
    cfg.setdefault("use_auth", False)
    cfg.setdefault("log_level", "info")
    cfg.setdefault("port", "8282")
    DECYPHARR.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(cfg, indent=2) + "\n"
    prev = DECYPHARR.read_text() if DECYPHARR.exists() else ""
    if text == prev:
        if fuse_on_host():
            n = fuse_host_mount_count()
            log_wire(f"decypharr config unchanged — fuse live ({n}), not restarting")
            return
        log_wire("decypharr config unchanged — fuse stale, remount")
        fuse_unstack_stale()
        subprocess.run(["docker", "restart", "decypharr"], check=False, capture_output=True)
        time.sleep(5)
        restart_fuse_readers()
        return
    DECYPHARR.write_text(text)
    if fuse_on_host():
        log_wire("decypharr config changed — fuse live, not recreating")
        return
    fuse_unstack_stale()
    compose("up", "-d", "--force-recreate", "decypharr")
    time.sleep(5)
    restart_fuse_readers()


def restart_fuse_readers() -> None:
    """Containers started before FUSE cannot see /mnt/debrid. Restart after mount."""
    if not fuse_on_host():
        log_wire("fuse not up — skip reader restart")
        return
    d_state = 0
    try:
        r = subprocess.run(["ps", "-eo", "state,comm"], capture_output=True, text=True, check=False)
        for line in (r.stdout or "").splitlines():
            parts = line.split()
            if len(parts) >= 2 and "D" in parts[0] and "ffprobe" in parts[1]:
                d_state += 1
    except OSError:
        d_state = 0
    if d_state > 0:
        log_wire(f"skip reader restart — ffprobe D-state {d_state}")
        return
    subprocess.run(["mount", "--make-rshared", "/mnt"], check=False, capture_output=True)
    for name in ("reelos-jellyfin-1", "reelos-radarr-1", "reelos-sonarr-1"):
        r = subprocess.run(["docker", "restart", name], capture_output=True, text=True, check=False)
        log_wire(f"restart {name} rc={r.returncode}")


def persist_fuse_listed() -> None:
    """Don't remount if listed. Stamp so Apply/heal keep that policy."""
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        (STATE / "fuse-listed").write_text("1\n")
        (STATE / "fuse-policy.json").write_text(
            json.dumps({"remountIfListed": False, "note": "do not remount if listed"}) + "\n"
        )
    except OSError:
        pass


def fuse_on_host() -> bool:
    """True only when listdir works. Path.exists() is true on ENOTCONN leftovers."""
    try:
        os.listdir("/mnt/debrid/__all__")
        return True
    except OSError:
        pass
    try:
        return "version.txt" in os.listdir("/mnt/debrid")
    except OSError:
        return False


def fuse_mount_count_from_mountinfo(text: str, mountpoint: str = "/mnt/debrid") -> int:
    """Count host fuse.decypharr layers on mountpoint. Never /media."""
    n = 0
    mp = mountpoint.rstrip("/") or "/"
    for line in text.splitlines():
        if " - " not in line:
            continue
        left, right = line.split(" - ", 1)
        fields = left.split()
        if len(fields) < 5:
            continue
        if fields[4].replace("\\040", " ") != mp:
            continue
        bits = right.split()
        fstype = bits[0] if bits else ""
        source = bits[1] if len(bits) > 1 else ""
        if "decypharr" in fstype or "decypharr" in source:
            n += 1
    return n


def fuse_mount_count_from_mount(text: str, mountpoint: str = "/mnt/debrid") -> int:
    n = 0
    needle = f" on {mountpoint} "
    tail = f" on {mountpoint}"
    for line in text.splitlines():
        if needle not in line and not line.rstrip().endswith(tail):
            continue
        if "fuse.decypharr" in line or ("decypharr" in line and "fuse" in line):
            n += 1
    return n


def fuse_host_mount_count() -> int:
    try:
        n = fuse_mount_count_from_mountinfo(Path("/proc/self/mountinfo").read_text())
        if n:
            return n
    except OSError:
        pass
    try:
        r = subprocess.run(["mount"], capture_output=True, text=True, check=False)
        return fuse_mount_count_from_mount(r.stdout or "")
    except OSError:
        return 0


def fuse_unique_devices_from_mountinfo(text: str, mountpoint: str = "/mnt/debrid") -> set[str]:
    """Same FUSE maj:min listed four times is one daemon, not four stacks."""
    devices: set[str] = set()
    mp = mountpoint.rstrip("/") or "/"
    for line in text.splitlines():
        if " - " not in line:
            continue
        left, right = line.split(" - ", 1)
        fields = left.split()
        if len(fields) < 5:
            continue
        if fields[4].replace("\\040", " ") != mp:
            continue
        bits = right.split()
        fstype = bits[0] if bits else ""
        source = bits[1] if len(bits) > 1 else ""
        if "decypharr" in fstype or "decypharr" in source:
            devices.add(fields[2])
    return devices


def fuse_mnt_self_bind_count(text: str) -> int:
    """Count ext4 /mnt-on-/mnt binds that duplicate one live FUSE into extra views."""
    n = 0
    for line in text.splitlines():
        if " - " not in line:
            continue
        left, right = line.split(" - ", 1)
        fields = left.split()
        if len(fields) < 5 or fields[4] != "/mnt":
            continue
        if fields[3] == "/mnt" and "ext4" in right:
            n += 1
    return n


def fuse_unstack_extra_mnt_binds() -> None:
    """Peel extra /mnt self-binds. Never /media. Never lazy-umount a live FUSE."""
    if not fuse_on_host():
        return
    try:
        text = Path("/proc/self/mountinfo").read_text()
    except OSError:
        return
    binds = fuse_mnt_self_bind_count(text)
    views = fuse_mount_count_from_mountinfo(text)
    devices = fuse_unique_devices_from_mountinfo(text)
    if views <= 1 or binds <= 0:
        if views > 1 and len(devices) <= 1:
            log_wire(f"fuse stacked {views} views / {len(devices)} device — same FUSE, not unmounting live")
        return
    log_wire(f"fuse stacked {views} — live, peel extra /mnt binds ({binds})")
    for _ in range(min(binds, 8)):
        if not fuse_on_host():
            log_wire("stop peel — fuse not live")
            return
        r = subprocess.run(["umount", "/mnt"], check=False, capture_output=True, text=True)
        if r.returncode:
            log_wire(f"umount /mnt busy — not lazy ({(r.stderr or '')[:80]})")
            return
        time.sleep(0.3)
        if not fuse_on_host():
            log_wire("peel dropped fuse — stop")
            return
        try:
            text = Path("/proc/self/mountinfo").read_text()
        except OSError:
            return
        if fuse_mnt_self_bind_count(text) == 0 or fuse_mount_count_from_mountinfo(text) <= 1:
            log_wire(f"fuse peeled to {fuse_mount_count_from_mountinfo(text)} view(s)")
            return


def fuse_unstack_stale() -> None:
    """Unmount extra/stale /mnt/debrid FUSE only. Never /media. Peel extra /mnt binds when live."""
    if fuse_on_host():
        n = fuse_host_mount_count()
        if n > 1:
            log_wire(f"fuse stacked {n} — live, peel extra /mnt binds")
            fuse_unstack_extra_mnt_binds()
        return
    n = fuse_host_mount_count()
    if n == 0:
        try:
            os.listdir("/mnt/debrid")
            return
        except FileNotFoundError:
            return
        except OSError:
            log_wire("stale /mnt/debrid FUSE — lazy unmount")
    else:
        log_wire(f"stale /mnt/debrid FUSE — unmount {n} layer(s)")
    for _ in range(12):
        subprocess.run(["fusermount", "-uz", "/mnt/debrid"], check=False, capture_output=True)
        subprocess.run(["umount", "-l", "/mnt/debrid"], check=False, capture_output=True)
        time.sleep(0.4)
        if fuse_on_host():
            return
        if fuse_host_mount_count() == 0:
            try:
                os.listdir("/mnt/debrid")
                return
            except FileNotFoundError:
                return
            except OSError:
                continue


def fuse_clear_stale() -> None:
    """Compose stop leaves /mnt/debrid mounted and ENOTCONN. mkdir then FileExistsError."""
    fuse_unstack_stale()


def persist_mnt_shared() -> None:
    unit = """[Unit]
Description=ReelOS /mnt rshared so Decypharr FUSE is visible
DefaultDependencies=no
After=local-fs.target
Before=docker.service

[Service]
Type=oneshot
ExecStart=/bin/mkdir -p /mnt /mnt/debrid /mnt/symlinks
ExecStart=/bin/bash -c 'findmnt -n /mnt >/dev/null || mount --bind /mnt /mnt; mount --make-rshared /mnt'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
"""
    path = Path("/etc/systemd/system/reelos-mnt-rshared.service")
    try:
        if path.exists() and path.read_text() == unit:
            return
        path.write_text(unit)
        subprocess.run(["systemctl", "daemon-reload"], check=False, capture_output=True)
        if fuse_on_host():
            subprocess.run(["systemctl", "enable", "reelos-mnt-rshared"], check=False, capture_output=True)
            log_wire("mnt-rshared unit enabled — fuse live, not bind-stacking")
            return
        subprocess.run(["systemctl", "enable", "--now", "reelos-mnt-rshared"], check=False, capture_output=True)
        log_wire("mnt-rshared unit enabled")
    except OSError as e:
        log_wire(f"mnt-shared unit {e}")


def wait_fuse_ready(seconds: int = 40) -> bool:
    """Do not scan *arr dumps until FUSE listdir works (import race)."""
    if source() == "local-vpn":
        return True
    deadline = time.time() + seconds
    while time.time() < deadline:
        if fuse_on_host():
            try:
                os.listdir("/mnt/debrid")
                return True
            except OSError:
                pass
        time.sleep(2)
    return False


def ensure_fuse() -> None:
    persist_mnt_shared()
    share_mnt()
    n = fuse_host_mount_count()
    if fuse_on_host():
        persist_fuse_listed()
        if n > 1:
            log_wire(f"fuse already on host — stacked {n}, do not remount if listed")
        else:
            log_wire("fuse already on host — do not remount if listed")
        subprocess.run(["systemctl", "start", "caddy", "reelos"], check=False, capture_output=True)
        log_wire("door caddy/reelos started after fuse")
        return
    log_wire("fuse missing on host — recreate decypharr")
    fuse_unstack_stale()
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
            subprocess.run(["systemctl", "start", "caddy", "reelos"], check=False, capture_output=True)
            log_wire("door caddy/reelos started after fuse")
            return
    log_wire("fuse still missing after recreate")


def share_mnt() -> None:
    fuse_clear_stale()
    Path("/mnt").mkdir(parents=True, exist_ok=True)
    Path("/mnt/symlinks").mkdir(parents=True, exist_ok=True)
    Path("/mnt/debrid").mkdir(parents=True, exist_ok=True)
    persist_mnt_shared()
    if fuse_on_host():
        log_wire("share_mnt: fuse on host — not bind-mounting /mnt")
        fuse_unstack_extra_mnt_binds()
        return
    r = subprocess.run(["mount", "--make-rshared", "/mnt"], check=False, capture_output=True, text=True)
    if r.returncode:
        log_wire(f"rshared /mnt skipped: {(r.stderr or r.stdout or '')[:160]}")
    else:
        log_wire("rshared /mnt")
    for p in ("/mnt/debrid", "/mnt/symlinks"):
        try:
            os.chmod(p, 0o777)
            if hasattr(os, "chown"):
                os.chown(p, 1000, 1000)
        except OSError as e:
            log_wire(f"chmod {p} {e}")
    log_wire("fuse mountpoint writable")
