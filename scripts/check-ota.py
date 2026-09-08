#!/usr/bin/env python3
"""Catch VERSION skew and stale OTA canaries before they brick an apply.

  check-ota.py ROOT           # push-time: skew + missing files + grep must match
  check-ota.py ROOT --apply   # box: skew + missing files fatal; grep miss is warn
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


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
        print(f"VERSION skew VERSION={ver} channel={chan} shipped={s} latest={l}", file=sys.stderr)
        return 1
    updater = (root / "daemon/reelos-update.sh").read_text()
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
        print(f"check-ota fail fatal={fatal} warn={warns}", file=sys.stderr)
        return 1
    print(f"check-ota ok version={ver} warn={warns}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
