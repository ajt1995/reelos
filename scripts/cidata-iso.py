#!/usr/bin/env python3
"""Build a cloud-init nocloud ISO labeled CIDATA."""
from __future__ import annotations

import sys
from pathlib import Path

import pycdlib


def iso_name(name: str) -> str:
    stem, _, ext = name.partition(".")
    stem = stem.replace("-", "_").upper()[:8]
    ext = ext.replace("-", "_").replace(".", "")[:3].upper() or "BIN"
    return f"/{stem}.{ext};1"


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: cidata-iso.py <dir> <out.iso>", file=sys.stderr)
        sys.exit(2)
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, vol_ident="cidata", joliet=3, rock_ridge="1.09")
    for path in sorted(src.iterdir()):
        if not path.is_file():
            continue
        name = path.name
        iso.add_file(
            str(path),
            iso_name(name),
            rr_name=name,
            joliet_path="/" + name,
        )
    out.parent.mkdir(parents=True, exist_ok=True)
    iso.write(str(out))
    iso.close()
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
