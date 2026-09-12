#!/usr/bin/env python3
"""ReelOS per-box hardware profile — cheap detect, persist, drive knobs.

Probe is seconds, not a benchmark: /proc/meminfo, nproc/cpu model, lsblk ROTA,
root-on-USB, kdump reservation, swap/zram. No Geekbench, no fio, no fill-disk.
Saved JSON at /var/lib/reelos/hardware-profile.json is the source of truth for
low-perf, FUSE count, dump ffprobe, zram/kdump, search parallelism, splash copy.
4.5Gi MemTotal remains the fallback if probe has not run yet.

House HP 15-bs0xx expected (read-only 2026-09-11/12, not a Pi):
  MemTotal 3383440 kB (~3.23Gi visible after iGPU/reserved)
  4× Intel Pentium N3710 @ 1.60GHz
  WD5000LPCX rotational HDD, root on internal (not USB)
  crashkernel/kdump often ~512Mi reserved — disable on ≤4.5Gi
  summary: "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal"
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROBE_VERSION = 2
SMALL_MEM_KB = 4_718_592  # 4.5 Gi — tiny fixture (4GB laptop, not a Pi)
TINY_RAM_GB = 4.5
CGROUP_HIDE_SLACK_KB = 262_144  # 256 Mi — iGPU steal is not a cgroup hide

# House HP 15-bs0xx (2026-09-11): 3383440 kB, 4× Pentium N3710, WD5000LPCX HDD.
FIXTURE_TINY_4GB = {
    "ram_kb": 3_383_440,
    "cpus": 4,
    "disk_kind": "rotational",
    "disk_free_gb": 410.0,
    "disk_size_gb": 500.0,
    "cpu_model": "Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
    "product": "HP Laptop 15-bs0xx",
    "root_on_usb": False,
    "kdump_reserved_kb": 524_288,
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


def cpu_model(text: str | None = None) -> str:
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/cpuinfo").read_text()
        except OSError:
            return ""
    for line in str(raw).splitlines():
        if line.lower().startswith("model name") and ":" in line:
            return line.split(":", 1)[1].strip()
    return ""


def cpu_short(model: str, cpus: int) -> str:
    raw = re.sub(r"\((?:R|TM)\)", "", str(model or ""), flags=re.I)
    raw = re.sub(r"\s+", " ", raw).strip()
    m = re.search(
        r"(Pentium|Celeron|Xeon|Ryzen|Athlon|Core i[3579]|Apple M\d)(?:\s+CPU)?\s+([A-Z0-9-]+)",
        raw,
        re.I,
    )
    if m:
        name = f"{m.group(1)} {m.group(2)}"
    else:
        name = (raw.split("@")[0].strip() or "CPU")[:28]
    return f"{max(1, int(cpus or 1))}c {name}"


def ram_label(ram_gb: float, ram_kb: int = 0) -> str:
    gb = float(ram_gb or 0)
    if gb <= 0 and ram_kb:
        gb = ram_gb_from_kb(int(ram_kb))
    if 0 < gb <= 4.5:
        gi = 4 if gb >= 2.5 else max(1, round(gb))
    else:
        gi = max(1, round(gb)) if gb else 0
    return f"{gi}Gi RAM" if gi else "RAM unknown"


def _block_tran(name: str) -> str:
    for p in (
        Path("/sys/block") / name / "device" / "uevent",
        Path("/sys/block") / name / "device" / "device" / "uevent",
    ):
        try:
            text = p.read_text()
        except OSError:
            continue
        low = text.lower()
        if "usb" in low:
            return "usb"
        if "nvme" in low:
            return "nvme"
        if "sata" in low or "ata" in low:
            return "sata"
    # device symlink often contains /usb/
    try:
        real = os.path.realpath(f"/sys/block/{name}/device")
        if "/usb" in real.lower():
            return "usb"
    except OSError:
        pass
    return ""


def lsblk_rows() -> list[dict]:
    """Cheap lsblk inventory. Seconds, not fio."""
    try:
        r = subprocess.run(
            ["lsblk", "-d", "-n", "-b", "-o", "NAME,ROTA,TYPE,TRAN,SIZE,MODEL"],
            capture_output=True,
            text=True,
            check=False,
            timeout=3,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    rows = []
    for line in (r.stdout or "").splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        name, rota, typ, tran, size = parts[0], parts[1], parts[2], parts[3], parts[4]
        model = " ".join(parts[5:]) if len(parts) > 5 else ""
        if typ != "disk":
            continue
        if name.startswith(("loop", "sr", "ram", "zram")):
            continue
        try:
            rota_i = int(rota)
        except ValueError:
            rota_i = -1
        try:
            size_b = int(size)
        except ValueError:
            size_b = 0
        rows.append(
            {
                "name": name,
                "rota": rota_i,
                "type": typ,
                "tran": "" if tran in {"-", ""} else tran.lower(),
                "size": size_b,
                "model": model,
            }
        )
    return rows


def block_devices_from_sys() -> list[dict]:
    rows = lsblk_rows()
    if rows:
        for row in rows:
            if not row.get("tran"):
                row["tran"] = _block_tran(str(row.get("name") or ""))
        return rows
    out = []
    sysb = Path("/sys/block")
    try:
        for blk in sorted(sysb.iterdir()):
            n = blk.name
            if n.startswith(("loop", "sr", "ram", "zram", "dm-")):
                continue
            rota = _sys_rotational(n)
            if rota is None:
                continue
            out.append(
                {
                    "name": n,
                    "rota": int(rota),
                    "type": "disk",
                    "tran": _block_tran(n),
                    "size": 0,
                    "model": "",
                }
            )
    except OSError:
        pass
    return out


def root_on_usb(*, root: str = "/", devices: list[dict] | None = None) -> bool:
    src = ""
    try:
        r = subprocess.run(
            ["findmnt", "-n", "-o", "SOURCE", root],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        )
        src = (r.stdout or "").strip()
    except (OSError, subprocess.TimeoutExpired):
        src = ""
    name = _block_name(src) if src else ""
    if not name:
        return False
    for d in devices or []:
        if d.get("name") == name and str(d.get("tran") or "") == "usb":
            return True
    return _block_tran(name) == "usb"


def kdump_reserved_kb(cmdline: str | None = None) -> int:
    """crashkernel reservation in kB. 0 if none / crashkernel=no."""
    raw = cmdline
    if raw is None:
        try:
            raw = Path("/proc/cmdline").read_text()
        except OSError:
            raw = ""
    s = str(raw or "")
    if re.search(r"crashkernel=no\b", s):
        return 0
    m = re.search(r"crashkernel=(\d+)([KMG])?", s, re.I)
    if m:
        n = int(m.group(1))
        unit = (m.group(2) or "M").upper()
        if unit == "G":
            return n * 1024 * 1024
        if unit == "K":
            return n
        return n * 1024
    try:
        n = int(Path("/sys/kernel/kexec_crash_size").read_text().strip())
        return n // 1024 if n else 0
    except (OSError, ValueError):
        return 0


def swap_facts(text: str | None = None) -> dict:
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/swaps").read_text()
        except OSError:
            raw = ""
    zram = False
    hdd = False
    total_kb = 0
    for i, line in enumerate(str(raw or "").splitlines()):
        if i == 0 and line.lower().startswith("filename"):
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        name, size = parts[0], parts[2]
        try:
            total_kb += int(size)
        except ValueError:
            pass
        low = name.lower()
        if "zram" in low:
            zram = True
        elif low.startswith("/dev/") and "zram" not in low:
            hdd = True
    return {"zram": zram, "hdd": hdd, "total_kb": total_kb}


def disk_free_gb(path: str = "/") -> float:
    try:
        u = shutil.disk_usage(path)
        return round(u.free / (1024**3), 1)
    except OSError:
        return 0.0


def disk_size_gb_from_devices(devices: list | None) -> float:
    best = 0
    for d in devices or []:
        try:
            n = int(d.get("size") or 0)
        except (TypeError, ValueError):
            n = 0
        if n > best:
            best = n
    if best > 0:
        return round(best / (1024**3), 0)
    try:
        u = shutil.disk_usage("/")
        return round(u.total / (1024**3), 0)
    except OSError:
        return 0.0


def direct_map_kb(text: str | None = None) -> int:
    """Kernel DirectMap* is mapped physical RAM (DIMMs), not a cgroup view."""
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/meminfo").read_text()
        except OSError:
            return 0
    total = 0
    for line in str(raw).splitlines():
        if line.startswith("DirectMap"):
            try:
                total += int(line.split()[1])
            except (ValueError, IndexError):
                continue
    return total


def cgroup_memory_max_kb(text: str | None = None) -> int | None:
    """None = unlimited/unknown. Finite max can hide DIMMs from MemTotal in some boxes."""
    raw = text
    if raw is None:
        for p in (
            "/sys/fs/cgroup/memory.max",
            "/sys/fs/cgroup/user.slice/memory.max",
        ):
            try:
                raw = Path(p).read_text().strip()
                break
            except OSError:
                continue
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s == "max":
        return None
    try:
        n = int(s)
    except ValueError:
        return None
    return n // 1024  # cgroup v2 memory.max is bytes


def product_name() -> str:
    for p in (
        "/sys/devices/virtual/dmi/id/product_name",
        "/sys/firmware/devicetree/base/model",
        "/proc/device-tree/model",
    ):
        try:
            t = Path(p).read_text().strip().replace("\x00", "")
            if t:
                return t
        except OSError:
            continue
    return ""


def is_pi(name: str | None = None) -> bool:
    n = str(name if name is not None else product_name()).lower()
    return "raspberry" in n or n.startswith("raspberry") or "raspberrypi" in n


def ram_choice(
    *,
    mem_total_kb: int,
    direct_kb: int = 0,
    cgroup_max_kb: int | None = None,
) -> dict:
    """If cgroup hides DIMMs, use DirectMap. Else use MemTotal (visible).

    House HP 15-bs0xx: DirectMap ~3.91Gi, MemTotal 3.23Gi, cgroup max=unlimited
    → iGPU/reserved steal on a 4GB DIMM, not a hidden 8/16/32GB stick.
    """
    visible = int(mem_total_kb or 0)
    physical = int(direct_kb or 0) or visible
    hide = (
        cgroup_max_kb is not None
        and int(cgroup_max_kb) > 0
        and physical > 0
        and int(cgroup_max_kb) + CGROUP_HIDE_SLACK_KB < physical
    )
    if hide:
        return {
            "ram_kb": physical,
            "ram_source": "cgroup-hidden",
            "visible_kb": visible,
            "physical_kb": physical,
            "cgroup_hiding": True,
        }
    return {
        "ram_kb": visible,
        "ram_source": "memtotal",
        "visible_kb": visible,
        "physical_kb": physical or visible,
        "cgroup_hiding": False,
    }


def has_vaapi_dri(dri: str | Path = "/dev/dri") -> bool:
    p = Path(dri)
    if not p.exists():
        return False
    try:
        return any(c.name.startswith(("renderD", "card")) for c in p.iterdir())
    except OSError:
        return True


def measure(*, meminfo: str | None = None, nproc_text: str | None = None, root: str = "/") -> dict:
    live = meminfo is None and nproc_text is None
    info = None
    if meminfo is not None:
        info = meminfo
    elif live:
        try:
            info = Path("/proc/meminfo").read_text()
        except OSError:
            info = None
    ram_visible = mem_total_kb(info)
    direct = direct_map_kb(info)
    cgroup = cgroup_memory_max_kb() if live else None
    choice = ram_choice(mem_total_kb=ram_visible, direct_kb=direct, cgroup_max_kb=cgroup)
    cpus = nproc_count(nproc_text)
    model = cpu_model() if live else ""
    devices: list[dict] = []
    swap = {"zram": False, "hdd": False, "total_kb": 0}
    kdump = 0
    usb_root = False
    if live:
        kind = disk_kind_from_sys(root=root)
        free = disk_free_gb(root)
        product = product_name()
        devices = block_devices_from_sys()
        usb_root = root_on_usb(root=root, devices=devices)
        kdump = kdump_reserved_kb()
        swap = swap_facts()
        if kind == "unknown":
            for d in devices:
                if int(d.get("rota") or -1) == 1:
                    kind = "rotational"
                    break
                if int(d.get("rota") or -1) == 0:
                    kind = "ssd"
                    break
    else:
        kind = "unknown"
        free = 0.0
        product = ""
    return profile_from_facts(
        ram_kb=choice["ram_kb"],
        cpus=cpus,
        disk_kind=kind,
        disk_free_gb=free,
        ram_source=choice["ram_source"],
        visible_kb=choice["visible_kb"],
        physical_kb=choice["physical_kb"],
        cgroup_hiding=choice["cgroup_hiding"],
        product=product,
        cpu_model=model,
        root_on_usb=usb_root,
        kdump_reserved_kb=kdump,
        swap=swap,
        block_devices=devices,
        disk_size_gb=disk_size_gb_from_devices(devices),
    )


def summary_string(profile: dict) -> str:
    ram = ram_label(float(profile.get("ram_gb") or 0), int(profile.get("ram_kb") or 0))
    cpu = cpu_short(str(profile.get("cpu_model") or ""), int(profile.get("cpus") or 1))
    kind = str(profile.get("disk_kind") or "unknown")
    disk = "HDD" if kind == "rotational" else ("SSD" if kind == "ssd" else "disk")
    root = "root-on-usb" if profile.get("root_on_usb") else "root-on-internal"
    return f"{ram} · {cpu} · {disk} · {root}"


def splash_tune_line(profile: dict) -> str:
    tiny = bool(profile.get("tiny"))
    kind = str(profile.get("disk_kind") or "")
    if tiny and kind == "rotational":
        return "Tuning for 4GB RAM · spinning disk"
    if tiny:
        return "Tuning for 4GB RAM…"
    if kind == "rotational":
        return "Tuning for spinning disk…"
    return ""


def profile_from_facts(
    *,
    ram_kb: int,
    cpus: int,
    disk_kind: str = "unknown",
    disk_free_gb: float = 0.0,
    disk_size_gb: float = 0.0,
    ram_source: str = "memtotal",
    visible_kb: int | None = None,
    physical_kb: int | None = None,
    cgroup_hiding: bool = False,
    product: str = "",
    cpu_model: str = "",
    root_on_usb: bool = False,
    kdump_reserved_kb: int = 0,
    swap: dict | None = None,
    block_devices: list | None = None,
) -> dict:
    ram_gb = ram_gb_from_kb(int(ram_kb or 0))
    tiny = 0 < int(ram_kb or 0) <= SMALL_MEM_KB
    vis = int(visible_kb if visible_kb is not None else ram_kb or 0)
    phys = int(physical_kb if physical_kb is not None else ram_kb or 0)
    name = str(product or "")
    model = str(cpu_model or "")
    prof = {
        "probe_version": PROBE_VERSION,
        "ram_kb": int(ram_kb or 0),
        "ram_gb": ram_gb,
        "cpus": max(1, int(cpus or 1)),
        "disk_kind": disk_kind if disk_kind in {"ssd", "rotational", "unknown"} else "unknown",
        "disk_free_gb": float(disk_free_gb or 0),
        "disk_size_gb": float(disk_size_gb or 0) or disk_size_gb_from_devices(block_devices),
        "tiny": tiny,
        "box_is_small": tiny,
        "ram_source": ram_source if ram_source in {"memtotal", "cgroup-hidden"} else "memtotal",
        "visible_kb": vis,
        "physical_kb": phys,
        "cgroup_hiding": bool(cgroup_hiding),
        "product": name,
        "cpu_model": model,
        "root_on_usb": bool(root_on_usb),
        "kdump_reserved_kb": int(kdump_reserved_kb or 0),
        "swap": dict(swap or {"zram": False, "hdd": False, "total_kb": 0}),
        "block_devices": list(block_devices or []),
        "not_a_pi": (not is_pi(name)) if name else True,
    }
    prof["summary"] = summary_string(prof)
    prof["splash_tune"] = splash_tune_line(prof)
    return prof


def limits_for(profile: dict) -> dict:
    """Runtime throttle. D-state is applied by callers (concurrency 0 when high)."""
    ram_gb = float(profile.get("ram_gb") or 0)
    ram_kb = int(profile.get("ram_kb") or 0)
    cpus = max(1, int(profile.get("cpus") or 1))
    kind = str(profile.get("disk_kind") or "unknown")
    free = float(profile.get("disk_free_gb") or 0)
    tiny = bool(profile.get("tiny")) or (0 < ram_kb <= SMALL_MEM_KB) or ram_gb <= TINY_RAM_GB

    if tiny:
        # Keep RAM caps. Scale CPU/SSD; HDD stays on today's 6/12/8/20.
        catchup_mem = "768M"
        jellyfin_mem = None
        sonarr_mem = None
        radarr_mem = None
        nice = 10
        if kind == "ssd":
            catchup_folders = min(24, max(6, cpus * 2))
            provision_folders = min(48, max(12, cpus * 4))
            catchup_chunk = min(24, max(8, cpus * 2))
            provision_chunk = min(40, max(20, cpus * 4))
            ioprio = 4
        else:
            catchup_folders = 6
            provision_folders = 12
            catchup_chunk = 8
            provision_chunk = 20
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

    hdd = kind == "rotational"
    constrained = tiny or hdd
    parallel = 1 if constrained else min(4, cpus)
    return {
        "tiny": tiny,
        "low_perf": tiny,
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
        "fuse_count": 1 if constrained else 1,
        "skip_dump_ffprobe": constrained,
        "zram": hdd,
        "disable_kdump": tiny,
        "search_parallelism": parallel,
        "indexer_parallelism": parallel,
        "splash_tune": splash_tune_line({"tiny": tiny, "disk_kind": kind}),
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


def load_saved(path: Path | None = None) -> dict | None:
    p = Path(path or PROFILE_PATH)
    try:
        doc = json.loads(p.read_text())
    except (OSError, json.JSONDecodeError, TypeError):
        return None
    if not isinstance(doc, dict):
        return None
    if not int(doc.get("ram_kb") or doc.get("ramKb") or 0):
        return None
    return doc


def current_profile(path: Path | None = None) -> dict:
    """Saved profile is source of truth. 4.5Gi MemTotal fallback if probe has not run."""
    saved = load_saved(path)
    if saved:
        return saved
    return measure()


def identity_fingerprint(profile: dict) -> str:
    blocks = []
    for b in profile.get("block_devices") or []:
        blocks.append(f"{b.get('name')}:{b.get('rota')}:{b.get('tran') or ''}")
    payload = {
        "v": int(profile.get("probe_version") or 0),
        "ram_kb": int(profile.get("ram_kb") or 0),
        "cpus": int(profile.get("cpus") or 1),
        "disk_kind": str(profile.get("disk_kind") or "unknown"),
        "root_on_usb": bool(profile.get("root_on_usb")),
        "cpu_model": str(profile.get("cpu_model") or ""),
        "kdump": int(profile.get("kdump_reserved_kb") or 0),
        "blocks": blocks,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def identity_unchanged(old: dict | None, new: dict) -> bool:
    if not old:
        return False
    if int(old.get("probe_version") or 0) < PROBE_VERSION:
        return False
    return identity_fingerprint(old) == identity_fingerprint(new)


def persist_profile(
    profile: dict,
    *,
    path: Path | None = None,
    limits: dict | None = None,
    has_dri: bool = False,
) -> Path:
    ppath = Path(path or PROFILE_PATH)
    ppath.parent.mkdir(parents=True, exist_ok=True)
    lim = dict(limits if limits is not None else limits_for(profile))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {
        **profile,
        **{k: lim[k] for k in lim},
        "probe_version": PROBE_VERSION,
        "probed_at": now,
        "summary": profile.get("summary") or summary_string(profile),
        "splash_tune": profile.get("splash_tune") or splash_tune_line(profile),
        "fingerprint": identity_fingerprint(profile),
        "has_dri": has_dri,
        "knobs": {
            "low_perf": bool(lim.get("low_perf")),
            "fuse_count": int(lim.get("fuse_count") or 1),
            "skip_dump_ffprobe": bool(lim.get("skip_dump_ffprobe")),
            "zram": bool(lim.get("zram")),
            "disable_kdump": bool(lim.get("disable_kdump")),
            "search_parallelism": int(lim.get("search_parallelism") or 1),
            "indexer_parallelism": int(lim.get("indexer_parallelism") or 1),
            "catchup_memory_max": lim.get("catchup_memory_max"),
            "splash_tune": lim.get("splash_tune") or splash_tune_line(profile),
        },
    }
    ppath.write_text(json.dumps(doc, indent=2) + "\n")
    return ppath


def apply_runtime_files(
    profile: dict | None = None,
    *,
    compose_dir: Path | None = None,
    dropin_path: Path | None = None,
    profile_path: Path | None = None,
    has_dri: bool | None = None,
    skip_if_unchanged: bool = True,
) -> dict:
    """Write systemd drop-in, compose.override.yml, hardware-profile.json. Never /media.

    If the saved identity fingerprint matches, skip retuning (nanosecond = skip work).
    """
    ppath = Path(profile_path or PROFILE_PATH)
    saved = load_saved(ppath)
    prof = dict(profile or measure())
    lim = limits_for(prof)
    dri = has_vaapi_dri() if has_dri is None else bool(has_dri)
    out = {"profile": prof, "limits": lim, "has_dri": dri, "changed": True, "skipped": False}
    if skip_if_unchanged and identity_unchanged(saved, prof):
        out["changed"] = False
        out["skipped"] = True
        out["profile"] = saved or prof
        out["limits"] = limits_for(saved or prof)
        out["profile_path"] = str(ppath)
        out["compose_override"] = "unchanged"
        out["catchup_dropin"] = "unchanged"
        return out

    cdir = Path(compose_dir or COMPOSE)
    override = cdir / "compose.override.yml"
    # Tiny 4GB: do not rewrite compose.override.yml (a devices-only change
    # would recreate Jellyfin/Sonarr next to ffprobe D-state).
    if lim.get("tiny"):
        out["compose_override"] = "unchanged-tiny"
    else:
        text = compose_override_text(prof, has_dri=dri)
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

    try:
        persist_profile(prof, path=ppath, limits=lim, has_dri=dri)
        out["profile_path"] = str(ppath)
    except OSError as e:
        out["profile_error"] = str(e)
    return out


def ensure_profile(
    profile: dict | None = None,
    *,
    compose_dir: Path | None = None,
    dropin_path: Path | None = None,
    profile_path: Path | None = None,
    has_dri: bool | None = None,
) -> dict:
    """Re-probe. Skip retune when identity is unchanged. Cheap detect, not a bench."""
    return apply_runtime_files(
        profile,
        compose_dir=compose_dir,
        dropin_path=dropin_path,
        profile_path=profile_path,
        has_dri=has_dri,
        skip_if_unchanged=True,
    )


def log_line(profile: dict | None = None) -> str:
    prof = profile or current_profile()
    lim = limits_for(prof)
    pi = "Pi" if is_pi(str(prof.get("product") or "")) else "not a Pi"
    summary = prof.get("summary") or summary_string(prof)
    return (
        f"hardware profile {summary} "
        f"ram_gb={prof['ram_gb']} "
        f"visible_kb={prof.get('visible_kb') or prof['ram_kb']} "
        f"physical_kb={prof.get('physical_kb') or prof['ram_kb']} "
        f"ram_source={prof.get('ram_source') or 'memtotal'} "
        f"cgroup_hiding={str(bool(prof.get('cgroup_hiding'))).lower()} "
        f"product={prof.get('product') or 'unknown'} ({pi}) "
        f"cpus={prof['cpus']} disk_kind={prof['disk_kind']} "
        f"tiny={str(prof['tiny']).lower()} "
        f"fuse_count={lim.get('fuse_count')} "
        f"skip_dump_ffprobe={str(bool(lim.get('skip_dump_ffprobe'))).lower()} "
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
    # Tiny + SSD: keep 768M RAM cap, scale folders with nproc.
    tiny_ssd = profile_from_facts(ram_kb=3_383_440, cpus=4, disk_kind="ssd", disk_free_gb=200.0)
    ts = limits_for(tiny_ssd)
    assert ts["catchup_memory_max"] == "768M"
    assert ts["jellyfin_mem"] is None
    assert ts["import_folder_cap_catchup"] > 6
    # DIMM vs cgroup: house 4GB DirectMap + unlimited cgroup is not hiding.
    house = ram_choice(mem_total_kb=3_383_440, direct_kb=4_098_112, cgroup_max_kb=None)
    assert house["cgroup_hiding"] is False
    assert house["ram_source"] == "memtotal"
    assert house["ram_kb"] == 3_383_440
    # Hidden 16GB DIMM behind a 4GB cgroup → use DirectMap, stop hiding.
    hid = ram_choice(mem_total_kb=3_383_440, direct_kb=16 * 1024 * 1024, cgroup_max_kb=3_383_440)
    assert hid["cgroup_hiding"] is True
    assert hid["ram_kb"] == 16 * 1024 * 1024
    assert hid["ram_source"] == "cgroup-hidden"
    hp = profile_from_facts(
        ram_kb=house["ram_kb"],
        cpus=4,
        disk_kind="rotational",
        disk_free_gb=410.0,
        ram_source=house["ram_source"],
        visible_kb=house["visible_kb"],
        physical_kb=house["physical_kb"],
        product="HP Laptop 15-bs0xx",
        cpu_model="Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
        root_on_usb=False,
        kdump_reserved_kb=524_288,
    )
    assert hp["tiny"] is True
    assert hp["not_a_pi"] is True
    assert hp["summary"] == "4Gi RAM · 4c Pentium N3710 · HDD · root-on-internal"
    assert hp["splash_tune"] == "Tuning for 4GB RAM · spinning disk"
    hl = limits_for(hp)
    assert hl["fuse_count"] == 1
    assert hl["skip_dump_ffprobe"] is True
    assert hl["zram"] is True
    assert hl["disable_kdump"] is True
    assert hl["search_parallelism"] == 1
    assert hl["indexer_parallelism"] == 1
    assert hl["low_perf"] is True
    assert "not a Pi" in log_line(hp)
    assert "cgroup_hiding=false" in log_line(hp)
    assert "4Gi RAM" in log_line(hp)
    # Second probe with the same identity is a no-op (skip retune).
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as td:
        ppath = Path(td) / "hardware-profile.json"
        dropin = Path(td) / "hardware.conf"
        first = apply_runtime_files(
            hp,
            compose_dir=Path(td) / "compose",
            dropin_path=dropin,
            profile_path=ppath,
            has_dri=False,
            skip_if_unchanged=True,
        )
        assert first["skipped"] is False
        assert ppath.is_file()
        saved = json.loads(ppath.read_text())
        assert saved["summary"] == hp["summary"]
        assert saved["knobs"]["fuse_count"] == 1
        assert saved["knobs"]["skip_dump_ffprobe"] is True
        mtime = ppath.stat().st_mtime_ns
        drop_text = dropin.read_text()
        second = apply_runtime_files(
            hp,
            compose_dir=Path(td) / "compose",
            dropin_path=dropin,
            profile_path=ppath,
            has_dri=False,
            skip_if_unchanged=True,
        )
        assert second["skipped"] is True
        assert ppath.stat().st_mtime_ns == mtime
        assert dropin.read_text() == drop_text
        usb = profile_from_facts(
            ram_kb=house["ram_kb"],
            cpus=4,
            disk_kind="ssd",
            disk_free_gb=410.0,
            product="HP Laptop 15-bs0xx",
            cpu_model="Intel(R) Pentium(R) CPU N3710 @ 1.60GHz",
            root_on_usb=True,
            block_devices=[{"name": "sda", "rota": 0, "tran": "usb"}],
        )
        third = apply_runtime_files(
            usb,
            compose_dir=Path(td) / "compose",
            dropin_path=dropin,
            profile_path=ppath,
            has_dri=False,
            skip_if_unchanged=True,
        )
        assert third["skipped"] is False
        assert "root-on-usb" in json.loads(ppath.read_text())["summary"]
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
    if "--probe" in args:
        print(json.dumps({**prof, **limits_for(prof)}, indent=2))
        return 0
    if "--apply" in args or "--ensure" in args:
        out = ensure_profile(prof)
        print(json.dumps({"ok": True, **out, "line": log_line(out.get("profile") or prof)}, default=str))
        return 0
    print(json.dumps({**prof, **limits_for(prof)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
