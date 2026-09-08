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
    ("daemon/wire-engines.py", "door caddy/reelos started after fuse"),
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
    store = (root / "src/lib/store.ts").read_text()
    shipped = re.search(r'SHIPPED_VERSION = "([^"]+)"', store)
    latest = re.search(r'LATEST_VERSION = "([^"]+)"', store)
    s = shipped.group(1) if shipped else ""
    l = latest.group(1) if latest else ""
    if ver != chan or ver != s or ver != l:
        return fail(f"VERSION skew VERSION={ver} channel={chan} shipped={s} latest={l}")

    updater = (root / "daemon/reelos-update.sh").read_text()
    for rel, needle in CONTRACTS:
        text = (root / rel).read_text() if (root / rel).is_file() else ""
        if needle not in text:
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
        if pat and pat not in f.read_text():
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
