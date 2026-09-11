#!/usr/bin/env python3
"""ReelOS hardware profile — use the machine, throttle when the machine is small or FUSE is wedged.

Measures CPU (nproc), RAM (MemTotal), disk (SSD vs rotational, free space).
4GB fixture keeps today's conservative path. 16–32GB must not stay on
MemoryMax 768M / 4G docker / Pi folder caps. FUSE ffprobe D-state is I/O
backpressure: concurrency 0 on any hardware.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SMALL_MEM_KB = 4_718_592  # 4.5 Gi — tiny fixture (Pi / 4GB laptop)
TINY_RAM_GB = 4.5

# House HP 15-bs0xx (2026-09-11): 3383440 kB, 4× Pentium N3710, WD5000LPCX HDD.
FIXTURE_TINY_4GB = {
    "ram_kb": 3_383_440,
    "cpus": 4,
    "disk_kind": "rotational",
    "disk_free_gb": 410.0,
}
FIXTURE_LAPTOP_16GB = {
    "ram_kb": 16 * 1024 * 1024,
    "cpus": 8,
    "disk_kind": "ssd",
    "disk_free_gb": 200.0,
}
FIXTURE_LAPTOP_32GB = {
    "ram_kb": 32 * 1024 * 1024,
    "cpus": 16,
    "disk_kind": "ssd",
    "disk_free_gb": 400.0,
}

STATE = Path(os.environ.get("REELOS_STATE", "/var/lib/reelos"))
ROOT = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
COMPOSE = ROOT / "compose"
CATCHUP_DROPIN = Path(
    os.environ.get(
        "REELOS_CATCHUP_DROPIN",
        "/etc/systemd/system/reelos-library-catchup.service.d/hardware.conf",
    )
)
PROFILE_PATH = STATE / "hardware-profile.json"


def ram_gb_from_kb(ram_kb: int) -> float:
    return round((ram_kb or 0) / 1024 / 1024, 2)


def mem_total_kb(text: str | None = None) -> int:
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/meminfo").read_text()
        except OSError:
            return 0
    for line in str(raw).splitlines():
        if line.startswith("MemTotal:"):
            try:
                return int(line.split()[1])
            except (ValueError, IndexError):
                return 0
    return 0


def nproc_count(text: str | None = None) -> int:
    if text is not None:
        try:
            n = int(str(text).strip().split()[0])
            return n if n > 0 else 1
        except (ValueError, IndexError):
            return 1
    try:
        r = subprocess.run(["nproc"], capture_output=True, text=True, check=False)
        n = int((r.stdout or "1").strip().split()[0])
        return n if n > 0 else 1
    except (OSError, ValueError, IndexError):
        n = os.cpu_count() or 1
        return n if n > 0 else 1


def _sys_rotational(name: str) -> int | None:
    p = Path("/sys/block") / name / "queue" / "rotational"
    try:
        return int(p.read_text().strip())
    except (OSError, ValueError):
        return None


def _block_name(src: str) -> str:
    """/dev/sda2 → sda; /dev/nvme0n1p2 → nvme0n1."""
    name = Path(src).name
    if name.startswith("nvme"):
        return name.rsplit("p", 1)[0] if "p" in name else name
    while name and name[-1].isdigit():
        name = name[:-1]
    return name


def disk_kind_from_sys(*, root: str = "/") -> str:
    """ssd | rotational | unknown. Ignore loop/rom. Root filesystem wins."""
    src = ""
    try:
        r = subprocess.run(
            ["findmnt", "-n", "-o", "SOURCE", root],
            capture_output=True,
            text=True,
            check=False,
        )
        src = (r.stdout or "").strip()
    except OSError:
        src = ""
    name = _block_name(src) if src else ""
    if name:
        rota = _sys_rotational(name)
        if rota == 0:
            return "ssd"
        if rota == 1:
            return "rotational"
    # Fallback: first real disk
    sysb = Path("/sys/block")
    try:
        for blk in sorted(sysb.iterdir()):
            n = blk.name
            if n.startswith(("loop", "sr", "ram", "zram", "dm-")):
                continue
            rota = _sys_rotational(n)
            if rota == 0:
                return "ssd"
            if rota == 1:
                return "rotational"
    except OSError:
        pass
    return "unknown"


def disk_free_gb(path: str = "/") -> float:
    try:
        u = shutil.disk_usage(path)
        return round(u.free / (1024**3), 1)
    except OSError:
        return 0.0


def has_vaapi_dri(dri: str | Path = "/dev/dri") -> bool:
    p = Path(dri)
    if not p.exists():
        return False
    try:
        return any(c.name.startswith(("renderD", "card")) for c in p.iterdir())
    except OSError:
        return True


def measure(*, meminfo: str | None = None, nproc_text: str | None = None, root: str = "/") -> dict:
    ram_kb = mem_total_kb(meminfo)
    cpus = nproc_count(nproc_text)
    kind = disk_kind_from_sys(root=root) if meminfo is None and nproc_text is None else "unknown"
    free = disk_free_gb(root) if meminfo is None and nproc_text is None else 0.0
    if meminfo is not None or nproc_text is not None:
        # Caller is injecting a fixture; don't probe live disk unless asked.
        kind = "unknown"
        free = 0.0
    return profile_from_facts(ram_kb=ram_kb, cpus=cpus, disk_kind=kind, disk_free_gb=free)


def profile_from_facts(
    *,
    ram_kb: int,
    cpus: int,
    disk_kind: str = "unknown",
    disk_free_gb: float = 0.0,
) -> dict:
    ram_gb = ram_gb_from_kb(int(ram_kb or 0))
    tiny = 0 < int(ram_kb or 0) <= SMALL_MEM_KB
    return {
        "ram_kb": int(ram_kb or 0),
        "ram_gb": ram_gb,
        "cpus": max(1, int(cpus or 1)),
        "disk_kind": disk_kind if disk_kind in {"ssd", "rotational", "unknown"} else "unknown",
        "disk_free_gb": float(disk_free_gb or 0),
        "tiny": tiny,
        "box_is_small": tiny,
    }


def limits_for(profile: dict) -> dict:
    """Runtime throttle. D-state is applied by callers (concurrency 0 when high)."""
    ram_gb = float(profile.get("ram_gb") or 0)
    ram_kb = int(profile.get("ram_kb") or 0)
    cpus = max(1, int(profile.get("cpus") or 1))
    kind = str(profile.get("disk_kind") or "unknown")
    free = float(profile.get("disk_free_gb") or 0)
    tiny = bool(profile.get("tiny")) or (0 < ram_kb <= SMALL_MEM_KB) or ram_gb <= TINY_RAM_GB

    if tiny:
        catchup_mem = "768M"
        jellyfin_mem = None
        sonarr_mem = None
        radarr_mem = None
        catchup_folders = 6
        provision_folders = 12
        catchup_chunk = 8
        provision_chunk = 20
        nice = 10
        ioprio = 7
    else:
        if ram_gb < 12:
            catchup_mem = "1G"
        elif ram_gb < 20:
            catchup_mem = "2G"
        elif ram_gb < 28:
            catchup_mem = "4G"
        else:
            catchup_mem = "8G"
        jellyfin_mem = f"{max(2, int(ram_gb * 0.35))}G"
        sonarr_mem = f"{max(1, int(ram_gb * 0.15))}G"
        radarr_mem = f"{max(1, int(ram_gb * 0.12))}G"
        if kind == "rotational":
            catchup_folders = min(48, max(16, cpus * 4))
            provision_folders = min(96, max(32, cpus * 6))
        else:
            catchup_folders = min(128, max(24, cpus * 8))
            provision_folders = min(256, max(48, cpus * 12))
        catchup_chunk = min(64, max(16, cpus * 4))
        provision_chunk = min(80, max(40, cpus * 6))
        nice = 0
        ioprio = 4

    if 0 < free < 5:
        catchup_folders = max(4, catchup_folders // 2)
        provision_folders = max(6, provision_folders // 2)

    return {
        "tiny": tiny,
        "catchup_memory_max": catchup_mem,
        "jellyfin_mem": jellyfin_mem,
        "sonarr_mem": sonarr_mem,
        "radarr_mem": radarr_mem,
        "import_folder_cap_catchup": catchup_folders,
        "import_folder_cap_provision": provision_folders,
        "import_chunk_catchup": catchup_chunk,
        "import_chunk_provision": provision_chunk,
        "d_backoff_limit": 1,  # any ffprobe D-state is I/O backpressure
        "nice": nice,
        "ioprio": ioprio,
    }


def import_folder_cap(profile: dict, *, catch_up: bool) -> int:
    lim = limits_for(profile)
    return int(lim["import_folder_cap_catchup"] if catch_up else lim["import_folder_cap_provision"])


def import_chunk_size(profile: dict, *, catch_up: bool, d_state: int = 0) -> int:
    """High D-state → 0 on any hardware. Healthy FUSE scales with cores."""
    if int(d_state or 0) > 0:
        return 0
    lim = limits_for(profile)
    return int(lim["import_chunk_catchup"] if catch_up else lim["import_chunk_provision"])


def d_backoff_limit(_profile: dict | None = None) -> int:
    return 1


def catchup_memory_max(profile: dict) -> str:
    return str(limits_for(profile)["catchup_memory_max"])


def _yaml_mem_block(svc: str, mem: str | None, devices: bool) -> str:
    lines = [f"  {svc}:\n"]
    wrote = False
    if mem:
        lines.append(f"    mem_limit: {mem}\n")
        wrote = True
    if devices:
        lines.append("    devices:\n")
        lines.append("      - /dev/dri:/dev/dri\n")
        wrote = True
    return "".join(lines) if wrote else ""


def compose_override_text(profile: dict, *, has_dri: bool) -> str:
    lim = limits_for(profile)
    body = ["services:\n"]
    jf = _yaml_mem_block("jellyfin", lim["jellyfin_mem"], has_dri)
    if jf:
        body.append(jf)
    if has_dri:
        plex = _yaml_mem_block("plex", None, True)
        if plex:
            body.append(plex)
    for svc, key in (("sonarr", "sonarr_mem"), ("radarr", "radarr_mem")):
        block = _yaml_mem_block(svc, lim[key], False)
        if block:
            body.append(block)
    if body == ["services:\n"]:
        return ""
    return "".join(body)


def catchup_dropin_text(profile: dict) -> str:
    lim = limits_for(profile)
    return (
        "[Service]\n"
        f"MemoryMax={lim['catchup_memory_max']}\n"
        f"Nice={lim['nice']}\n"
        "IOSchedulingClass=best-effort\n"
        f"IOSchedulingPriority={lim['ioprio']}\n"
    )


def apply_runtime_files(
    profile: dict | None = None,
    *,
    compose_dir: Path | None = None,
    dropin_path: Path | None = None,
    profile_path: Path | None = None,
    has_dri: bool | None = None,
) -> dict:
    """Write systemd drop-in, compose.override.yml, hardware-profile.json. Never /media."""
    prof = dict(profile or measure())
    lim = limits_for(prof)
    dri = has_vaapi_dri() if has_dri is None else bool(has_dri)
    out = {"profile": prof, "limits": lim, "has_dri": dri}
    text = compose_override_text(prof, has_dri=dri)
    cdir = Path(compose_dir or COMPOSE)
    override = cdir / "compose.override.yml"
    try:
        cdir.mkdir(parents=True, exist_ok=True)
        if text:
            override.write_text(text)
            out["compose_override"] = str(override)
        elif override.exists():
            override.unlink()
            out["compose_override"] = "removed"
    except OSError as e:
        out["compose_error"] = str(e)

    dropin = Path(dropin_path or CATCHUP_DROPIN)
    try:
        dropin.parent.mkdir(parents=True, exist_ok=True)
        dropin.write_text(catchup_dropin_text(prof))
        out["catchup_dropin"] = str(dropin)
        out["catchup_memory_max"] = lim["catchup_memory_max"]
    except OSError as e:
        out["dropin_error"] = str(e)

    ppath = Path(profile_path or PROFILE_PATH)
    try:
        ppath.parent.mkdir(parents=True, exist_ok=True)
        doc = {**prof, **{k: lim[k] for k in lim}, "has_dri": dri}
        ppath.write_text(json.dumps(doc, indent=2) + "\n")
        out["profile_path"] = str(ppath)
    except OSError as e:
        out["profile_error"] = str(e)
    return out


def log_line(profile: dict | None = None) -> str:
    prof = profile or measure()
    lim = limits_for(prof)
    return (
        f"hardware profile ram_gb={prof['ram_gb']} cpus={prof['cpus']} "
        f"disk_kind={prof['disk_kind']} tiny={str(prof['tiny']).lower()} "
        f"catchup_memory_max={lim['catchup_memory_max']} "
        f"jellyfin_mem={lim['jellyfin_mem'] or 'unset'} "
        f"import_folder_cap_catchup={lim['import_folder_cap_catchup']}"
    )


def _self_test() -> int:
    tiny = profile_from_facts(**FIXTURE_TINY_4GB)
    laptop = profile_from_facts(**FIXTURE_LAPTOP_16GB)
    big = profile_from_facts(**FIXTURE_LAPTOP_32GB)
    assert tiny["tiny"] is True
    assert tiny["ram_gb"] < 4.5
    assert laptop["tiny"] is False
    assert big["tiny"] is False
    t = limits_for(tiny)
    assert t["catchup_memory_max"] == "768M"
    assert t["jellyfin_mem"] is None
    assert t["sonarr_mem"] is None
    assert t["import_folder_cap_catchup"] == 6
    assert t["import_folder_cap_provision"] == 12
    assert t["import_chunk_catchup"] == 8
    assert t["import_chunk_provision"] == 20
    assert t["d_backoff_limit"] == 1
    l16 = limits_for(laptop)
    assert l16["catchup_memory_max"] == "2G"
    assert l16["jellyfin_mem"] == "5G"  # not stuck at 4G
    assert l16["sonarr_mem"] == "2G"
    assert l16["import_folder_cap_catchup"] > 16
    assert l16["import_chunk_catchup"] > 8
    l32 = limits_for(big)
    assert l32["catchup_memory_max"] == "8G"
    jelly_g = int(str(l32["jellyfin_mem"]).rstrip("G"))
    assert jelly_g > 4
    assert l32["import_folder_cap_catchup"] > l16["import_folder_cap_catchup"]
    assert import_chunk_size(laptop, catch_up=True, d_state=12) == 0
    assert import_chunk_size(tiny, catch_up=True, d_state=1) == 0
    assert import_chunk_size(laptop, catch_up=True, d_state=0) == l16["import_chunk_catchup"]
    yml = compose_override_text(laptop, has_dri=True)
    assert "mem_limit: 5G" in yml
    assert "/dev/dri" in yml
    yml_tiny = compose_override_text(tiny, has_dri=False)
    assert yml_tiny == ""
    drop = catchup_dropin_text(big)
    assert "MemoryMax=8G" in drop
    drop_t = catchup_dropin_text(tiny)
    assert "MemoryMax=768M" in drop_t
    # Live disk probe shouldn't crash
    kind = disk_kind_from_sys()
    assert kind in {"ssd", "rotational", "unknown"}
    print("reelos_hardware self-test ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    fixture = None
    if "--fixture" in args:
        i = args.index("--fixture")
        name = args[i + 1] if i + 1 < len(args) else ""
        fixture = {
            "tiny": FIXTURE_TINY_4GB,
            "4gb": FIXTURE_TINY_4GB,
            "laptop-16": FIXTURE_LAPTOP_16GB,
            "laptop-32": FIXTURE_LAPTOP_32GB,
        }.get(name)
        if fixture is None:
            print(f"unknown fixture {name}", file=sys.stderr)
            return 1
    if "--self-test" in args:
        return _self_test()
    prof = profile_from_facts(**fixture) if fixture else measure()
    if "--d-backoff" in args:
        print(d_backoff_limit(prof))
        return 0
    if "--catchup-memory" in args:
        print(catchup_memory_max(prof))
        return 0
    if "--log" in args:
        print(log_line(prof))
        return 0
    if "--apply" in args:
        out = apply_runtime_files(prof)
        print(json.dumps({"ok": True, **out, "line": log_line(prof)}, default=str))
        return 0
    print(json.dumps({**prof, **limits_for(prof)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
