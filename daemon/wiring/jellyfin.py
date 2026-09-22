"""Jellyfin initialization, encoding, library management, and version merging."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from .common import (
    COMPOSE,
    NET_ERR,
    ROOT,
    STATE,
    answers,
    call,
    compose,
    compose_env,
    log_wire,
)
from .hardware import (
    box_is_small,
    detect_gpu_type,
    has_vaapi_dri,
    hw,
    performance_low,
)

JF_AUTH_CLIENT = 'MediaBrowser Client="ReelOS", Device="ReelOS", DeviceId="reelos-setup", Version="1.0.0"'

JF_NETWORK_XML = """<?xml version="1.0" encoding="utf-8"?>
<NetworkConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <RequireHttps>false</RequireHttps>
  <CertificatePath />
  <CertificatePassword />
  <BaseUrl />
  <PublicHttpsPort>8920</PublicHttpsPort>
  <HttpServerPortNumber>8096</HttpServerPortNumber>
  <HttpsPortNumber>8920</HttpsPortNumber>
  <EnableHttps>false</EnableHttps>
  <PublicPort>8096</PublicPort>
  <EnableMulticastServerDiscovery>true</EnableMulticastServerDiscovery>
  <EnableRemoteAccess>true</EnableRemoteAccess>
</NetworkConfiguration>
"""

JF_ENCODING_XML = """<?xml version="1.0" encoding="utf-8"?>
<EncodingOptions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EncodingThreadCount>-1</EncodingThreadCount>
  <TranscodingTempPath>/cache/transcodes</TranscodingTempPath>
  <FallbackFontPath />
  <EnableFallbackFont>false</EnableFallbackFont>
  <DownMixAudioBoost>2</DownMixAudioBoost>
  <MaxMuxingQueueSize>2048</MaxMuxingQueueSize>
  <EnableThrottling>false</EnableThrottling>
  <ThrottleDelaySeconds>180</ThrottleDelaySeconds>
  <HardwareAccelerationType>none</HardwareAccelerationType>
  <EncoderPreset>veryfast</EncoderPreset>
  <H264Crf>23</H264Crf>
  <H265Crf>28</H265Crf>
  <EncoderPreset>auto</EncoderPreset>
  <DeinterlaceDoubleRate>false</DeinterlaceDoubleRate>
  <DeinterlaceMethod>yadif</DeinterlaceMethod>
  <EnableDecodingColorDepth10Hevc>true</EnableDecodingColorDepth10Hevc>
  <EnableDecodingColorDepth10Vp9>true</EnableDecodingColorDepth10Vp9>
  <EnableEnhancedNvdecDecoder>true</EnableEnhancedNvdecDecoder>
  <PreferSystemNativeHwDecoder>true</PreferSystemNativeHwDecoder>
  <EnableIntelLowPowerH264HwEncoder>false</EnableIntelLowPowerH264HwEncoder>
  <EnableIntelLowPowerHevcHwEncoder>false</EnableIntelLowPowerHevcHwEncoder>
  <EnableHardwareEncoding>false</EnableHardwareEncoding>
  <AllowHevcEncoding>false</AllowHevcEncoding>
  <AllowAv1Encoding>false</AllowAv1Encoding>
  <EnableSubtitleExtraction>false</EnableSubtitleExtraction>
  <HardwareDecodingCodecs />
</EncodingOptions>
"""

MOVIE_VIDEO_EXT = {".mkv", ".mp4", ".m4v", ".avi", ".m2ts", ".ts", ".iso"}
PARKED_MOVIE_VERSIONS = Path("/mnt/symlinks/.reel-parked")
HYBRID_RECYCLE = Path("/mnt/symlinks/.reel-recycle")

_SEASON_FOLDER = re.compile(
    r"[\s._:-]+(?:(?:season|series)[\s._:-]*\d{1,2}|s\d{1,2})[\s._:-]*$",
    re.I,
)
_YEAR_TAIL = re.compile(r"\s+\((?:19|20)\d{2}\)\s*$")
_CANON_MOVIE = re.compile(r"^(.+?)\s+\((\d{4})\)$")
_CANON_MOVIE_PLUS = re.compile(r"^(.+?)\s+\((\d{4})\)\s+.+$")
_MOVIE_MEDIA_TAIL = re.compile(r"\.(mkv|mp4|m4v|avi|ts|m2ts)$", re.I)
_MOVIE_QUALITY = re.compile(
    r"(?:2160p|1080p|720p|480p|web-?dl|webrip|bluray|bdrip|remux|hdtv|uhd|hdr|dvdrip)",
    re.I,
)
_PART_ONE = re.compile(r"[\s:.\-_]+(?:part|pt)[\s.\-_]*(?:one|1|i)\s*$", re.I)

def mount_extra_disks() -> None:
    try:
        _mount_extra_disks()
    except Exception as exc:
        print(f"wire-engines: extra disks skipped: {exc}", file=sys.stderr)


def _mount_extra_disks() -> None:
    a = answers()
    selected = a.get("selectedDisks") or []
    format_ok = set(a.get("formatDisks") or [])
    os_dev = None
    try:
        os_dev = os.path.realpath("/dev/disk/by-label/cloudimg-rootfs")
    except OSError:
        pass
    for raw in selected:
        name = raw.replace("/dev/", "").strip()
        if not name or name.endswith("n1") and "nvme" in name and Path("/").stat().st_dev:
            pass
        dev = Path("/dev") / name
        if not dev.exists():
            continue
        real = os.path.realpath(dev)
        if os_dev and real == os_dev:
            continue
        # never format the disk that holds /
        try:
            root_src = subprocess.check_output(["findmnt", "-n", "-o", "SOURCE", "/"], text=True).strip()
            if real in root_src or root_src.startswith(real):
                continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        mnt = Path("/srv/media") / name
        mnt.mkdir(parents=True, exist_ok=True)
        try:
            if name in format_ok and not str(name).startswith("sdb"):
                mounted = subprocess.run(["findmnt", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
                has_fs = subprocess.run(["blkid", str(dev)], stdout=subprocess.DEVNULL).returncode == 0
                if not mounted and not has_fs:
                    subprocess.run(["mkfs.ext4", "-F", "-L", f"reelos-{name}", str(dev)], check=False)
            line = f"{dev} {mnt} auto defaults,nofail 0 2"
            fstab = Path("/etc/fstab")
            text = fstab.read_text() if fstab.exists() else ""
            if str(dev) not in text:
                fstab.write_text(text.rstrip() + "\n" + line + "\n")
            r = subprocess.run(["mount", str(mnt)], check=False, capture_output=True, text=True)
            if r.returncode != 0:
                print(f"wire-engines: mount {dev} skipped: {(r.stderr or r.stdout or '').strip()}", file=sys.stderr)
        except Exception as exc:
            print(f"wire-engines: disk {name} skipped: {exc}", file=sys.stderr)


def jellyfin_headers(token: str = "") -> dict:
    """JF 10.10+ VirtualFolders 401s on X-Emby-Token alone — send MediaBrowser Token=."""
    auth = JF_AUTH_CLIENT + (f', Token="{token}"' if token else "")
    hdrs = {
        "Accept": "application/json",
        "Authorization": auth,
        "X-Emby-Authorization": auth,
    }
    if token:
        hdrs["X-Emby-Token"] = token
    return hdrs


def jellyfin_authenticate(user: str, password: str) -> str | None:
    body = json.dumps({"Username": user, "Pw": password}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8096/Users/AuthenticateByName",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            **jellyfin_headers(),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            return data.get("AccessToken")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError, ConnectionError, OSError):
        return None


def reveal_jellyfin_admin(token: str) -> None:
    """JF hides the first admin from /Users/Public (IsHidden=true) → empty login list."""
    try:
        me = call("http://127.0.0.1:8096/Users/Me", headers=jellyfin_headers(token)) or {}
    except NET_ERR:
        return
    uid = me.get("Id")
    policy = me.get("Policy")
    if not uid or not isinstance(policy, dict):
        return
    if policy.get("IsHidden") is False:
        return
    body = dict(policy)
    body["IsHidden"] = False
    try:
        call(
            f"http://127.0.0.1:8096/Users/{uid}/Policy",
            method="POST",
            body=body,
            headers=jellyfin_headers(token),
        )
        log_wire("jellyfin admin visible")
    except NET_ERR as e:
        log_wire(f"jellyfin unhide {e}")


def jellyfin_token() -> str | None:
    cached = STATE / "jellyfin.token"
    if cached.exists():
        t = cached.read_text().strip()
        if t:
            try:
                call("http://127.0.0.1:8096/Users/Me", headers=jellyfin_headers(t))
                reveal_jellyfin_admin(t)
                return t
            except NET_ERR:
                pass
    for _ in range(8):
        tok = jellyfin_token_once()
        if tok:
            try:
                STATE.mkdir(parents=True, exist_ok=True)
                cached.write_text(tok + "\n")
            except OSError:
                pass
            reveal_jellyfin_admin(tok)
            return tok
        time.sleep(3)
    return None


def jellyfin_token_once() -> str | None:
    a = answers()
    user = (a.get("adminName") or "reelos").strip() or "reelos"
    pw = (a.get("adminPassword") or "").strip()
    names: list[str] = []
    for n in (user, "reelos"):
        if n and n not in names:
            names.append(n)
    try:
        public = call("http://127.0.0.1:8096/Users/Public") or []
        for row in public if isinstance(public, list) else []:
            n = str(row.get("Name") or "").strip()
            if n and n not in names:
                names.append(n)
    except NET_ERR:
        pass
    pws: list[str] = []
    for p in (pw, str(a.get("password") or ""), str(a.get("boxPassword") or ""), "reelos", user):
        if p and p not in pws:
            pws.append(p)
    for n in names:
        for p in pws:
            tok = jellyfin_authenticate(n, p)
            if tok:
                log_wire(f"jellyfin auth as {n}")
                return tok
    return None


def jellyfin_debrid_library_flags() -> dict:
    """Never generate scene previews or extract image subs from TorBox dumps."""
    return {
        "EnableTrickplayImageExtraction": False,
        "ExtractTrickplayImagesDuringLibraryScan": False,
        "EnableChapterImageExtraction": False,
        "ExtractChapterImagesDuringLibraryScan": False,
        "SaveTrickplayWithMedia": False,
        "DummyChapterDuration": 0,
        "EnableLUFSScan": False,
        "AllowEmbeddedSubtitles": "AllowText",
    }


def jellyfin_debrid_encoding_patch(enc) -> dict:
    """Do not pre-extract subtitles or mkv keyframes by reading the FUSE file."""
    out = dict(enc or {})
    out["EnableSubtitleExtraction"] = False
    out["AllowOnDemandMetadataBasedKeyframeExtractionForExtensions"] = []
    return out


def jellyfin_encoding_for_box(enc, *, low=True, has_dri=False, gpu_type: str | None = None) -> dict:
    """GPU: QSV/NVENC/VAAPI transcode (low still caps threads). No GPU or Potato: DirectPlay/DirectStream — no CPU ffmpeg."""
    out = jellyfin_debrid_encoding_patch(enc)
    actual_gpu = gpu_type
    if actual_gpu is None:
        if has_dri:
            try:
                actual_gpu = detect_gpu_type()
            except Exception:
                actual_gpu = "vaapi"
        else:
            actual_gpu = "none"

    if actual_gpu in ("qsv", "nvenc", "vaapi"):
        out["HardwareAccelerationType"] = actual_gpu
        out["EnableHardwareEncoding"] = True
        if actual_gpu == "nvenc":
            out["EnableEnhancedNvdecDecoder"] = True
            out["AllowHevcEncoding"] = True
            out["AllowAv1Encoding"] = True
        elif actual_gpu == "qsv":
            out["EnableIntelLowPowerH264HwEncoder"] = True
            out["EnableIntelLowPowerHevcHwEncoder"] = True
            out["AllowHevcEncoding"] = True
            out["AllowAv1Encoding"] = True
            if not out.get("VaapiDevice"):
                out["VaapiDevice"] = "/dev/dri/renderD128"
        elif actual_gpu == "vaapi":
            if not out.get("VaapiDevice"):
                out["VaapiDevice"] = "/dev/dri/renderD128"
            out["EnableIntelLowPowerH264HwEncoder"] = True
            out["EnableIntelLowPowerHevcHwEncoder"] = True
            out["AllowHevcEncoding"] = True
            out["AllowAv1Encoding"] = True
        codecs = [str(c) for c in (out.get("HardwareDecodingCodecs") or []) if c]
        for c in ("h264", "hevc", "vp9", "av1", "vc1", "mpeg2video"):
            if c not in codecs:
                codecs.append(c)
        out["HardwareDecodingCodecs"] = codecs
        out["EnableDecodingColorDepth10Hevc"] = True
        out["EnableDecodingColorDepth10Vp9"] = True
    else:
        out["HardwareAccelerationType"] = "none"
        out["EnableHardwareEncoding"] = False
        out["EnableIntelLowPowerH264HwEncoder"] = False
        out["EnableIntelLowPowerHevcHwEncoder"] = False
        out["AllowHevcEncoding"] = False
        out["AllowAv1Encoding"] = False
        out["HardwareDecodingCodecs"] = []

    if low:
        out["EncodingThreadCount"] = 1
        out["EnableThrottling"] = True
        out["EnableSegmentDeletion"] = True
        out["SegmentKeepSeconds"] = 60
        out["EncoderPreset"] = "veryfast"
    else:
        out["EncodingThreadCount"] = -1
        out["EnableThrottling"] = True
        out["EnableSegmentDeletion"] = True
        out["SegmentKeepSeconds"] = 180
        out["EncoderPreset"] = "auto"
    out["TranscodingTempPath"] = "/cache/transcodes"
    return out


def jellyfin_playback_policy_for_box(policy, *, has_dri=False, gpu_type: str | None = None) -> dict:
    """No GPU or Potato: DirectPlay/DirectStream only. Remux stays; ffmpeg transcode does not."""
    out = dict(policy or {})
    actual_gpu = gpu_type
    if actual_gpu is None:
        if has_dri:
            try:
                actual_gpu = detect_gpu_type()
            except Exception:
                actual_gpu = "vaapi"
        else:
            actual_gpu = "none"
    is_hw = actual_gpu in ("qsv", "nvenc", "vaapi")
    out["EnableVideoPlaybackTranscoding"] = is_hw
    out["EnableAudioPlaybackTranscoding"] = is_hw
    out["EnablePlaybackRemuxing"] = True
    out["ForceRemoteSourceTranscoding"] = False
    return out


def _xml_bool(value) -> str:
    return "true" if value else "false"


def encoding_xml_set(text: str, tag: str, value: str) -> str:
    pat = rf"<{tag}>[^<]*</{tag}>"
    repl = f"<{tag}>{value}</{tag}>"
    if re.search(pat, text, flags=re.I):
        return re.sub(pat, repl, text, count=1, flags=re.I)
    if "</EncodingOptions>" in text:
        return text.replace("</EncodingOptions>", f"  {repl}\n</EncodingOptions>", 1)
    return text


def persist_jellyfin_encoding_xml(enc: dict, dest: Path | None = None) -> Path:
    """Write encoding.xml so DirectPlay/VAAPI survives before JF is up and after a reset."""
    dest = dest or (COMPOSE / "configs" / "jellyfin" / "config" / "encoding.xml")
    dest.parent.mkdir(parents=True, exist_ok=True)
    text = dest.read_text() if dest.exists() else JF_ENCODING_XML
    if "</EncodingOptions>" not in text:
        text = JF_ENCODING_XML
    scalars = {
        "HardwareAccelerationType": str(enc.get("HardwareAccelerationType") or "none"),
        "EnableHardwareEncoding": _xml_bool(enc.get("EnableHardwareEncoding")),
        "EncodingThreadCount": str(enc.get("EncodingThreadCount", 1)),
        "EnableThrottling": _xml_bool(enc.get("EnableThrottling", True)),
        "EnableSegmentDeletion": _xml_bool(enc.get("EnableSegmentDeletion", True)),
        "SegmentKeepSeconds": str(enc.get("SegmentKeepSeconds", 60)),
        "EncoderPreset": str(enc.get("EncoderPreset") or "veryfast"),
        "EnableSubtitleExtraction": _xml_bool(enc.get("EnableSubtitleExtraction")),
        "AllowHevcEncoding": _xml_bool(enc.get("AllowHevcEncoding")),
        "AllowAv1Encoding": _xml_bool(enc.get("AllowAv1Encoding")),
        "EnableIntelLowPowerH264HwEncoder": _xml_bool(enc.get("EnableIntelLowPowerH264HwEncoder")),
        "EnableIntelLowPowerHevcHwEncoder": _xml_bool(enc.get("EnableIntelLowPowerHevcHwEncoder")),
        "EnableDecodingColorDepth10Hevc": _xml_bool(enc.get("EnableDecodingColorDepth10Hevc", True)),
        "EnableDecodingColorDepth10Vp9": _xml_bool(enc.get("EnableDecodingColorDepth10Vp9", True)),
    }
    if enc.get("EnableEnhancedNvdecDecoder") is not None:
        scalars["EnableEnhancedNvdecDecoder"] = _xml_bool(enc.get("EnableEnhancedNvdecDecoder"))
    if enc.get("VaapiDevice"):
        scalars["VaapiDevice"] = str(enc.get("VaapiDevice"))
    for tag, value in scalars.items():
        text = encoding_xml_set(text, tag, value)
    codecs = enc.get("HardwareDecodingCodecs")
    if codecs is not None:
        if codecs:
            inner = "".join(f"\n    <string>{c}</string>" for c in codecs)
            codecs_block = f"<HardwareDecodingCodecs>{inner}\n  </HardwareDecodingCodecs>"
        else:
            codecs_block = "<HardwareDecodingCodecs />"
        codecs_pat = r"<HardwareDecodingCodecs\s*(?:/>|>[\s\S]*?</HardwareDecodingCodecs>)"
        if re.search(codecs_pat, text, flags=re.I):
            text = re.sub(codecs_pat, codecs_block, text, count=1, flags=re.I)
        elif "</EncodingOptions>" in text:
            text = text.replace("</EncodingOptions>", f"  {codecs_block}\n</EncodingOptions>", 1)
    dest.write_text(text)
    return dest


def persist_transcode_state(has_dri: bool, gpu_type: str | None = None) -> None:
    try:
        STATE.mkdir(parents=True, exist_ok=True)
        actual_gpu = gpu_type
        if actual_gpu is None:
            if has_dri:
                try:
                    actual_gpu = detect_gpu_type()
                except Exception:
                    actual_gpu = "vaapi"
            else:
                actual_gpu = "none"
        is_hw = actual_gpu in ("qsv", "nvenc", "vaapi")
        mode = actual_gpu if is_hw else "direct"
        (STATE / "transcode.json").write_text(
            json.dumps(
                {
                    "dri": bool(has_dri),
                    "mode": mode,
                    "gpuType": actual_gpu,
                    "videoTranscoding": is_hw,
                    "audioTranscoding": is_hw,
                    "remux": True,
                }
            )
            + "\n"
        )
    except OSError:
        pass


def seed_jellyfin_encoding_xml() -> None:
    has_dri = has_vaapi_dri()
    gpu = detect_gpu_type() if has_dri else "none"
    persist_jellyfin_encoding_xml(
        jellyfin_encoding_for_box({}, low=performance_low(), has_dri=has_dri, gpu_type=gpu)
    )
    persist_transcode_state(has_dri, gpu_type=gpu)


def _encoding_needs_write(cur, patched) -> bool:
    keys = (
        "HardwareAccelerationType",
        "EnableHardwareEncoding",
        "EncodingThreadCount",
        "EnableThrottling",
        "EnableSegmentDeletion",
        "EnableSubtitleExtraction",
        "EncoderPreset",
        "AllowHevcEncoding",
        "AllowAv1Encoding",
        "HardwareDecodingCodecs",
    )
    cur = cur if isinstance(cur, dict) else {}
    return any(cur.get(k) != patched.get(k) for k in keys)


def apply_jellyfin_playback_policies(token: str, *, has_dri: bool, gpu_type: str | None = None) -> None:
    hdr = jellyfin_headers(token)
    try:
        users = call("http://127.0.0.1:8096/Users", headers=hdr) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance users {e}")
        return
    for user in users if isinstance(users, list) else []:
        uid = user.get("Id")
        policy = user.get("Policy")
        if not uid or not isinstance(policy, dict):
            continue
        patched = jellyfin_playback_policy_for_box(policy, has_dri=has_dri, gpu_type=gpu_type)
        if (
            policy.get("EnableVideoPlaybackTranscoding") == patched["EnableVideoPlaybackTranscoding"]
            and policy.get("EnableAudioPlaybackTranscoding") == patched["EnableAudioPlaybackTranscoding"]
            and policy.get("EnablePlaybackRemuxing") is True
            and policy.get("ForceRemoteSourceTranscoding") is not True
        ):
            continue
        try:
            call(
                f"http://127.0.0.1:8096/Users/{uid}/Policy",
                method="POST",
                body=patched,
                headers=hdr,
            )
            mode_name = gpu_type or ("vaapi" if has_dri else "DirectPlay/DirectStream")
            log_wire(
                f"performance user {user.get('Name') or uid} transcode={mode_name}"
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"performance user {uid} {e}")


def transcode_override(*, compose_up=True) -> None:
    """Redefines 06.part. Hardware mem_limit + optional /dev/dri. Never clobber RAM profile."""
    mod = None
    try:
        mod = hw()
    except Exception:
        mod = None
    dri = has_vaapi_dri()
    if mod is not None:
        try:
            mod.apply_runtime_files(has_dri=dri, compose_dir=COMPOSE)
        except Exception as e:
            log_wire(f"hardware compose override {e}")
    else:
        override = COMPOSE / "compose.override.yml"
        if not dri:
            if override.exists():
                try:
                    override.unlink()
                except OSError:
                    pass
            if not compose_up:
                return
        else:
            override.write_text(
                "services:\n"
                "  jellyfin:\n"
                "    devices:\n"
                "      - /dev/dri:/dev/dri\n"
                "  plex:\n"
                "    devices:\n"
                "      - /dev/dri:/dev/dri\n"
            )
    if not compose_up:
        return
    subprocess.run(
        ["docker", "compose", "up", "-d"],
        cwd=str(COMPOSE),
        env=compose_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def apply_jellyfin_performance(token: str | None = None) -> None:
    low = performance_low()
    has_dri = has_vaapi_dri()
    gpu = detect_gpu_type() if has_dri else "none"
    persist_jellyfin_encoding_xml(jellyfin_encoding_for_box({}, low=low, has_dri=has_dri, gpu_type=gpu))
    persist_transcode_state(has_dri, gpu_type=gpu)
    try:
        transcode_override(compose_up=False)
    except Exception as e:
        log_wire(f"performance transcode override {e}")
    token = token or jellyfin_token()
    if not token:
        log_wire(f"performance: jellyfin auth failed — encoding.xml persisted {gpu if has_dri else 'DirectPlay'}")
        return
    flags = jellyfin_debrid_library_flags()
    hdr = jellyfin_headers(token)
    try:
        folders = call("http://127.0.0.1:8096/Library/VirtualFolders", headers=hdr) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance folders {e}")
        folders = []
    for folder in folders if isinstance(folders, list) else []:
        fid = folder.get("ItemId") or folder.get("Guid") or folder.get("Id")
        if not fid:
            continue
        opts = dict(folder.get("LibraryOptions") or {})
        opts.update(flags)
        try:
            call(
                "http://127.0.0.1:8096/Library/VirtualFolders/LibraryOptions",
                method="POST",
                body={"Id": fid, "LibraryOptions": opts},
                headers=hdr,
            )
            log_wire(f"performance library {folder.get('Name')} low={low} debrid-safe")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"performance library {folder.get('Name')} {e}")
    try:
        enc = call("http://127.0.0.1:8096/System/Configuration/encoding", headers=hdr) or {}
        patched = jellyfin_encoding_for_box(
            enc if isinstance(enc, dict) else {},
            low=low,
            has_dri=has_dri,
            gpu_type=gpu,
        )
        persist_jellyfin_encoding_xml(patched)
        if _encoding_needs_write(enc if isinstance(enc, dict) else {}, patched):
            call(
                "http://127.0.0.1:8096/System/Configuration/encoding",
                method="POST",
                body=patched,
                headers=hdr,
            )
        log_wire(
            f"performance encoding low={low} dri={has_dri} "
            f"mode={gpu if has_dri else 'DirectPlay/DirectStream'} "
            f"accel={patched.get('HardwareAccelerationType')} threads={patched.get('EncodingThreadCount')}"
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance encoding {e}")
    apply_jellyfin_playback_policies(token, has_dri=has_dri, gpu_type=gpu)
    try:
        tasks = call("http://127.0.0.1:8096/ScheduledTasks", headers=hdr) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
        log_wire(f"performance tasks {e}")
        tasks = []
    cap_scans = box_is_small() or low
    for task in tasks if isinstance(tasks, list) else []:
        if not (
            jellyfin_task_hammers_debrid(task)
            or (cap_scans and jellyfin_task_library_scan(task))
        ):
            continue
        tid = task.get("Id")
        name = str(task.get("Name") or "")
        if not tid:
            continue
        try:
            call(
                f"http://127.0.0.1:8096/ScheduledTasks/{tid}/Triggers",
                method="POST",
                body=[],
                headers=hdr,
            )
            log_wire(f"performance disabled task {name}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError) as e:
            log_wire(f"performance task {name} {e}")


def jellyfin_task_library_scan(task: dict) -> bool:
    """Periodic library walks on FUSE starve a 4GB box. Import still refreshes on demand."""
    key = str(task.get("Key") or "")
    if key in {"RefreshLibrary", "RefreshMediaLibrary"}:
        return True
    name = str(task.get("Name") or "").lower()
    return "scan media library" in name or name == "refresh media library"


def jellyfin_task_hammers_debrid(task: dict) -> bool:
    key = str(task.get("Key") or "")
    if key in {
        "RefreshTrickplayImages",
        "RefreshChapterImages",
        "KeyframeExtraction",
        "TaskExtractMediaSegments",
    }:
        return True
    name = str(task.get("Name") or "").lower()
    return any(
        s in name
        for s in ("trickplay", "chapter image", "keyframe", "media segment")
    )


def jellyfin_folders(token: str):
    try:
        folders = call("http://127.0.0.1:8096/Library/VirtualFolders", headers=jellyfin_headers(token)) or []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, urllib.error.HTTPError):
        return []
    return folders if isinstance(folders, list) else []


def library_symlink_path(name: str) -> str:
    return {"Movies": "/symlinks/radarr", "Shows": "/symlinks/sonarr", "Music": "/symlinks/music"}.get(
        name, "/symlinks"
    )


def folder_has_symlinks(folder: dict, path: str | None = None) -> bool:
    want = (path or "/symlinks").rstrip("/")
    return want in jellyfin_folder_paths(folder)


def jellyfin_folder_paths(folder: dict) -> list[str]:
    """Every media path Jellyfin is scanning for this virtual folder."""
    locs = [str(x).rstrip("/") for x in (folder.get("Locations") or []) if x]
    opts = folder.get("LibraryOptions") or {}
    paths = [str(p.get("Path") or "").rstrip("/") for p in (opts.get("PathInfos") or []) if isinstance(p, dict)]
    out: list[str] = []
    seen: set[str] = set()
    for p in locs + paths:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def library_local_path(name: str) -> str:
    return {"Movies": "/media/movies", "Shows": "/media/tv", "Music": "/media/music"}.get(name, "")


def jellyfin_keep_paths(name: str, a: dict | None = None) -> list[str]:
    """The dump path, plus /media when the wizard asked to keep files on disk.

    A `local`/`both` house has /media/movies as a real *arr root, so dropping it
    would empty the library. Debrid-only houses never write there.
    """
    keep = [library_symlink_path(name)]
    mode = (a or answers()).get("storageMode") or "both"
    local = library_local_path(name)
    if local and mode in ("local", "both"):
        keep.append(local)
    return keep


def extra_jellyfin_paths(folder: dict, keep) -> list[str]:
    """House dupes: the /symlinks parent and the /mnt/symlinks bind of the same dumps."""
    wanted = [keep] if isinstance(keep, str) else list(keep or [])
    keep_n = {str(k).rstrip("/") for k in wanted if k}
    return [p for p in jellyfin_folder_paths(folder) if p not in keep_n]


def strip_season_folder_suffix(name: str) -> str:
    """B99 S01 / TWD - Season 1 / B99 (2013) Season 1 S01 (1080p…) → the series name."""
    raw = str(name or "").strip()
    stripped = _SEASON_FOLDER.sub("", raw).strip()
    if not stripped or stripped == raw:
        return raw
    bare = _YEAR_TAIL.sub("", stripped).strip()
    return bare or stripped


def looks_like_season_folder_title(name: str) -> bool:
    raw = str(name or "").strip()
    return bool(raw) and strip_season_folder_suffix(raw) != raw


def is_canonical_movie_folder(name: str) -> bool:
    """Radarr title folder: Interstellar (2014). Not Interstellar (2014) [YTS.MX]."""
    return bool(_CANON_MOVIE.fullmatch(str(name or "").strip()))


def movie_title_year(name: str) -> tuple[str, str] | None:
    """Title + year from a Radarr dump name. Remakes keep the year (Dune 1984 ≠ 2021)."""
    raw = _MOVIE_MEDIA_TAIL.sub("", str(name or "").strip()).strip()
    if not raw:
        return None
    m = _CANON_MOVIE.fullmatch(raw) or _CANON_MOVIE_PLUS.match(raw)
    if m:
        title = m.group(1).strip()
        year = m.group(2)
        if title:
            return title, year
    pick = None
    for hit in re.finditer(r"((?:19|20)\d{2})", raw):
        rest = raw[hit.end() :]
        if _MOVIE_QUALITY.search(rest):
            pick = hit
            break
    if not pick:
        return None
    title = raw[: pick.start()].strip(" ._-\t()[]")
    title = re.sub(r"[._]+", " ", title)
    title = re.sub(r"\s+", " ", title).strip(" -")
    if len(re.sub(r"[^a-z0-9]", "", title.lower())) < 4:
        return None
    return title, pick.group(1)


def movie_stem(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(title or "").lower())


def movie_dump_keys(name: str) -> list[str]:
    """Primary Title:Year plus Part One/Part 1 alias. Never Part Two (Dune 2021 ≠ Part Two)."""
    parsed = movie_title_year(name)
    if not parsed:
        return []
    title, year = parsed
    keys: list[str] = []
    seen: set[str] = set()
    for t in (title, _PART_ONE.sub("", title).strip(" :-._")):
        stem = movie_stem(t)
        if len(stem) < 4:
            continue
        key = f"{stem}:{year}"
        if key not in seen:
            seen.add(key)
            keys.append(key)
    return keys


def movie_dump_key(name: str) -> str | None:
    keys = movie_dump_keys(name)
    return keys[0] if keys else None


def looks_like_movie_dump_folder(name: str) -> bool:
    raw = str(name or "").strip()
    if is_canonical_movie_folder(raw):
        return False
    return movie_dump_key(raw) is not None


def movie_dump_item_path(path: str) -> bool:
    """DELETE /Items removes files — only a release-named dir under radarr dumps."""
    p = str(path or "").rstrip("/")
    if not p or local_disk_path(p) or not dump_view_path(p):
        return False
    parts = [x for x in p.split("/") if x]
    if parts[:2] == ["symlinks", "radarr"] and len(parts) == 3:
        return looks_like_movie_dump_folder(parts[-1])
    if parts[:3] == ["mnt", "symlinks", "radarr"] and len(parts) == 4:
        return looks_like_movie_dump_folder(parts[-1])
    return False


def plan_movie_dump_item(item: dict, siblings: list) -> dict | None:
    """jf-only release-folder Movie: delete when Title (Year) already exists."""
    if not isinstance(item, dict):
        return None
    path = str(item.get("Path") or "")
    if not movie_dump_item_path(path):
        return None
    folder = path.rstrip("/").split("/")[-1]
    keys = set(movie_dump_keys(folder))
    if not keys:
        return None
    item_id = item.get("Id") or item.get("id")
    if not item_id:
        return None
    own = jellyfin_provider_id(item)
    canons: list[dict] = []
    for sib in siblings or []:
        if sib is item or not isinstance(sib, dict):
            continue
        sp = str(sib.get("Path") or "").rstrip("/")
        sfolder = sp.split("/")[-1] if sp else ""
        if not is_canonical_movie_folder(sfolder):
            continue
        if not keys.intersection(movie_dump_keys(sfolder)):
            continue
        canons.append(sib)
    if not canons:
        return None
    if own:
        for canon in canons:
            if jellyfin_provider_id(canon) == own:
                return {"action": "delete", "id": str(item_id), "name": folder}
        return None
    return {"action": "delete", "id": str(item_id), "name": folder}


def jellyfin_provider_id(item: dict) -> str:
    pids = item.get("ProviderIds") or {}
    if not isinstance(pids, dict):
        return ""
    tvdb = pids.get("Tvdb") or pids.get("tvdb")
    tmdb = pids.get("Tmdb") or pids.get("tmdb")
    if tvdb:
        return f"tvdb-{tvdb}"
    if tmdb:
        return f"tmdb-{tmdb}"
    return ""


def series_title_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", strip_season_folder_suffix(name).lower())


def season_folder_item_path(path: str) -> bool:
    """Jellyfin's DELETE /Items removes the files too, so only a season-named directory
    inside our own dump root may be handed to it. `/media` is the house's disk library
    and a dump root itself is every show at once — both are refused.
    """
    p = str(path or "").rstrip("/")
    if not p or local_disk_path(p) or not dump_view_path(p):
        return False
    parts = [x for x in p.split("/") if x]
    depth = 3 if parts[0] == "symlinks" else 4
    if len(parts) < depth:
        return False
    return looks_like_season_folder_title(parts[-1])


def plan_season_folder_item(item: dict, siblings: list) -> dict | None:
    """jf-only season-folder Series: delete when a real series exists, else rename.

    Two series that both carry different tvdb/tmdb ids stay (anime split seasons).
    Season-folder PremiereDate ≠ series start year is ignored here — names + ids decide.
    Only a season-named dump directory is ever touched; see `season_folder_item_path`.
    """
    if not isinstance(item, dict):
        return None
    name = str(item.get("Name") or "")
    path = str(item.get("Path") or "")
    folder = path.rstrip("/").split("/")[-1] if path else ""
    # JF often names a dump "The Expanse" after metadata while Path is still the S01 pack.
    season_label = name if looks_like_season_folder_title(name) else folder
    if not looks_like_season_folder_title(season_label):
        return None
    if not season_folder_item_path(path):
        return None
    item_id = item.get("Id") or item.get("id")
    if not item_id:
        return None
    key = series_title_key(season_label)
    if not key:
        return None
    own = jellyfin_provider_id(item)
    canons: list[dict] = []
    for sib in siblings or []:
        if sib is item or not isinstance(sib, dict):
            continue
        sib_name = str(sib.get("Name") or "")
        sib_path = str(sib.get("Path") or "")
        sib_folder = sib_path.rstrip("/").split("/")[-1] if sib_path else ""
        if series_title_key(sib_name) != key and series_title_key(sib_folder) != key:
            continue
        if looks_like_season_folder_title(sib_name) or looks_like_season_folder_title(sib_folder):
            continue
        canons.append(sib)
    series_name = strip_season_folder_suffix(season_label)
    series_name = re.sub(r"[._]+", " ", series_name)
    series_name = re.sub(r"\s+", " ", series_name).strip() or series_name
    if own:
        for canon in canons:
            if jellyfin_provider_id(canon) == own:
                return {"action": "delete", "id": str(item_id), "name": name, "as": series_name}
        return None
    if canons:
        return {"action": "delete", "id": str(item_id), "name": name, "as": series_name}
    return {"action": "rename", "id": str(item_id), "name": name, "as": series_name}


def extra_jellyfin_libraries(folders: list, want: list[tuple[str, str]]) -> list[dict]:
    """Second Movies/Shows virtual folders leftover after path cleanup. Keep canonical names."""
    canonical = {str(name) for name, _ctype in want}
    want_types = {str(ctype).lower() for _name, ctype in want}
    extras: list[dict] = []
    for folder in folders or []:
        if not isinstance(folder, dict):
            continue
        name = str(folder.get("Name") or "")
        if name in canonical:
            continue
        ctype = str(folder.get("CollectionType") or folder.get("collectionType") or "").lower()
        if ctype and ctype in want_types:
            extras.append(folder)
    return extras


def dump_view_path(path: str) -> bool:
    """/symlinks and its /mnt bind are two views of the same *arr dumps, never real files."""
    p = str(path or "").rstrip("/")
    return p in ("/symlinks", "/mnt/symlinks") or p.startswith(("/symlinks/", "/mnt/symlinks/"))


def local_disk_path(path: str) -> bool:
    p = str(path or "").rstrip("/")
    return p == "/media" or p.startswith("/media/")


def folder_collection_type(folder: dict) -> str:
    return str(folder.get("CollectionType") or folder.get("collectionType") or "").lower()


def plan_extra_library_drop(
    extra: dict,
    canon_name: str | None,
    canon_folder: dict | None,
    a: dict | None = None,
) -> dict:
    """Decide whether a leftover virtual folder is safe to delete, and what to migrate first.

    Deleting a library un-lists everything it scans. A `local`/`both` house has real
    files under /media, so any path we can neither hand to the canonical library nor
    recognise as a dump view blocks the delete — that is the #60 class of bug. Paths
    the canonical library already scans are skipped: re-POSTing one makes Jellyfin
    scan the same dump twice and puts the duplicate rows straight back.
    """
    if not canon_name or not isinstance(canon_folder, dict):
        return {"drop": False, "migrate": [], "blocked": ["no canonical library yet"]}
    have = set(jellyfin_folder_paths(canon_folder))
    keep = {str(p).rstrip("/") for p in jellyfin_keep_paths(canon_name, a) if p}
    on_disk = ((a or answers()).get("storageMode") or "both") in ("local", "both")
    migrate: list[str] = []
    blocked: list[str] = []
    for path in jellyfin_folder_paths(extra):
        if path in have or dump_view_path(path):
            continue
        if path in keep:
            migrate.append(path)
        elif local_disk_path(path) and not on_disk:
            continue
        else:
            blocked.append(path)
    if blocked:
        return {"drop": False, "migrate": [], "blocked": blocked}
    return {"drop": True, "migrate": migrate, "blocked": []}


def planned_extra_library_drops(folders: list, want: list[tuple[str, str]], a: dict | None = None) -> list[tuple]:
    by_name = {str(f.get("Name") or ""): f for f in folders or [] if isinstance(f, dict)}
    type_to_name = {str(ctype).lower(): name for name, ctype in want}
    out = []
    for extra in extra_jellyfin_libraries(folders, want):
        canon = type_to_name.get(folder_collection_type(extra))
        plan = plan_extra_library_drop(extra, canon, by_name.get(canon) if canon else None, a)
        out.append((extra, canon, plan))
    return out


def seed_jellyfin_network_xml() -> None:
    """LAN/remote clients must not see docker 172.18.x as LocalAddress."""
    dest = COMPOSE / "configs" / "jellyfin" / "config" / "network.xml"
    dest.parent.mkdir(parents=True, exist_ok=True)
    text = dest.read_text() if dest.exists() else ""
    if re.search(r"<EnablePublishedServerUriByRequest>\s*true\s*<", text, re.I):
        return
    if "<EnablePublishedServerUriByRequest>" in text:
        dest.write_text(
            re.sub(
                r"<EnablePublishedServerUriByRequest>[^<]*</EnablePublishedServerUriByRequest>",
                "<EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>",
                text,
            )
        )
        return
    if "</NetworkConfiguration>" in text:
        dest.write_text(
            text.replace(
                "</NetworkConfiguration>",
                "  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>\n</NetworkConfiguration>",
            )
        )
        return
    dest.write_text(JF_NETWORK_XML)


def seed_jellyfin_legacy_auth() -> bool:
    """JF 12 defaults EnableLegacyAuthorization=false. Jellyseerr 2.7 still sends X-Emby-Authorization; AuthenticateByName is 400 and wizard Finish cannot login Seerr."""
    dest = COMPOSE / "configs" / "jellyfin" / "config" / "system.xml"
    if not dest.exists():
        return False
    text = dest.read_text()
    if re.search(r"<EnableLegacyAuthorization>\s*true\s*<", text, re.I):
        return False
    if "<EnableLegacyAuthorization>" in text:
        dest.write_text(
            re.sub(
                r"<EnableLegacyAuthorization>[^<]*</EnableLegacyAuthorization>",
                "<EnableLegacyAuthorization>true</EnableLegacyAuthorization>",
                text,
            )
        )
        log_wire("jellyfin EnableLegacyAuthorization so Seerr can login")
        return True
    if "</ServerConfiguration>" in text:
        dest.write_text(
            text.replace(
                "</ServerConfiguration>",
                "  <EnableLegacyAuthorization>true</EnableLegacyAuthorization>\n</ServerConfiguration>",
            )
        )
        return True
    return False


def apply_jellyfin_published_uri(token: str) -> None:
    hdr = jellyfin_headers(token)
    try:
        cfg = call("http://127.0.0.1:8096/System/Configuration/network", headers=hdr) or {}
    except NET_ERR:
        cfg = {}
    if not isinstance(cfg, dict):
        cfg = {}
    if cfg.get("EnablePublishedServerUriByRequest") is True and cfg.get("EnableRemoteAccess") is not False:
        return
    cfg["EnablePublishedServerUriByRequest"] = True
    cfg["EnableRemoteAccess"] = True
    try:
        call(
            "http://127.0.0.1:8096/System/Configuration/network",
            method="POST",
            body=cfg,
            headers=hdr,
        )
        log_wire("jellyfin published URI by request")
    except NET_ERR as e:
        log_wire(f"jellyfin network {e}")


def jellyfin_want_libraries(a: dict | None = None) -> list[tuple[str, str]]:
    intent = (a or answers()).get("intent") or {}
    want: list[tuple[str, str]] = []
    if intent.get("movies", True):
        want.append(("Movies", "movies"))
    if intent.get("tv", True) or intent.get("anime"):
        want.append(("Shows", "tvshows"))
    if intent.get("music"):
        want.append(("Music", "music"))
    return want


def jellyfin_startup_post(path: str, body: dict | None = None, tries: int = 20) -> None:
    """JF 12 Startup/* 404/503s until first-run routes are up. One 404 must not skip Complete."""
    url = "http://127.0.0.1:8096" + path
    last: BaseException | None = None
    for _ in range(tries):
        try:
            call(url, method="POST", body={} if body is None else body)
            return
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (404, 503):
                time.sleep(2)
                continue
            raise
        except NET_ERR as e:
            last = e
            time.sleep(2)
    if last:
        raise last


def complete_jellyfin_startup(user: str, password: str) -> None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8096/System/Info/Public", timeout=5) as resp:
            info = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return
    if info.get("StartupWizardCompleted"):
        return
    ready = False
    for _ in range(20):
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:8096/Startup/User",
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    ready = True
                    break
        except urllib.error.HTTPError as e:
            if e.code not in (404, 503):
                break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError, OSError):
            pass
        time.sleep(2)
    if not ready:
        log_wire("jellyfin startup endpoints not ready")
        return
    try:
        jellyfin_startup_post(
            "/Startup/Configuration",
            {
                "UICulture": "en-US",
                "MetadataCountryCode": "US",
                "PreferredMetadataLanguage": "en",
            },
        )
        jellyfin_startup_post(
            "/Startup/RemoteAccess",
            {"EnableRemoteAccess": True, "EnableAutomaticPortMapping": False},
        )
        jellyfin_startup_post("/Startup/User", {"Name": user, "Password": password})
        jellyfin_startup_post("/Startup/Complete", {})
        log_wire("jellyfin startup complete")
        time.sleep(3)
    except NET_ERR as e:
        log_wire(f"jellyfin startup {e}")


def ensure_host_symlinks() -> None:
    for host in ("/mnt/symlinks", "/mnt/symlinks/radarr", "/mnt/symlinks/sonarr", "/mnt/symlinks/music"):
        Path(host).mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(host, 0o777)
        except OSError:
            pass
    for name in ("reelos-jellyfin-1", "jellyfin"):
        r = subprocess.run(
            ["docker", "exec", name, "mkdir", "-p", "/symlinks/radarr", "/symlinks/sonarr", "/symlinks/music"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if r.returncode == 0:
            break


def create_jellyfin_library(token: str, name: str, ctype: str) -> None:
    path = library_symlink_path(name)
    q = urllib.parse.urlencode(
        {
            "name": name,
            "collectionType": ctype,
            "refreshLibrary": "true",
            "paths": path,
        }
    )
    body = {
        "LibraryOptions": {
            "EnableRealtimeMonitor": True,
            **jellyfin_debrid_library_flags(),
            "PathInfos": [{"Path": path}],
        }
    }
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders?{q}",
        method="POST",
        body=body,
        headers=jellyfin_headers(token),
    )


def add_jellyfin_path(token: str, name: str, path: str | None = None) -> None:
    path = path or library_symlink_path(name)
    q = urllib.parse.urlencode({"refreshLibrary": "true"})
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders/Paths?{q}",
        method="POST",
        body={"Name": name, "Path": path, "PathInfo": {"Path": path}},
        headers=jellyfin_headers(token),
    )


def remove_jellyfin_path(token: str, name: str, path: str) -> None:
    q = urllib.parse.urlencode({"name": name, "path": path, "refreshLibrary": "true"})
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders/Paths?{q}",
        method="DELETE",
        headers=jellyfin_headers(token),
    )


def delete_jellyfin_library(token: str, name: str) -> None:
    q = urllib.parse.urlencode({"name": name, "refreshLibrary": "true"})
    call(
        f"http://127.0.0.1:8096/Library/VirtualFolders?{q}",
        method="DELETE",
        headers=jellyfin_headers(token),
    )


def dump_dir_has_media(path: Path) -> bool:
    try:
        for x in path.rglob("*"):
            if x.is_file() or x.is_symlink():
                return True
    except OSError:
        return False
    return False


def dest_media_names(dest: Path) -> set[str]:
    names: set[str] = set()
    try:
        for x in dest.rglob("*"):
            if x.is_file() or x.is_symlink():
                names.add(x.name)
    except OSError:
        pass
    return names


def move_dump_media(src: Path, dest: Path) -> None:
    """Park dump files onto the title folder without clobbering existing names."""
    dest.mkdir(parents=True, exist_ok=True)
    have = dest_media_names(dest)
    try:
        kids = list(src.iterdir())
    except OSError:
        return
    for child in kids:
        if (child.is_file() or child.is_symlink()) and child.name in have:
            continue
        target = dest / child.name
        if target.exists():
            continue
        try:
            shutil.move(str(child), str(target))
        except OSError:
            continue


def collapse_season_named_dumps(root: str = "/mnt/symlinks/sonarr", allow=None) -> int:
    """Remove leftover season-folder dumps when the series folder already exists.

    House Home still double-counted Brooklyn Nine-Nine S01 and The Walking Dead - Season 1
    next to the real series. An empty series stub + full Season 1 dump is the leftover
    case: move media onto the series folder, then drop the season-named dir. Never touch
    /media (local/both disk libraries). `allow` is the test seam: the shipped allowlist
    must not be widenable from the environment.
    """
    base = Path(root)
    resolved = str(base).rstrip("/\\")
    allowed = {"/mnt/symlinks/sonarr", "/symlinks/sonarr"}
    allowed |= {str(p).rstrip("/\\") for p in (allow or ()) if p}
    if resolved not in allowed:
        return 0
    norm = resolved.replace("\\", "/")
    if "/media/" in norm or norm == "/media" or norm.endswith("/media"):
        return 0
    if not base.is_dir():
        return 0
    try:
        kids = [p for p in base.iterdir() if p.is_dir()]
    except OSError:
        return 0
    by_name = {p.name: p for p in kids}
    dropped = 0
    for p in kids:
        series = strip_season_folder_suffix(p.name)
        if not series or series == p.name:
            continue
        candidates = [series]
        spaced = re.sub(r"[._]+", " ", series)
        spaced = re.sub(r"\s+", " ", spaced).strip()
        if spaced and spaced not in candidates:
            candidates.append(spaced)
        yearless = _YEAR_TAIL.sub("", spaced or series).strip()
        if yearless and yearless not in candidates:
            candidates.append(yearless)
        canon = next((by_name[c] for c in candidates if c in by_name and c != p.name), None)
        if canon is None:
            continue
        try:
            if dump_dir_has_media(p):
                move_dump_media(p, canon)
            shutil.rmtree(p)
            dropped += 1
            log_wire(f"jellyfin drop season-folder dump {p.name}")
        except OSError as e:
            log_wire(f"jellyfin season-folder dump {p.name} {e}")
    return dropped


def collapse_movie_named_dumps(root: str = "/mnt/symlinks/radarr", allow=None) -> int:
    """Park release-named movie dumps into Title (Year) when that folder exists.

    House Jellyfin Movies showed Interstellar×3 because Decypharr left
    `Interstellar.2014.2160p…` next to `Interstellar (2014)`. Never touch /media.
    `allow` is the test seam — not widenable from the environment.
    """
    base = Path(root)
    resolved = str(base).rstrip("/\\")
    allowed = {"/mnt/symlinks/radarr", "/symlinks/radarr"}
    allowed |= {str(p).rstrip("/\\") for p in (allow or ()) if p}
    if resolved not in allowed:
        return 0
    norm = resolved.replace("\\", "/")
    if "/media/" in norm or norm == "/media" or norm.endswith("/media"):
        return 0
    if not base.is_dir():
        return 0
    try:
        kids = [p for p in base.iterdir() if p.is_dir()]
    except OSError:
        return 0
    canons: dict[str, Path] = {}
    for p in kids:
        if not is_canonical_movie_folder(p.name):
            continue
        key = movie_dump_key(p.name)
        if key and key not in canons:
            canons[key] = p
    dropped = 0
    for p in kids:
        if is_canonical_movie_folder(p.name):
            continue
        canon = None
        for key in movie_dump_keys(p.name):
            canon = canons.get(key)
            if canon is not None:
                break
        if canon is None:
            continue
        try:
            if dump_dir_has_media(p):
                move_dump_media(p, canon)
            shutil.rmtree(p)
            dropped += 1
            log_wire(f"jellyfin drop movie dump {p.name}")
        except OSError as e:
            log_wire(f"jellyfin movie dump {p.name} {e}")
    return dropped


def movie_video_files(folder: Path) -> list:
    out = []
    try:
        for x in folder.iterdir():
            if x.name.startswith("."):
                continue
            if x.suffix.lower() in MOVIE_VIDEO_EXT and (x.is_file() or x.is_symlink()):
                out.append(x)
    except OSError:
        return []
    return out


def pick_keeper_movie_file(files: list) -> Path:
    """Largest file wins. Same size: a [TGx] duplicate is the extra."""

    def key(p: Path):
        try:
            size = p.stat().st_size
        except OSError:
            size = 0
        dirty = 1 if re.search(r"\[(?:tgx)\]", p.name, re.I) else 0
        return (-size, dirty, p.name)

    return sorted(files, key=key)[0]


def radarr_dump_root(root: str, allow=None) -> Path | None:
    """Allowlisted *arr movie dumps only. Never /media."""
    base = Path(root)
    resolved = str(base).rstrip("/\\")
    allowed = {"/mnt/symlinks/radarr", "/symlinks/radarr"}
    allowed |= {str(p).rstrip("/\\") for p in (allow or ()) if p}
    if resolved not in allowed:
        return None
    norm = resolved.replace("\\", "/")
    if "/media/" in norm or norm == "/media" or norm.endswith("/media"):
        return None
    if not base.is_dir():
        return None
    return base


def movie_version_label(name: str) -> str:
    """Jellyfin version tag. Hybrid keeps 1080p and 4K as two labels, not two posters."""
    n = str(name or "").lower()
    if re.search(r"2160|\buhd\b|\b4k\b", n):
        if "remux" in n:
            return "2160p remux"
        return "2160p"
    if "1080" in n:
        return "1080p"
    if "720" in n:
        return "720p"
    return "other"


def movie_files_same_resolution(a: Path, b: Path) -> bool:
    """Two 4K encodes are extras (keep the largest). 1080p next to 4K is hybrid."""
    ra = movie_version_label(a.name).split()[0]
    rb = movie_version_label(b.name).split()[0]
    if not ra or ra != rb or ra == "other":
        return False
    return True


def movie_files_are_clones(a: Path, b: Path) -> bool:
    """Same encode twice (John Wick + [TGx] copy). 1080p next to 4K is not a clone."""
    if not movie_files_same_resolution(a, b):
        return False
    try:
        sa, sb = a.stat().st_size, b.stat().st_size
    except OSError:
        return False
    if sa <= 0 or sb <= 0:
        return False
    if sa == sb:
        return True
    return False


def park_extra_movie_files(root: str = "/mnt/symlinks/radarr", allow=None) -> int:
    """One file per resolution. Extra 4Ks park; 1080p + 4K stay.

    Never /media. Never delete. Real extras go to /mnt/symlinks/.reel-parked.
    """
    base = radarr_dump_root(root, allow)
    if base is None:
        return 0
    parked_root = PARKED_MOVIE_VERSIONS
    if allow:
        parked_root = base.parent / ".reel-parked"
    try:
        kids = [p for p in base.iterdir() if p.is_dir() and is_canonical_movie_folder(p.name)]
    except OSError:
        return 0
    n = 0
    for folder in kids:
        files = movie_video_files(folder)
        if len(files) < 2:
            continue
        keeper = pick_keeper_movie_file(files)
        dest = parked_root / folder.name
        for extra in files:
            if extra == keeper or not movie_files_same_resolution(keeper, extra):
                continue
            try:
                dest.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                log_wire(f"jellyfin park movie versions {folder.name} {e}")
                break
            target = dest / extra.name
            if target.exists():
                target = dest / f"{extra.stem}.dup{extra.suffix}"
            try:
                shutil.move(str(extra), str(target))
                n += 1
                log_wire(f"jellyfin park extra movie file {folder.name}/{extra.name}")
            except OSError as e:
                log_wire(f"jellyfin park extra movie file {folder.name} {e}")
    return n


def hybrid_recycle_root(root: str, allow=None) -> Path | None:
    """Allowlisted Radarr recycle only. Never /media."""
    base = Path(root)
    resolved = str(base).rstrip("/\\")
    allowed = {"/mnt/symlinks/.reel-recycle", "/symlinks/.reel-recycle"}
    allowed |= {str(p).rstrip("/\\") for p in (allow or ()) if p}
    if resolved not in allowed:
        return None
    norm = resolved.replace("\\", "/")
    if "/media/" in norm or norm == "/media" or norm.endswith("/media"):
        return None
    if not base.is_dir():
        return None
    return base


def folder_version_labels(folder: Path) -> set[str]:
    return {movie_version_label(p.name).split()[0] for p in movie_video_files(folder)}


def restore_hybrid_movie_versions(
    root: str = "/mnt/symlinks/radarr",
    recycle: str = "/mnt/symlinks/.reel-recycle",
    allow=None,
) -> int:
    """Put recycled 1080 back next to the 4K Radarr kept. Hybrid only. Never /media.

    Radarr has one movieFile — upgrade moves the old file into recycle. This walks
    `.reel-recycle` and returns a complementary resolution into Title (Year).
    Same-resolution extras stay parked; we do not restore a second 4K.
    """
    if (answers().get("quality") or "hybrid") != "hybrid":
        return 0
    base = radarr_dump_root(root, allow)
    rec = hybrid_recycle_root(recycle, allow)
    if base is None or rec is None:
        return 0
    try:
        kids = [p for p in base.iterdir() if p.is_dir() and is_canonical_movie_folder(p.name)]
    except OSError:
        return 0
    canons: dict[str, Path] = {}
    for p in kids:
        for key in movie_dump_keys(p.name):
            canons.setdefault(key, p)
    try:
        files = [x for x in rec.rglob("*") if x.is_file() and x.suffix.lower() in MOVIE_VIDEO_EXT]
    except OSError:
        return 0
    n = 0
    for src in files:
        keys = movie_dump_keys(src.name) or movie_dump_keys(src.parent.name)
        dest_folder = None
        for key in keys:
            dest_folder = canons.get(key)
            if dest_folder is not None:
                break
        if dest_folder is None:
            continue
        res = movie_version_label(src.name).split()[0]
        if res == "other" or res in folder_version_labels(dest_folder):
            continue
        dest = dest_folder / src.name
        i = 2
        while dest.exists():
            dest = dest_folder / f"{src.stem}-{i}{src.suffix}"
            i += 1
        try:
            shutil.move(str(src), str(dest))
            n += 1
            log_wire(f"hybrid restore recycled version {dest_folder.name}/{dest.name}")
        except OSError as e:
            log_wire(f"hybrid restore recycled version {src.name} {e}")
    return n


def label_jellyfin_movie_versions(root: str = "/mnt/symlinks/radarr", allow=None) -> int:
    """Rename dump files to Jellyfin's native version names so a scan is one poster.

    Interstellar (2014)/Interstellar (2014) - 1080p.mkv
    Interstellar (2014)/Interstellar (2014) - 2160p.mkv
    Prefix must match the folder. Hyphen label is required. Never /media.
    """
    base = radarr_dump_root(root, allow)
    if base is None:
        return 0
    try:
        kids = [p for p in base.iterdir() if p.is_dir() and is_canonical_movie_folder(p.name)]
    except OSError:
        return 0
    n = 0
    for folder in kids:
        files = movie_video_files(folder)
        used = {p.name for p in files}
        for src in files:
            if src.name.startswith(folder.name + " - "):
                continue
            label = movie_version_label(src.name)
            cand = label
            i = 2
            dest_name = f"{folder.name} - {cand}{src.suffix}"
            while dest_name in used or (folder / dest_name).exists():
                cand = f"{label} {i}"
                dest_name = f"{folder.name} - {cand}{src.suffix}"
                i += 1
            dest = folder / dest_name
            if dest == src:
                continue
            try:
                src.rename(dest)
                used.discard(src.name)
                used.add(dest.name)
                n += 1
                log_wire(f"jellyfin label movie version {folder.name}/{dest.name}")
            except OSError as e:
                log_wire(f"jellyfin label movie version {folder.name} {e}")
    return n


def fetch_jellyfin_series(token: str) -> list:
    q = urllib.parse.urlencode(
        {
            "Recursive": "true",
            "IncludeItemTypes": "Series",
            "Fields": "ProviderIds,Path",
            "EnableImages": "false",
            "EnableUserData": "false",
            "EnableTotalRecordCount": "false",
        }
    )
    try:
        data = call(f"http://127.0.0.1:8096/Items?{q}", headers=jellyfin_headers(token)) or {}
    except NET_ERR:
        return []
    items = data.get("Items") if isinstance(data, dict) else data
    return items if isinstance(items, list) else []


def heal_season_folder_items(token: str, items=None, call_fn=None) -> int:
    """Delete or rename leftover season-folder Series items Jellyfin already ingested.

    Scoped to season-named dump directories: DELETE /Items takes the files with it, so a
    `/media` local-disk library or a canonical series folder is never handed to Jellyfin.
    """
    rows = items if items is not None else fetch_jellyfin_series(token)
    do = call_fn or call
    n = 0
    for item in rows:
        plan = plan_season_folder_item(item, rows)
        if not plan:
            continue
        try:
            if plan["action"] == "delete":
                do(
                    f"http://127.0.0.1:8096/Items/{plan['id']}",
                    method="DELETE",
                    headers=jellyfin_headers(token),
                )
                log_wire(f"jellyfin drop season-folder item {plan['name']}")
            else:
                body = dict(item)
                body["Name"] = plan["as"]
                do(
                    f"http://127.0.0.1:8096/Items/{plan['id']}",
                    method="POST",
                    body=body,
                    headers=jellyfin_headers(token),
                )
                log_wire(f"jellyfin rename season-folder item {plan['name']} -> {plan['as']}")
            n += 1
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"jellyfin season-folder item {plan['name']} {e.code} {err}")
        except NET_ERR as e:
            log_wire(f"jellyfin season-folder item {plan['name']} {e}")
    return n


def fetch_jellyfin_movies(token: str) -> list:
    q = urllib.parse.urlencode(
        {
            "Recursive": "true",
            "IncludeItemTypes": "Movie",
            "Fields": "ProviderIds,Path",
            "EnableImages": "false",
            "EnableUserData": "false",
            "EnableTotalRecordCount": "false",
        }
    )
    try:
        data = call(f"http://127.0.0.1:8096/Items?{q}", headers=jellyfin_headers(token)) or {}
    except NET_ERR:
        return []
    items = data.get("Items") if isinstance(data, dict) else data
    return items if isinstance(items, list) else []


def heal_movie_dump_items(token: str, items=None, call_fn=None) -> int:
    """Delete leftover release-folder Movie items Jellyfin already ingested.

    Scoped to dump directories under radarr: DELETE /Items takes the files with it,
    so `/media` and `Title (Year)` are never handed to Jellyfin.
    """
    rows = items if items is not None else fetch_jellyfin_movies(token)
    do = call_fn or call
    n = 0
    for item in rows:
        plan = plan_movie_dump_item(item, rows)
        if not plan:
            continue
        try:
            do(
                f"http://127.0.0.1:8096/Items/{plan['id']}",
                method="DELETE",
                headers=jellyfin_headers(token),
            )
            log_wire(f"jellyfin drop movie dump item {plan['name']}")
            n += 1
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"jellyfin movie dump item {plan['name']} {e.code} {err}")
        except NET_ERR as e:
            log_wire(f"jellyfin movie dump item {plan['name']} {e}")
    return n


def movie_version_parent(path: str) -> str:
    """Folder that holds a Movie file. Empty if this is not a radarr dump Title (Year)."""
    p = str(path or "").rstrip("/")
    if not p or local_disk_path(p) or not dump_view_path(p):
        return ""
    parent = p.rsplit("/", 1)[0] if "/" in p else ""
    if not parent or local_disk_path(parent) or not dump_view_path(parent):
        return ""
    parts = [x for x in parent.split("/") if x]
    if parts[:2] == ["symlinks", "radarr"] and len(parts) == 3 and is_canonical_movie_folder(parts[-1]):
        return parent
    if parts[:3] == ["mnt", "symlinks", "radarr"] and len(parts) == 4 and is_canonical_movie_folder(parts[-1]):
        return parent
    return ""


def movie_dump_merge_key(item: dict) -> str:
    """Group leftover JF Movie rows that are the same title, never /media.

    Prefer TMDB so a YTS dump folder and the Title (Year) folder become one poster.
    Same-folder files without ids still merge. Remakes keep the year.
    """
    path = str(item.get("Path") or "")
    if not path or local_disk_path(path) or not dump_view_path(path):
        return ""
    pids = item.get("ProviderIds") or {}
    if not isinstance(pids, dict):
        pids = {}
    tmdb = str(pids.get("Tmdb") or pids.get("tmdb") or "").strip()
    if tmdb:
        return "tmdb:" + tmdb
    parent = movie_version_parent(path)
    if parent:
        return "dir:" + parent
    name = str(item.get("Name") or "").strip().lower()
    try:
        year = int(item.get("ProductionYear") or 0)
    except (TypeError, ValueError):
        year = 0
    if name and year:
        return f"title:{name}|{year}"
    return ""


def movie_version_merge_groups(items: list) -> list[list[dict]]:
    """Two+ dump Movie rows for the same title are versions, not posters."""
    groups: dict[str, list[dict]] = {}
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if not (item.get("Id") or item.get("id")):
            continue
        key = movie_dump_merge_key(item)
        if not key:
            continue
        groups.setdefault(key, []).append(item)
    return [rows for rows in groups.values() if len(rows) >= 2]


def heal_merge_movie_versions(token: str, items=None, call_fn=None) -> int:
    """POST /Videos/MergeVersions so Jellyfin Movies is one poster per Title (Year) folder.

    Collapse parks YTS+REMUX into the Radarr folder; JF still makes one Movie per file.
    Never /media. DELETE is not used — merge keeps every file as a version.
    """
    rows = items if items is not None else fetch_jellyfin_movies(token)
    do = call_fn or call
    n = 0
    for group in movie_version_merge_groups(rows):
        ids = ",".join(str(x.get("Id") or x.get("id")) for x in group)
        name = str(group[0].get("Name") or group[0].get("Path") or "")
        try:
            do(
                f"http://127.0.0.1:8096/Videos/MergeVersions?{urllib.parse.urlencode({'Ids': ids})}",
                method="POST",
                headers=jellyfin_headers(token),
            )
            log_wire(f"jellyfin merge movie versions {name} x{len(group)}")
            n += 1
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"jellyfin merge movie versions {name} {e.code} {err}")
        except NET_ERR as e:
            log_wire(f"jellyfin merge movie versions {name} {e}")
    return n


def jf_merge_wait_sec() -> float:
    try:
        return max(0.0, float(os.environ.get("REELOS_JF_MERGE_WAIT_SEC", "5")))
    except ValueError:
        return 5.0


def heal_merge_movie_posters() -> bool:
    """Timer path: drop dump Movie rows and MergeVersions. Never Library/Refresh.

    A scan after merge splits one poster back into two. lock-clients re-runs this
    every minute so Jellyfin Movies stays one Interstellar even after a rescan.
    """
    token = jellyfin_token()
    if not token:
        log_wire("jellyfin merge movie posters — no token")
        return True
    try:
        restored = int(restore_hybrid_movie_versions() or 0)
        parked = int(park_extra_movie_files() or 0)
        labeled = int(label_jellyfin_movie_versions() or 0)
        if restored:
            log_wire(f"hybrid restore recycled versions {restored}")
        if parked:
            log_wire(f"jellyfin park extra movie files {parked}")
        if labeled:
            log_wire(f"jellyfin label movie versions {labeled}")
        items = fetch_jellyfin_movies(token)
        heal_movie_dump_items(token, items=items)
        if restored or parked or labeled:
            try:
                call(
                    "http://127.0.0.1:8096/Library/Refresh",
                    method="POST",
                    headers=jellyfin_headers(token),
                )
                log_wire("jellyfin refresh after parking extra movie files")
            except NET_ERR as e:
                log_wire(f"jellyfin refresh {e}")
            time.sleep(jf_merge_wait_sec())
        items = fetch_jellyfin_movies(token)
        heal_merge_movie_versions(token, items=items)
    except Exception as e:
        log_wire(f"jellyfin merge movie posters {e}")
        return False
    return True


def drop_extra_jellyfin_libraries(token: str, folders: list, want: list[tuple[str, str]]) -> int:
    """Delete leftover Movies/Shows virtual folders once every path they hold is safe to lose."""
    n = 0
    for extra, canon, plan in planned_extra_library_drops(folders, want):
        name = str(extra.get("Name") or "")
        if not plan["drop"]:
            log_wire(f"jellyfin keep extra library {name} ({', '.join(plan['blocked'])})")
            continue
        try:
            for path in plan["migrate"]:
                add_jellyfin_path(token, canon, path)
                log_wire(f"jellyfin keep path {canon} {path}")
            delete_jellyfin_library(token, name)
            log_wire(f"jellyfin drop extra library {name}")
            n += 1
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:240] if e.fp else str(e)
            log_wire(f"jellyfin drop extra library {name} {e.code} {err}")
        except NET_ERR as e:
            log_wire(f"jellyfin drop extra library {name} {e}")
    return n


def libraries_ready(folders: list, want: list[tuple[str, str]]) -> bool:
    by_name = {str(f.get("Name") or ""): f for f in folders}
    for name, _ctype in want:
        folder = by_name.get(name)
        if not folder or not folder_has_symlinks(folder, library_symlink_path(name)):
            return False
        if extra_jellyfin_paths(folder, jellyfin_keep_paths(name)):
            return False
    # Only a library the heal is actually willing to delete keeps the house un-ready;
    # one we deliberately keep must not spin the retry loop for 60s every Apply.
    if any(plan["drop"] for _extra, _canon, plan in planned_extra_library_drops(folders, want)):
        return False
    return True


def wait_jellyfin(seconds: int = 90, *, wizard_completed: bool | None = None) -> dict | None:
    deadline = time.time() + seconds
    last = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8096/System/Info/Public", timeout=3) as resp:
                last = json.loads(resp.read().decode())
            if wizard_completed is None:
                return last
            if bool(last.get("StartupWizardCompleted")) == wizard_completed:
                return last
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError, OSError):
            time.sleep(2)
            continue
        time.sleep(1)
    return last


def heal_hybrid_1080_companions() -> None:
    """Existing 4K-only titles: grab a 1080 if indexers have one. Hybrid only.

    Radarr MoviesSearch will not search below cutoff. Interactive /release grab will.
    """
    if (answers().get("quality") or "hybrid") != "hybrid":
        return
    sweep = ROOT / "bin" / "stuck-downloads.py"
    if not sweep.is_file():
        here = globals().get("__file__")
        if here:
            sweep = Path(here).resolve().parent.parent / "stuck-downloads.py"
            if not sweep.is_file():
                sweep = Path(here).resolve().with_name("stuck-downloads.py")
    if not sweep.is_file():
        return
    try:
        # Up to cap=3 movies, each doing a ~90s interactive indexer search, so
        # the sweep needs more than 90s or it is killed mid-search before any
        # 1080 is grabbed.
        subprocess.run(
            [sys.executable, str(sweep), "--hybrid-1080"],
            check=False,
            timeout=300,
        )
        log_wire("hybrid 1080 companion grab")
    except Exception as e:
        log_wire(f"hybrid 1080 {e}")


def ensure_jellyfin_libraries(token: str, want: list[tuple[str, str]], *, collapse_dumps: bool = True) -> bool:
    dropped = collapse_season_named_dumps() if collapse_dumps else 0
    dropped += collapse_movie_named_dumps() if collapse_dumps else 0
    dropped += restore_hybrid_movie_versions() if collapse_dumps else 0
    dropped += park_extra_movie_files() if collapse_dumps else 0
    dropped += label_jellyfin_movie_versions() if collapse_dumps else 0
    healed = (heal_season_folder_items(token) if collapse_dumps else 0) + (
        heal_movie_dump_items(token) if collapse_dumps else 0
    )
    deadline = time.time() + 60
    while time.time() < deadline:
        folders = jellyfin_folders(token)
        if libraries_ready(folders, want):
            if dropped or healed:
                try:
                    call(
                        "http://127.0.0.1:8096/Library/Refresh",
                        method="POST",
                        headers=jellyfin_headers(token),
                    )
                    log_wire("jellyfin refresh after season-folder dump collapse")
                except NET_ERR as e:
                    log_wire(f"jellyfin refresh {e}")
                time.sleep(jf_merge_wait_sec())
            if collapse_dumps:
                try:
                    heal_merge_movie_versions(token)
                except Exception as e:
                    log_wire(f"jellyfin merge movie versions {e}")
            return True
        drop_extra_jellyfin_libraries(token, folders, want)
        by_name = {str(f.get("Name") or ""): f for f in folders}
        for name, ctype in want:
            folder = by_name.get(name)
            keep = library_symlink_path(name)
            try:
                if folder is None:
                    create_jellyfin_library(token, name, ctype)
                    log_wire(f"jellyfin library {name}")
                else:
                    if not folder_has_symlinks(folder, keep):
                        add_jellyfin_path(token, name)
                        log_wire(f"jellyfin path {name} {keep}")
                    for extra in extra_jellyfin_paths(folder, jellyfin_keep_paths(name)):
                        remove_jellyfin_path(token, name, extra)
                        log_wire(f"jellyfin drop extra path {name} {extra}")
            except urllib.error.HTTPError as e:
                err = e.read().decode()[:240] if e.fp else str(e)
                log_wire(f"jellyfin library {name} {e.code} {err}")
            except NET_ERR as e:
                log_wire(f"jellyfin library {name} {e}")
        time.sleep(3)
    if collapse_dumps:
        try:
            heal_merge_movie_versions(token)
        except Exception as e:
            log_wire(f"jellyfin merge movie versions {e}")
    return libraries_ready(jellyfin_folders(token), want)


def reset_jellyfin_config() -> None:
    cfg = COMPOSE / "configs" / "jellyfin"
    log_wire("jellyfin config reset (keep images/volumes)")
    compose("stop", "jellyfin")
    if cfg.exists():
        for child in list(cfg.iterdir()):
            try:
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            except OSError as e:
                log_wire(f"jellyfin reset skip {child.name} {e}")
    seed_jellyfin_network_xml()
    seed_jellyfin_encoding_xml()
    compose("up", "-d", "jellyfin")


def bootstrap_jellyfin() -> None:
    seed_jellyfin_encoding_xml()
    seed_jellyfin_network_xml()
    if seed_jellyfin_legacy_auth():
        compose("up", "-d", "jellyfin")
        subprocess.run(["docker", "restart", "reelos-jellyfin-1"], check=False, capture_output=True)
        wait_jellyfin(90)
    info = wait_jellyfin(90)
    if not info:
        log_wire("jellyfin not up")
        return
    a = answers()
    user = (a.get("adminName") or "reelos").strip() or "reelos"
    password = (a.get("adminPassword") or "reelos").strip() or "reelos"
    for path in ("/mnt/symlinks", "/srv/media/movies", "/srv/media/tv"):
        Path(path).mkdir(parents=True, exist_ok=True)
    ensure_host_symlinks()
    if not info.get("StartupWizardCompleted"):
        complete_jellyfin_startup(user, password)
    want = jellyfin_want_libraries(a)
    token = jellyfin_token()
    if not token:
        if os.environ.get("REELOS_OTA"):
            log_wire("jellyfin auth mismatch — not resetting during OTA")
            return
        log_wire("jellyfin auth mismatch — resetting jellyfin config")
        reset_jellyfin_config()
        info = wait_jellyfin(90, wizard_completed=False) or wait_jellyfin(30)
        if not info:
            log_wire("jellyfin not up after reset")
            return
        complete_jellyfin_startup(user, password)
        token = jellyfin_token()
    if not token:
        log_wire("jellyfin auth failed")
        return
    apply_jellyfin_published_uri(token)
    ready = ensure_jellyfin_libraries(token, want)
    if not ready:
        log_wire("jellyfin libraries missing after retry")
    else:
        log_wire("jellyfin libraries ready")
    apply_jellyfin_performance(token)
    try:
        call(
            "http://127.0.0.1:8096/Library/Refresh",
            method="POST",
            headers=jellyfin_headers(token),
        )
        log_wire("jellyfin refresh")
    except NET_ERR as e:
        log_wire(f"jellyfin refresh {e}")
