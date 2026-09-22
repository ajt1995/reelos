#!/usr/bin/env python3
"""Write /var/lib/reelos/apply-progress.json for the Apply splash.

Percent is only real bytes (download/extract). No time-based fake climb.
Also refreshes updating.html so the parked :80 page can meta-refresh.
Never /media. Never ota.lock.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
import time
from pathlib import Path

STAGES = (
    ("download", 1, "Downloading update"),
    ("extract", 2, "Extracting"),
    ("probe", 3, "Probing this computer"),
    ("cleaner", 4, "Cleaning leftover builds"),
    ("health", 5, "Checking health"),
    ("door", 6, "Restarting the door"),
    ("images", 7, "Pulling images"),
)
STAGE_COUNT = len(STAGES)
STAGE_MAP = {sid: (idx, label) for sid, idx, label in STAGES}
DOWNLOAD_STALL_S = 120


def state_dir() -> Path:
    return Path(os.environ.get("REELOS_STATE", "/var/lib/reelos"))


def progress_path(state: Path | None = None) -> Path:
    return (state or state_dir()) / "apply-progress.json"


def html_path(state: Path | None = None) -> Path:
    return (state or state_dir()) / "updating.html"


def splash_tune_from_profile(path: Path | None = None) -> str:
    p = path or (state_dir() / "hardware-profile.json")
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return ""
    tiny = bool(doc.get("tiny"))
    kind = str(doc.get("disk_kind") or "")
    if tiny and kind == "rotational":
        return "Tuning for 4GB RAM · spinning disk"
    if tiny:
        return "Tuning for 4GB RAM…"
    if kind == "rotational":
        return "Tuning for spinning disk…"
    return ""


def byte_percent(got: int, total: int) -> int | None:
    if total <= 0 or got < 0:
        return None
    pct = int(round(100.0 * got / total))
    return max(0, min(100, pct))


def format_bytes(n: int) -> str:
    v = max(0, int(n or 0))
    if v < 1024:
        return f"{v} B"
    if v < 1024 * 1024:
        return f"{v // 1024} KB"
    if v < 1024 * 1024 * 1024:
        return f"{v / (1024 * 1024):.1f} MB"
    return f"{v / (1024 * 1024 * 1024):.2f} GB"


def format_ago(heartbeat_ms: int, now_ms: int) -> str:
    if not heartbeat_ms:
        return ""
    sec = max(0, int((now_ms - heartbeat_ms) / 1000))
    if sec < 1:
        return "just now"
    if sec < 60:
        return f"{sec}s ago"
    return f"{sec // 60}m ago"


def message_for(doc: dict, *, now_ms: int | None = None) -> str:
    now = int(now_ms if now_ms is not None else time.time() * 1000)
    label = str(doc.get("label") or "Updating ReelOS")
    detail = str(doc.get("detail") or "")
    got = int(doc.get("bytesGot") or 0)
    total = int(doc.get("bytesTotal") or 0)
    idx = int(doc.get("stageIndex") or 0)
    count = int(doc.get("stageCount") or STAGE_COUNT)
    hb = int(doc.get("heartbeatAt") or 0)
    stage_started = int(doc.get("stageStartedAt") or 0)
    ago = format_ago(hb, now)
    stalled = (
        str(doc.get("stage") or "") == "download"
        and got <= 0
        and stage_started > 0
        and (now - stage_started) >= DOWNLOAD_STALL_S * 1000
    )
    if stalled:
        return "Download stalled — 0 bytes for 2+ minutes"
    pct = byte_percent(got, total)
    if pct is not None:
        return f"{label} · {pct}%"
    if got > 0:
        return f"{label} · {format_bytes(got)}" + (f" · {ago}" if ago else "")
    head = detail or label
    return f"{head} · {idx}/{count}" + (f" · {ago}" if ago else "")


def render_updating_html(doc: dict, *, tune: str = "") -> str:
    msg = html.escape(str(doc.get("message") or "Updating ReelOS"))
    tune_l = html.escape(tune) if tune else ""
    pct = doc.get("percent")
    bar = ""
    if isinstance(pct, int):
        bar = (
            f'<div style="margin:18px auto 0;max-width:16rem;height:6px;'
            f'border-radius:99px;background:#2a2418">'
            f'<div style="height:6px;width:{pct}%;border-radius:99px;background:#d4a017"></div>'
            f"</div>"
        )
    tune_p = f'<p style="margin-top:10px;color:#d4a017">{tune_l}</p>' if tune_l else ""
    return (
        "<!doctype html><html lang=en><meta charset=utf-8>"
        '<meta http-equiv="refresh" content="2">'
        "<meta name=viewport content=\"width=device-width,initial-scale=1\">"
        "<title>Updating ReelOS</title>"
        "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;"
        "justify-content:center;background:#120e08;color:#f3ead8;"
        "font-family:ui-sans-serif,system-ui,sans-serif;text-align:center\">"
        "<div style=\"padding:2rem\">"
        "<p style=\"letter-spacing:.34em;text-transform:uppercase;color:#d4a017;"
        "font-size:14px\">Updating ReelOS…</p>"
        f"<p style=\"margin-top:1.1rem;font-size:16px;line-height:1.45\">{msg}</p>"
        f"{bar}{tune_p}"
        "<p style=\"margin-top:1.2rem;color:#8a8070;font-size:13px\">"
        "Browse and request come back when this page lifts.</p>"
        "</div></body></html>\n"
    )


def load_existing(path: Path) -> dict:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        return doc if isinstance(doc, dict) else {}
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def write_progress(
    *,
    stage: str,
    bytes_got: int = 0,
    bytes_total: int = 0,
    detail: str = "",
    status: str = "running",
    state: Path | None = None,
    now_ms: int | None = None,
    tune: str | None = None,
) -> dict:
    root = state or state_dir()
    root.mkdir(parents=True, exist_ok=True)
    path = progress_path(root)
    prev = load_existing(path)
    now = int(now_ms if now_ms is not None else time.time() * 1000)
    sid = str(stage or "").strip() or "download"
    if sid == "done":
        idx, label = STAGE_COUNT, "Done"
        status = "done"
    else:
        idx, label = STAGE_MAP.get(sid, (int(prev.get("stageIndex") or 1), sid))
    started = int(prev.get("startedAt") or now)
    same_stage = str(prev.get("stage") or "") == sid and status != "done"
    stage_started = int(prev.get("stageStartedAt") or now) if same_stage else now
    got = max(0, int(bytes_got or 0))
    total = max(0, int(bytes_total or 0))
    pct = 100 if status == "done" else byte_percent(got, total)
    doc = {
        "status": status,
        "stage": "done" if status == "done" else sid,
        "stageIndex": idx,
        "stageCount": STAGE_COUNT,
        "label": label,
        "detail": str(detail or ""),
        "bytesGot": got,
        "bytesTotal": total,
        "percent": pct,
        "percentKind": "bytes" if pct is not None else None,
        "heartbeatAt": now,
        "startedAt": started,
        "stageStartedAt": stage_started,
    }
    doc["message"] = "Done" if status == "done" else message_for(doc, now_ms=now)
    path.write_text(json.dumps(doc) + "\n", encoding="utf-8")
    tune_s = splash_tune_from_profile() if tune is None else str(tune)
    html_path(root).write_text(render_updating_html(doc, tune=tune_s), encoding="utf-8")
    return doc


def _self_test() -> int:
    t0 = 1_700_000_000_000
    d = write_progress(
        stage="download",
        bytes_got=40,
        bytes_total=100,
        state=Path("/tmp/reelos-progress-self"),
        now_ms=t0,
        tune="Tuning for 4GB RAM · spinning disk",
    )
    assert d["percent"] == 40
    assert "40%" in d["message"]
    msg = message_for(
        {
            "stage": "download",
            "bytesGot": 0,
            "bytesTotal": 0,
            "stageStartedAt": t0,
            "heartbeatAt": t0,
            "label": "Downloading update",
            "stageIndex": 1,
            "stageCount": 7,
        },
        now_ms=t0 + 121_000,
    )
    assert "stalled" in msg.lower()
    d3 = write_progress(
        stage="health",
        detail="Checking health",
        state=Path("/tmp/reelos-progress-self"),
        now_ms=t0 + 5_000,
        tune="",
    )
    assert d3["percent"] is None
    assert "5/7" in d3["message"]
    assert byte_percent(50, 100) == 50
    assert byte_percent(0, 0) is None
    print("reelos_apply_progress self-test ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if "--self-test" in args:
        return _self_test()
    p = argparse.ArgumentParser()
    p.add_argument("--stage", required=True)
    p.add_argument("--bytes-got", type=int, default=0)
    p.add_argument("--bytes-total", type=int, default=0)
    p.add_argument("--detail", default="")
    p.add_argument("--status", default="running")
    p.add_argument("--state", default="")
    ns = p.parse_args(args)
    state = Path(ns.state) if ns.state else None
    doc = write_progress(
        stage=ns.stage,
        bytes_got=ns.bytes_got,
        bytes_total=ns.bytes_total,
        detail=ns.detail,
        status=ns.status,
        state=state,
    )
    print(json.dumps(doc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
