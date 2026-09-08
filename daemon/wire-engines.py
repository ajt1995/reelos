#!/usr/bin/env python3
"""Shim loader for wire-engines body parts (1.2.47)."""
from __future__ import annotations

import sys
from pathlib import Path

here = Path(__file__).resolve().parent
parts_dir = here / "wire-engines.parts"
if not parts_dir.is_dir():
    parts_dir = Path("/opt/reelos/daemon/wire-engines.parts")
parts = sorted(parts_dir.glob("*.part"))
if not parts:
    print("wire-engines parts missing", file=sys.stderr)
    raise SystemExit(1)
code = "".join(p.read_text() for p in parts)
ns = {"__name__": "__main__", "__file__": str(Path(__file__).resolve())}
exec(compile(code, ns["__file__"], "exec"), ns, ns)
