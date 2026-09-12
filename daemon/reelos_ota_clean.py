#!/usr/bin/env python3
"""Bounded OTA cleaner. Leftover nonsense from previous builds — not a factory reset.

Never /media. Never ota.lock. Never answers.json. Never firstboot. Never docker
restart Sonarr. Second run is a no-op.
"""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

ALWAYS_KEEP = frozenset({
    "jellyfin", "seerr", "jellyseerr", "plex", "prowlarr", "radarr", "sonarr",
    "lidarr", "bazarr", "decypharr", "gluetun", "qbittorrent", "caddy",
})
RETIRED = frozenset({
    "overseerr", "tautulli", "jackett", "emby", "kavita", "readarr", "whisparr",
    "tdarr", "unpackerr", "ombi", "petio", "organizr", "nzbget", "sabnzbd",
    "hydra", "nzbhydra2", "komga", "calibre-web", "requestrr", "audiobookshelf",
    "flaresolverr",
})
TCP_LISTEN = "0A"


def path_is_forbidden(path: str | os.PathLike[str]) -> bool:
    s = os.path.abspath(os.fsdecode(path))
    base = os.path.basename(s)
    if s == "/media" or s.startswith("/media/"):
        return True
    if base == "ota.lock" or s.endswith("/ota.lock"):
        return True
    if base == "answers.json":
        return True
    if "firstboot" in s.split(os.sep) and s.endswith(".service"):
        return True
    return False


def compose_keep_names(text: str) -> set[str]:
    keep = set(ALWAYS_KEEP)
    for m in re.finditer(r"^  ([a-z0-9][a-z0-9_-]*):", text, re.M):
        keep.add(m.group(1).lower())
    for m in re.finditer(r"container_name:\s*['\"]?([a-zA-Z0-9_-]+)", text):
        keep.add(m.group(1).lower())
    return keep


def _name_hits(name: str, token: str) -> bool:
    n, t = name.lower(), token.lower()
    return n == t or n.startswith(t + "-") or n.endswith("-" + t) or f"-{t}-" in n


def is_retired_name(name: str, keep: set[str]) -> bool:
    n = str(name or "").strip().lower()
    if not n:
        return False
    if any(_name_hits(n, k) for k in ALWAYS_KEEP) or any(_name_hits(n, k) for k in keep):
        return False
    for r in RETIRED:
        if r in keep:
            continue
        if _name_hits(n, r):
            return True
    return False


def tmp_leftover_paths(*, tmp: str = "/tmp", root: str = "/opt/reelos", keep_work_src: bool = False) -> list[str]:
    tmp, root = os.path.abspath(tmp), os.path.abspath(root)
    paths = [
        os.path.join(tmp, "reelos-ota", "src.tar.gz"),
        os.path.join(tmp, "reelos-ota-80.html"),
        root + ".next",
        os.path.join(root, "app.broken"),
    ]
    return [p for p in paths if not path_is_forbidden(p)]


def existing_tmp_leftovers(*, tmp: str = "/tmp", root: str = "/opt/reelos", keep_work_src: bool = False) -> list[str]:
    return [p for p in tmp_leftover_paths(tmp=tmp, root=root, keep_work_src=keep_work_src) if os.path.lexists(p) and not path_is_forbidden(p)]


def _read_text(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def listener_inodes(port: int, dumps: list[str] | None = None) -> set[str]:
    wanted = f":{port:04X}"
    inodes: set[str] = set()
    texts = dumps if dumps is not None else [_read_text("/proc/net/tcp"), _read_text("/proc/net/tcp6")]
    for text in texts:
        for line in str(text or "").splitlines():
            cols = line.split()
            if len(cols) < 10 or cols[3] != TCP_LISTEN:
                continue
            if not cols[1].upper().endswith(wanted):
                continue
            if cols[9].isdigit():
                inodes.add(cols[9])
    return inodes


def pids_for_inodes(inodes: set[str], *, self_pid: int | None = None) -> list[int]:
    if not inodes:
        return []
    me = os.getpid() if self_pid is None else self_pid
    targets = {f"socket:[{i}]" for i in inodes}
    pids: list[int] = []
    try:
        entries = list(Path("/proc").iterdir())
    except OSError:
        return []
    for entry in entries:
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        if pid <= 1 or pid == me:
            continue
        try:
            fds = list((entry / "fd").iterdir())
        except OSError:
            continue
        for fd in fds:
            try:
                if os.readlink(fd) in targets:
                    pids.append(pid)
                    break
            except OSError:
                continue
    return pids


def systemd_main_pid(unit: str = "reelos.service") -> int | None:
    try:
        out = subprocess.run(["systemctl", "show", "-p", "MainPID", "--value", unit], check=False, capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return None
    try:
        n = int((out.stdout or "").strip() or "0")
    except ValueError:
        return None
    return n if n > 1 else None


def kill_orphan_port_pids(pids: list[int], *, self_pid: int | None = None, keep: set[int] | None = None) -> list[int]:
    me = os.getpid() if self_pid is None else self_pid
    hold = set(keep or ()) | {1, me}
    seen, killed = set(), []
    for raw in pids:
        try:
            pid = int(raw)
        except (TypeError, ValueError):
            continue
        if pid <= 1 or pid in hold or pid in seen:
            continue
        seen.add(pid)
        try:
            os.kill(pid, signal.SIGTERM)
            killed.append(pid)
        except OSError:
            continue
    return killed


def _docker(fmt_cmd: list[str]) -> list[str]:
    try:
        out = subprocess.run(fmt_cmd, check=False, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [ln.strip() for ln in (out.stdout or "").splitlines() if ln.strip()]


def docker_names() -> list[str]:
    return _docker(["docker", "ps", "-a", "--format", "{{.Names}}"])


def docker_images() -> list[str]:
    return _docker(["docker", "images", "--format", "{{.Repository}}:{{.Tag}}"])


def load_compose_text(root: str) -> str:
    for rel in ("compose/docker-compose.yml", "install/compose/docker-compose.yml"):
        p = Path(root) / rel
        if p.is_file():
            return p.read_text(encoding="utf-8", errors="replace")
    p = Path(os.environ.get("REELOS_ROOT") or root) / "compose" / "docker-compose.yml"
    return p.read_text(encoding="utf-8", errors="replace") if p.is_file() else ""


def plan_retired(compose_text: str, names: list[str]) -> list[str]:
    keep = compose_keep_names(compose_text)
    return [n for n in names if is_retired_name(n, keep)]


def plan_retired_images(compose_text: str, images: list[str]) -> list[str]:
    keep = compose_keep_names(compose_text)
    out = []
    for img in images:
        repo = img.split(":", 1)[0].rsplit("/", 1)[-1].lower()
        if is_retired_name(repo, keep):
            out.append(img)
    return out


def _rm_tree(path: str) -> bool:
    if path_is_forbidden(path):
        return False
    p = Path(path)
    if not p.exists() and not p.is_symlink():
        return False
    if p.is_dir() and not p.is_symlink():
        for child in sorted(p.rglob("*"), reverse=True):
            if path_is_forbidden(str(child)):
                continue
            try:
                child.rmdir() if child.is_dir() and not child.is_symlink() else child.unlink()
            except OSError:
                continue
        try:
            p.rmdir()
        except OSError:
            return False
        return True
    try:
        p.unlink()
        return True
    except OSError:
        return False


def apply_tmp(*, tmp: str, root: str, keep_work_src: bool) -> list[str]:
    removed = []
    for p in existing_tmp_leftovers(tmp=tmp, root=root, keep_work_src=keep_work_src):
        if _rm_tree(p):
            removed.append(p)
    return removed


def apply_retired(names: list[str], images: list[str]) -> dict:
    removed_c, removed_i = [], []
    if names:
        try:
            subprocess.run(["docker", "rm", "-f", *names], check=False, capture_output=True, timeout=60)
            removed_c = list(names)
        except (OSError, subprocess.TimeoutExpired):
            pass
    for img in images:
        try:
            r = subprocess.run(["docker", "rmi", img], check=False, capture_output=True, timeout=60)
            if r.returncode == 0:
                removed_i.append(img)
        except (OSError, subprocess.TimeoutExpired):
            continue
    return {"containers": removed_c, "images": removed_i}


def plan(*, root: str, tmp: str, keep_work_src: bool, door: bool) -> dict:
    compose = load_compose_text(root)
    names = docker_names() if compose else []
    images = docker_images() if compose else []
    return {
        "retired_containers": plan_retired(compose, names) if compose else [],
        "retired_images": plan_retired_images(compose, images) if compose else [],
        "tmp_leftovers": existing_tmp_leftovers(tmp=tmp, root=root, keep_work_src=keep_work_src),
        "orphan_8080": pids_for_inodes(listener_inodes(8080)) if door else [],
        "keep_pid": systemd_main_pid() if door else None,
        "forbidden": ["/media", "ota.lock", "answers.json", "firstboot"],
    }


def apply(*, root: str, tmp: str, keep_work_src: bool, door: bool, tmp_only: bool) -> dict:
    out: dict = {"ok": True, "removed": [], "killed": []}
    if door:
        keep = set()
        main = systemd_main_pid()
        if main:
            keep.add(main)
        out["killed"] = kill_orphan_port_pids(pids_for_inodes(listener_inodes(8080)), keep=keep)
        if tmp_only is False and keep_work_src is False:
            return out
    if tmp_only:
        out["removed"] = apply_tmp(tmp=tmp, root=root, keep_work_src=False)
        return out
    compose = load_compose_text(root)
    out["retired"] = apply_retired(plan_retired(compose, docker_names()), plan_retired_images(compose, docker_images()))
    out["removed"] = apply_tmp(tmp=tmp, root=root, keep_work_src=keep_work_src)
    return out


def _self_test() -> int:
    assert path_is_forbidden("/media")
    assert path_is_forbidden("/media/movies")
    assert path_is_forbidden("/var/lib/reelos/ota.lock")
    assert path_is_forbidden("/var/lib/reelos/answers.json")
    assert not path_is_forbidden("/tmp/reelos-ota/src.tar.gz")
    keep = compose_keep_names("services:\n  jellyfin:\n    image: x\n  seerr:\n    container_name: seerr\n")
    assert is_retired_name("overseerr", keep) and is_retired_name("jackett", keep)
    assert not is_retired_name("jellyfin", keep) and not is_retired_name("seerr", keep)
    assert not is_retired_name("overseerr", compose_keep_names("services:\n  overseerr:\n    image: x\n"))
    left = tmp_leftover_paths(tmp="/tmp", root="/opt/reelos", keep_work_src=True)
    assert any(x.endswith("src.tar.gz") for x in left) and not any("/media" in x for x in left)
    assert kill_orphan_port_pids([1, os.getpid()], self_pid=os.getpid()) == []
    assert plan(root="/tmp/no-such-reelos", tmp="/tmp", keep_work_src=True, door=False)["retired_containers"] == []
    print("reelos_ota_clean self-test ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if "--self-test" in args:
        return _self_test()
    root = os.environ.get("REELOS_ROOT") or "/opt/reelos"
    tmp = os.environ.get("REELOS_OTA_TMP") or "/tmp"
    keep_work_src, door, tmp_only = "--keep-work-src" in args, "--door" in args, "--tmp" in args
    if "--plan" in args:
        print(json.dumps(plan(root=root, tmp=tmp, keep_work_src=keep_work_src, door=door), indent=2))
        return 0
    out = apply(root=root, tmp=tmp, keep_work_src=keep_work_src, door=door, tmp_only=tmp_only)
    print(json.dumps(out, default=str))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
