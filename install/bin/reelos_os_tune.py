#!/usr/bin/env python3
"""ReelOS OS tune for the HP 4GB HDD fixture — scale up when RAM/SSD exist.

Detect hardware. zram on rotational disk so 4GB boxes do not thrash HDD swap.
Do not reserve 512M crashkernel/kdump on ≤4.5Gi RAM. Never /media. Never ota.lock.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

try:
    import reelos_hardware as hw
except ImportError:  # pragma: no cover — layout as /opt/reelos/bin
    hw = None  # type: ignore

WAIT_FUSE_BUSY = "TorBox filesystem busy — not copying to disk"
WAIT_APPLY = "swapping the app"
WAIT_SMALL_BOX = "4GB + HDD, small-box limits"
WAIT_SMALL_LIBRARY = f"Library catching up — {WAIT_SMALL_BOX}"

SMALL_MEM_KB = 4_718_592  # 4.5 Gi — same as reelos_hardware
ZRAM_CONF_DEFAULT = "/etc/systemd/zram-generator.conf"
GRUB_DROPIN_DEFAULT = "/etc/default/grub.d/reelos-nokdump.cfg"
KDUMP_DEFAULT = "/etc/default/kdump-tools"


def _path(env_key: str, default: str) -> Path:
    return Path(os.environ.get(env_key, default))


def zram_conf_text(*, ram_gb: float) -> str:
    """Compressed RAM swap. Cap 2G so a 4GB box still has headroom."""
    mb = max(256, min(2048, int(float(ram_gb or 0) * 1024 / 2) or 1024))
    return (
        "# ReelOS — zram on rotational disk. Do not copy TorBox dumps here.\n"
        "[zram0]\n"
        f"zram-size = {mb}\n"
        "compression-algorithm = zstd\n"
        "swap-priority = 100\n"
    )


def grub_nokdump_text() -> str:
    return (
        "# ReelOS — do not reserve 512M kdump on ≤4.5Gi RAM.\n"
        'GRUB_CMDLINE_LINUX_DEFAULT="${GRUB_CMDLINE_LINUX_DEFAULT} crashkernel=no"\n'
    )


def kdump_tools_text() -> str:
    return "USE_KDUMP=0\n"


def os_tune_plan(profile: dict | None = None) -> dict:
    """Decide zram + kdump from a hardware profile. HP 4GB HDD is the tiny path."""
    prof = dict(profile or {})
    ram_kb = int(prof.get("ram_kb") or 0)
    ram_gb = float(prof.get("ram_gb") or 0)
    if ram_gb <= 0 and ram_kb:
        ram_gb = round(ram_kb / 1024 / 1024, 2)
    tiny = bool(prof.get("tiny")) or (0 < ram_kb <= SMALL_MEM_KB) or (0 < ram_gb <= 4.5)
    kind = str(prof.get("disk_kind") or "unknown")
    rotational = kind == "rotational"
    zram = rotational
    zram_mb = max(256, min(2048, int(ram_gb * 1024 / 2) or 1024)) if zram else 0
    reasons = []
    if zram:
        reasons.append("zram on rotational disk")
    if tiny:
        reasons.append("do not reserve 512M kdump")
    if tiny and rotational:
        reasons.append(WAIT_SMALL_BOX)
    return {
        "tiny": tiny,
        "disk_kind": kind,
        "rotational": rotational,
        "zram": zram,
        "zram_size_mb": zram_mb,
        "disable_kdump": tiny,
        "crashkernel": "no" if tiny else None,
        "wait_apply": WAIT_APPLY,
        "wait_fuse_busy": WAIT_FUSE_BUSY,
        "wait_small_box": WAIT_SMALL_BOX if tiny and rotational else "",
        "reason": "; ".join(reasons) or "no extra OS tune",
    }


def honest_wait_copy(
    *,
    applying: bool = False,
    fuse_busy: bool = False,
    tiny_hdd: bool = False,
    running: bool = False,
) -> str:
    """Nanoseconds = skip work the user cannot see. Say the wait that is real."""
    if applying:
        return WAIT_APPLY
    if fuse_busy:
        return WAIT_FUSE_BUSY
    if running and tiny_hdd:
        return WAIT_SMALL_LIBRARY
    if running:
        return "Library catching up"
    return ""


def _measure() -> dict:
    if hw is not None:
        return hw.measure()
    return {"ram_kb": 0, "ram_gb": 0, "cpus": 1, "disk_kind": "unknown", "tiny": False}


def apply_tune(
    profile: dict | None = None,
    *,
    write_files: bool = True,
    install_packages: bool = False,
) -> dict:
    """Write zram + kdump drop-ins. Never /media. Never ota.lock."""
    prof = dict(profile or _measure())
    plan = os_tune_plan(prof)
    out = {"ok": True, "plan": plan, "wrote": []}
    if not write_files:
        return out

    if plan["zram"]:
        zpath = _path("REELOS_ZRAM_CONF", ZRAM_CONF_DEFAULT)
        try:
            zpath.parent.mkdir(parents=True, exist_ok=True)
            zpath.write_text(zram_conf_text(ram_gb=float(prof.get("ram_gb") or plan["zram_size_mb"] / 1024)))
            out["wrote"].append(str(zpath))
            out["zram_conf"] = str(zpath)
        except OSError as e:
            out["zram_error"] = str(e)
            out["ok"] = False
        if install_packages:
            try:
                subprocess.run(
                    ["apt-get", "install", "-y", "--no-install-recommends", "systemd-zram-generator"],
                    check=False,
                    capture_output=True,
                    timeout=180,
                )
            except (OSError, subprocess.TimeoutExpired):
                out["zram_pkg"] = "skipped"

    if plan["disable_kdump"]:
        gpath = _path("REELOS_GRUB_DROPIN", GRUB_DROPIN_DEFAULT)
        try:
            gpath.parent.mkdir(parents=True, exist_ok=True)
            gpath.write_text(grub_nokdump_text())
            out["wrote"].append(str(gpath))
            out["grub_dropin"] = str(gpath)
        except OSError as e:
            out["grub_error"] = str(e)
            out["ok"] = False
        kpath = _path("REELOS_KDUMP_DEFAULT", KDUMP_DEFAULT)
        try:
            kpath.parent.mkdir(parents=True, exist_ok=True)
            kpath.write_text(kdump_tools_text())
            out["wrote"].append(str(kpath))
            out["kdump_default"] = str(kpath)
        except OSError as e:
            out["kdump_error"] = str(e)
        if install_packages:
            try:
                subprocess.run(
                    ["systemctl", "disable", "--now", "kdump-tools", "kdump.service"],
                    check=False,
                    capture_output=True,
                    timeout=20,
                )
            except (OSError, subprocess.TimeoutExpired):
                pass
            try:
                subprocess.run(["update-grub"], check=False, capture_output=True, timeout=60)
            except (OSError, subprocess.TimeoutExpired):
                out["update_grub"] = "skipped"
    return out


def _self_test() -> int:
    tiny = {
        "ram_kb": 3_383_440,
        "ram_gb": 3.23,
        "cpus": 4,
        "disk_kind": "rotational",
        "tiny": True,
    }
    ssd = {
        "ram_kb": 16 * 1024 * 1024,
        "ram_gb": 16.0,
        "cpus": 8,
        "disk_kind": "ssd",
        "tiny": False,
    }
    p = os_tune_plan(tiny)
    assert p["zram"] is True
    assert p["disable_kdump"] is True
    assert p["crashkernel"] == "no"
    assert p["zram_size_mb"] >= 256
    assert p["zram_size_mb"] <= 2048
    assert WAIT_SMALL_BOX in p["reason"]
    assert "512M" in p["reason"]
    s = os_tune_plan(ssd)
    assert s["zram"] is False
    assert s["disable_kdump"] is False
    assert s["crashkernel"] is None
    ztxt = zram_conf_text(ram_gb=3.23)
    assert "zram0" in ztxt
    assert "zstd" in ztxt
    assert "512" not in grub_nokdump_text() or "crashkernel=no" in grub_nokdump_text()
    assert "crashkernel=no" in grub_nokdump_text()
    assert "USE_KDUMP=0" in kdump_tools_text()
    assert honest_wait_copy(applying=True) == WAIT_APPLY
    assert honest_wait_copy(fuse_busy=True) == WAIT_FUSE_BUSY
    assert WAIT_SMALL_BOX in honest_wait_copy(running=True, tiny_hdd=True)
    assert honest_wait_copy(running=True, tiny_hdd=False) == "Library catching up"
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as td:
        env = {
            "REELOS_ZRAM_CONF": str(Path(td) / "zram.conf"),
            "REELOS_GRUB_DROPIN": str(Path(td) / "grub.d" / "reelos-nokdump.cfg"),
            "REELOS_KDUMP_DEFAULT": str(Path(td) / "kdump-tools"),
        }
        old = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        try:
            out = apply_tune(tiny, write_files=True, install_packages=False)
            assert out["ok"] is True
            assert Path(env["REELOS_ZRAM_CONF"]).is_file()
            assert "crashkernel=no" in Path(env["REELOS_GRUB_DROPIN"]).read_text()
            assert Path(env["REELOS_KDUMP_DEFAULT"]).read_text() == "USE_KDUMP=0\n"
            skip = apply_tune(ssd, write_files=True, install_packages=False)
            assert skip["plan"]["zram"] is False
        finally:
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
    print("reelos_os_tune self-test ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if "--self-test" in args:
        return _self_test()
    fixture = None
    if "--fixture" in args:
        i = args.index("--fixture")
        name = args[i + 1] if i + 1 < len(args) else ""
        fixture = {
            "tiny": {
                "ram_kb": 3_383_440,
                "ram_gb": 3.23,
                "cpus": 4,
                "disk_kind": "rotational",
                "tiny": True,
            },
            "4gb": {
                "ram_kb": 3_383_440,
                "ram_gb": 3.23,
                "cpus": 4,
                "disk_kind": "rotational",
                "tiny": True,
            },
            "laptop-16": {
                "ram_kb": 16 * 1024 * 1024,
                "ram_gb": 16.0,
                "cpus": 8,
                "disk_kind": "ssd",
                "tiny": False,
            },
        }.get(name)
        if fixture is None:
            print(f"unknown fixture {name}", file=sys.stderr)
            return 1
    prof = fixture if fixture is not None else _measure()
    if "--plan" in args:
        print(json.dumps(os_tune_plan(prof), indent=2))
        return 0
    if "--apply" in args:
        live = fixture is None
        out = apply_tune(prof, write_files=True, install_packages=live)
        print(json.dumps(out, default=str))
        return 0 if out.get("ok") else 1
    print(json.dumps(os_tune_plan(prof), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
