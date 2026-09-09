#!/usr/bin/env python3
"""Push-time gate. If this fails, do not push and do not tell the house to Apply.

Never print 'applied' unless :80 is ReelOS. Never start a second Apply.
Never leave Caddy dead after FUSE/engine restarts.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Always fatal, even on the box (--apply). These are the UX lies we already shipped.
CONTRACTS = (
    ("daemon/reelos-update.sh", "apply already running"),
    ("daemon/reelos-update.sh", "ensure_door"),
    ("daemon/reelos-update.sh", "not printing applied"),
    ("daemon/reelos-update.sh", "door :80 is ReelOS"),
    ("scripts/reelos-lookup-plugin.mjs", "Update already running"),
    ("daemon/reelos-update.sh", "hop FUSE"),
    ("daemon/reelos-update.sh", "hop Jellyfin"),
    ("daemon/reelos-update.sh", "hop search"),
)


def fail(msg: str) -> int:
    print(msg, file=sys.stderr)
    return 1


def main() -> int:
    apply = "--apply" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--apply"]
    root = Path(args[0] if args else ".").resolve()
    ver = (root / "VERSION").read_text().strip()
    chan = __import__("json").loads((root / "channel.json").read_text()).get("version")
    stamp_path = root / "src/lib/version-stamp.ts"
    store_path = root / "src/lib/store.ts"
    text = stamp_path.read_text() if stamp_path.is_file() else store_path.read_text()
    shipped = re.search(r'SHIPPED_VERSION = "([^"]+)"', text)
    latest = re.search(r'LATEST_VERSION = "([^"]+)"', text)
    s = shipped.group(1) if shipped else ""
    l = latest.group(1) if latest else ""
    if ver != chan or ver != s or ver != l:
        return fail(f"VERSION skew VERSION={ver} channel={chan} shipped={s} latest={l}")

    updater = (root / "daemon/reelos-update.sh").read_text()
    for rel, needle in CONTRACTS:
        textc = (root / rel).read_text() if (root / rel).is_file() else ""
        if needle not in textc:
            return fail(f"OTA contract missing {rel} ~ {needle}")

    stamp = updater.find('echo "$REMOTE" >"$ROOT/VERSION"')
    applied = updater.find('log "ReelOS $REMOTE applied."')
    door = updater.find("if ! ensure_door")
    if door < 0 or stamp < 0 or applied < 0:
        return fail("OTA contract: ensure_door / VERSION stamp / applied. missing")
    if not (door < stamp < applied):
        return fail("OTA contract: stamp/applied must come after ensure_door")

    fatal = 0
    warns = 0
    for line in updater.splitlines():
        if not line.startswith("need ") or line.startswith("need()"):
            continue
        rest = line[5:].strip()
        path, _, pat = rest.partition(" ")
        pat = pat.strip().strip("'")
        f = root / path
        if not f.is_file():
            print(f"canary missing {path}", file=sys.stderr)
            fatal += 1
            continue
        textc = f.read_text()
        if path.endswith("wire-engines.py"):
            parts_dir = f.parent / "wire-engines.parts"
            if parts_dir.is_dir():
                textc += "".join(p.read_text() for p in sorted(parts_dir.glob("*.part")))
        if pat and pat not in textc:
            print(f"canary grep miss {path} ~ {pat}", file=sys.stderr)
            if apply:
                warns += 1
            else:
                fatal += 1
    if fatal:
        return fail(f"check-ota fail fatal={fatal} warn={warns}")
    print(f"check-ota ok version={ver} warn={warns} contracts={len(CONTRACTS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
