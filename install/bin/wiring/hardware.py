"""Hardware detection, RAM profiling, and performance optimizations."""
from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from .common import (
    COMPOSE,
    NET_ERR,
    ROOT,
    STATE,
    answers,
    api_key,
    call,
    log_wire,
    wait_key,
)

SMALL_MEM_KB = 4_718_592
_HW = None

ARR_DEBRID_APPS = (
    ("sonarr", "http://127.0.0.1:8989/api/v3"),
    ("radarr", "http://127.0.0.1:7878/api/v3"),
)

FFPROBE_STUB_SCRIPT = r"""
src="$1"
[ -e "$src" ] || exit 0
if head -1 "$src" 2>/dev/null | grep -q '^#!/bin/sh'; then
  echo already_stub
  exit 0
fi
mv "$src" "${src}.busy-inode" 2>/dev/null || true
if [ ! -f "${src}.reelos-real" ] && [ -f "${src}.busy-inode" ]; then
  cp -a "${src}.busy-inode" "${src}.reelos-real" 2>/dev/null || true
fi
cat > "$src" << 'STUB'
#!/bin/sh
# ReelOS: do not ffprobe FUSE dumps.
sex=0
for a in "$@"; do
  case "$a" in
    *-sexagesimal*) sex=1 ;;
  esac
done
if [ "$sex" = "1" ]; then
  DUR="01:00:00.000000"
  START="00:00:00.000000"
else
  DUR="3600.000000"
  START="0.000000"
fi
for a in "$@"; do
  case "$a" in
    *json*)
      cat << EOF
{
  "streams": [
    {"index": 0, "codec_name": "h264", "codec_type": "video", "width": 1920, "height": 1080, "duration": "$DUR", "start_time": "$START", "tags": {"language": "eng"}},
    {"index": 1, "codec_name": "eac3", "codec_type": "audio", "channels": 6, "duration": "$DUR", "start_time": "$START", "tags": {"language": "eng"}}
  ],
  "format": {
    "filename": "dummy.mkv", "nb_streams": 2, "format_name": "matroska,webm", "duration": "$DUR", "size": "2147483648", "start_time": "$START", "bit_rate": "5000000"
  },
  "chapters": []
}
EOF
      exit 0
      ;;
  esac
done
echo "$DUR"
exit 0
STUB
chmod 755 "$src"
"""

FFPROBE_STUB_PATHS = (
    ("reelos-sonarr-1", "/app/sonarr/bin/ffprobe"),
    ("reelos-radarr-1", "/app/radarr/bin/ffprobe"),
    ("reelos-jellyfin-1", "/usr/lib/jellyfin-ffmpeg/ffprobe"),
    ("reelos-bazarr-1", "/usr/bin/ffprobe"),
)

def _load_reelos_hardware():
    import importlib.util

    candidates = []
    try:
        candidates.append(Path(__file__).resolve().parent.parent / "reelos_hardware.py")
        candidates.append(Path(__file__).resolve().parent / "reelos_hardware.py")
    except Exception:
        pass
    candidates.append(Path("/opt/reelos/bin/reelos_hardware.py"))
    for cand in candidates:
        if not cand.is_file():
            continue
        spec = importlib.util.spec_from_file_location("reelos_hardware", cand)
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    return None


def hw():
    global _HW
    if _HW is None:
        _HW = _load_reelos_hardware()
    return _HW


def hardware_profile() -> dict:
    mod = hw()
    if mod is None:
        n = mem_total_kb()
        return {"ram_kb": n, "ram_gb": round(n / 1024 / 1024, 2), "cpus": 1, "disk_kind": "unknown", "tiny": 0 < n <= SMALL_MEM_KB, "box_is_small": 0 < n <= SMALL_MEM_KB}
    if hasattr(mod, "current_profile"):
        return mod.current_profile()
    saved = mod.load_saved() if hasattr(mod, "load_saved") else None
    return saved if saved else mod.measure()


def mem_total_kb(text: str | None = None) -> int:
    mod = hw()
    if mod is not None:
        return int(mod.mem_total_kb(text))
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/meminfo").read_text()
        except OSError:
            return 0
    for line in raw.splitlines():
        if line.startswith("MemTotal:"):
            try:
                return int(line.split()[1])
            except (ValueError, IndexError):
                return 0
    return 0


def loadavg_1(text: str | None = None) -> float:
    raw = text
    if raw is None:
        try:
            raw = Path("/proc/loadavg").read_text()
        except OSError:
            return 0.0
    try:
        return float(raw.split()[0])
    except (ValueError, IndexError):
        return 0.0


def box_is_small(mem_kb: int | None = None) -> bool:
    """Tiny (≤4.5Gi) fixture. Saved hardware profile wins; MemTotal is fallback."""
    if mem_kb is not None:
        return 0 < mem_kb <= SMALL_MEM_KB
    mod = hw()
    if mod is not None:
        if hasattr(mod, "current_profile"):
            return bool(mod.current_profile().get("tiny"))
        saved = mod.load_saved() if hasattr(mod, "load_saved") else None
        if saved:
            return bool(saved.get("tiny"))
        return bool(mod.measure().get("tiny"))
    n = mem_total_kb()
    return 0 < n <= SMALL_MEM_KB


def box_load_high(load1: float | None = None) -> bool:
    n = loadavg_1() if load1 is None else load1
    return n >= 2.0


def performance_low() -> bool:
    if box_is_small():
        return True
    p = STATE / "performance.json"
    if not p.exists():
        try:
            STATE.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({"low": True}) + "\n")
        except OSError:
            return True
        return True
    try:
        return bool(json.loads(p.read_text()).get("low", True))
    except json.JSONDecodeError:
        return True


def has_vaapi_dri(path: str | None = None) -> bool:
    """Host GPU node for VAAPI. Missing/empty /dev/dri ⇒ DirectPlay only (no CPU ffmpeg storm)."""
    dri = Path(path or "/dev/dri")
    if not dri.exists():
        return False
    if dri.is_dir():
        try:
            return any(p.name.startswith(("renderD", "card")) for p in dri.iterdir())
        except OSError:
            return True
    return True


def stub_container_ffprobe() -> None:
    """enableMediaInfo false still leaves Sonarr spawning ffprobe on FUSE dumps."""
    for name, path in FFPROBE_STUB_PATHS:
        r = subprocess.run(
            ["docker", "exec", "-u", "0", name, "sh", "-c", FFPROBE_STUB_SCRIPT, "stub", path],
            capture_output=True,
            text=True,
            check=False,
        )
        out = (r.stdout or r.stderr or "").strip().replace("\n", " ")[:160]
        log_wire(f"no-ffprobe stub {name} rc={r.returncode} {out}")


def ffprobe_is_stubbed() -> bool:
    try:
        r = subprocess.run(
            ["docker", "exec", "reelos-sonarr-1", "head", "-1", "/app/sonarr/bin/ffprobe"],
            capture_output=True,
            text=True,
            check=False,
            timeout=8,
        )
        return (r.stdout or "").lstrip().startswith("#!")
    except (OSError, subprocess.TimeoutExpired):
        return False


def arr_debrid_media_flags() -> dict:
    """Never ffprobe/MediaInfo library files on debrid/FUSE. Cap rescans. Import/grab still use filenames."""
    return {"enableMediaInfo": False, "rescanAfterRefresh": "Never"}


def arr_debrid_media_patch(cfg: dict) -> dict:
    body = dict(cfg or {})
    body.update(arr_debrid_media_flags())
    return body


def persist_arr_debrid_config_files() -> None:
    """Ship + keep compose/configs/*arr/reelos-debrid.json so Apply cannot re-enable ffprobe."""
    text = json.dumps(
        {
            "enableMediaInfo": False,
            "ffprobeLibrary": False,
            "rescanAfterRefresh": "Never",
            "note": "Debrid/FUSE dumps. Import and grab still use filenames. Apply must not turn this back on.",
        },
        indent=2,
    ) + "\n"
    for name, _base in ARR_DEBRID_APPS:
        dest = COMPOSE / "configs" / name / "reelos-debrid.json"
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and dest.read_text() == text:
                continue
            dest.write_text(text)
        except OSError as e:
            log_wire(f"{name} reelos-debrid.json {e}")


def apply_arr_debrid_media_info() -> None:
    persist_arr_debrid_config_files()
    for name, base in ARR_DEBRID_APPS:
        xml = COMPOSE / "configs" / name / "config.xml"
        if not xml.exists():
            log_wire(f"{name} enableMediaInfo skip — no config")
            continue
        key = api_key(xml) or wait_key(xml, 8)
        if not key:
            log_wire(f"{name} enableMediaInfo skip — no key")
            continue
        try:
            cfg = call(f"{base}/config/mediamanagement", key)
        except NET_ERR as e:
            log_wire(f"{name} media-info get {e}")
            continue
        if not isinstance(cfg, dict) or not cfg.get("id"):
            continue
        body = arr_debrid_media_patch(cfg)
        if cfg.get("enableMediaInfo") is False and cfg.get("rescanAfterRefresh") == "Never":
            log_wire(f"{name} enableMediaInfo already off")
            continue
        try:
            call(
                f"{base}/config/mediamanagement/{cfg['id']}",
                key,
                method="PUT",
                body=body,
            )
            log_wire(f"{name} enableMediaInfo off — no ffprobe on FUSE")
        except NET_ERR as e:
            log_wire(f"{name} media-info put {e}")
    stub_container_ffprobe()
    optimize_sqlite_databases()
    optimize_rotational_storage()


def optimize_sqlite_databases() -> None:
    """Tune SQLite databases on slow storage: WAL + synchronous=NORMAL + in-memory temp_store."""
    import os
    import sqlite3

    cfg_dir = COMPOSE / "configs"
    if not cfg_dir.is_dir():
        return
    skip_dirs = {"metadata", "cache", "transcodes", "MediaCover", "logs", ".git"}
    for root, dirnames, filenames in os.walk(cfg_dir):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for f in filenames:
            name = f.lower()
            if (
                name.endswith((".db", ".sqlite", ".sqlite3"))
                and not name.endswith(("-wal", "-shm"))
            ):
                p = Path(root) / f
                try:
                    con = sqlite3.connect(str(p), timeout=5)
                    con.execute("PRAGMA journal_mode = WAL;")
                    con.execute("PRAGMA synchronous = NORMAL;")
                    con.execute("PRAGMA busy_timeout = 5000;")
                    con.execute("PRAGMA temp_store = MEMORY;")
                    con.execute("PRAGMA cache_size = -8000;")
                    con.close()
                    log_wire(f"sqlite tuned: {f}")
                except Exception as e:
                    log_wire(f"sqlite tune {f}: {e}")


def is_debrid_mode() -> bool:
    """True if operating in pure Debrid streaming mode (no local torrent storage)."""
    try:
        a = answers()
        mode = a.get("storageMode") or "both"
        src = a.get("source") or a.get("debrid_provider") or "torbox"
        return mode == "debrid" and src != "local-vpn"
    except Exception:
        return False


def has_active_disk_writes(bname: str | None = None) -> bool:
    """Detect active write activity (torrent downloads / unpacking / high in-flight I/O)."""
    marker = STATE / "downloads-active.json"
    if marker.exists():
        try:
            doc = json.loads(marker.read_text())
            if doc.get("active"):
                return True
        except Exception:
            pass
    try:
        stats = Path("/proc/diskstats")
        if stats.exists():
            for line in stats.read_text().splitlines():
                parts = line.split()
                if len(parts) >= 14:
                    dev = parts[2]
                    if (bname is None and dev.startswith("sd")) or dev == bname:
                        if int(parts[11]) > 0:  # in-flight I/O
                            return True
    except Exception:
        pass
    return False


def query_drive_power_state(dev_name: str) -> str:
    """Non-waking query of ATA drive power state: 'standby', 'active', or 'unknown'."""
    bname = Path(dev_name).name
    try:
        r = subprocess.run(
            ["hdparm", "-C", f"/dev/{bname}"],
            capture_output=True,
            text=True,
            check=False,
            timeout=3,
        )
        out = (r.stdout or "").lower()
        if "standby" in out or "sleeping" in out:
            return "standby"
        if "active" in out or "idle" in out:
            return "active"
    except Exception:
        pass
    return "unknown"


def detect_gpu_type(dri_path: str | Path | None = None) -> str:
    """Detect GPU acceleration type: 'qsv', 'nvenc', 'vaapi', or 'none' (Potato mode)."""
    # 1. NVIDIA check
    if (
        Path("/dev/nvidiactl").exists()
        or Path("/dev/nvidia0").exists()
        or Path("/proc/driver/nvidia").exists()
    ):
        return "nvenc"
    try:
        for p in Path("/sys/bus/pci/devices").glob("*/vendor"):
            v = p.read_text().strip().lower()
            if v in ("0x10de", "10de"):
                return "nvenc"
    except OSError:
        pass

    # 2. Check /dev/dri
    dri = Path(dri_path or "/dev/dri")
    if not has_vaapi_dri(str(dri)):
        return "none"

    # 3. Intel DRM / QuickSync check
    try:
        for card_vendor in Path("/sys/class/drm").glob("card*/device/vendor"):
            v = card_vendor.read_text().strip().lower()
            if v in ("0x8086", "8086"):
                return "qsv"
    except OSError:
        pass

    # Intel CPU check when /dev/dri exists
    try:
        mod = hw()
        model = mod.cpu_model() if mod and hasattr(mod, "cpu_model") else ""
        if not model:
            try:
                for line in Path("/proc/cpuinfo").read_text().splitlines():
                    if "model name" in line.lower():
                        model = line.split(":", 1)[1].strip()
                        break
            except OSError:
                pass
        mlow = model.lower()
        if any(b in mlow for b in ("intel", "pentium", "celeron", "core", "xeon")):
            return "qsv"
    except Exception:
        pass

    # 4. AMD check
    try:
        for card_vendor in Path("/sys/class/drm").glob("card*/device/vendor"):
            v = card_vendor.read_text().strip().lower()
            if v in ("0x1002", "1002"):
                return "vaapi"
    except OSError:
        pass

    return "vaapi"


def optimize_rotational_storage(*, force_spindown: bool | None = None) -> dict:
    """Intelligent Drive Controller: enforce APM 127 + 5-min spindown in pure Debrid mode;
    suspend spindown during active torrent writes in Local download mode.
    """
    prof = hardware_profile()
    if str(prof.get("disk_kind") or "") != "rotational":
        return {"status": "not_rotational", "drives": []}

    debrid_pure = is_debrid_mode()
    results = []
    for dev in sorted(Path("/sys/block").glob("sd*")):
        try:
            if (dev / "queue/rotational").read_text().strip() != "1":
                continue
            bname = dev.name
            dev_path = f"/dev/{bname}"
            active_writes = has_active_disk_writes(bname)

            if force_spindown is True or (debrid_pure and not active_writes):
                # Pure Debrid streaming mode: APM 127 + 5-min spindown
                subprocess.run(
                    ["hdparm", "-B", "127", "-S", "60", dev_path],
                    check=False,
                    capture_output=True,
                )
                log_wire(f"spindown enabled (debrid mode, APM 127) for {dev_path}")
                results.append({"name": bname, "mode": "debrid_spindown", "apm": 127, "timeout_sec": 300})
            elif active_writes:
                # Active torrent writes in local mode: suspend spindown (APM 254, timeout 0)
                subprocess.run(
                    ["hdparm", "-B", "254", "-S", "0", dev_path],
                    check=False,
                    capture_output=True,
                )
                log_wire(f"spindown suspended (active writes, APM 254) for {dev_path}")
                results.append({"name": bname, "mode": "writes_suspended", "apm": 254, "timeout_sec": 0})
            else:
                # Local download mode but idle: allow standard spindown
                subprocess.run(
                    ["hdparm", "-B", "127", "-S", "60", dev_path],
                    check=False,
                    capture_output=True,
                )
                log_wire(f"spindown enabled (local idle, APM 127) for {dev_path}")
                results.append({"name": bname, "mode": "local_idle_spindown", "apm": 127, "timeout_sec": 300})
        except Exception as e:
            log_wire(f"optimize_rotational_storage error {dev.name}: {e}")

    return {"status": "ok", "debrid_mode": debrid_pure, "drives": results}


