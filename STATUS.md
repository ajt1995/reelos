# STATUS.md

Enlisted Grok. **2026-09-08 03:00 CDT.** Did not edit HAL. No books/Kavita.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main).

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## This stamp (partial)

**On branch (good):**
- `daemon/sonarr_manual_import.py` + `install/bin` mirror — hardened companion module (blob `bb5a4ba`)
- `VERSION` / `channel.json` → **1.2.47**, tarball = this branch

**Broken — do not Apply yet:**
- `daemon/wire-engines.py` and `install/bin/wire-engines.py` are a **shim** that joins `wire-engines.parts/*.part`
- Parts present on daemon: `00–03`, `09` only — **missing `04–08`** (incomplete body; shim will fail or run truncated code)
- ManualImport loader is **not hooked** until a complete `wire-engines.py` (slim loader that importlibs the companion) is restored

## Restore ready on box

`/workspace/RESTORE-wire.json` and `/workspace/FIX-wire-content.py` (~59KB) = full working `wire-engines` with `reelos_sonarr_manual_import` loader. Push those two paths via GitHub MCP `push_files`, then delete `wire-engines.parts/`.

## Next

1. Restore complete `wire-engines.py` (daemon + install/bin)
2. Lab mid-2010s movie/TV search sanity
3. House Apply **1.2.47** from this branch only when named — prove Logs `files=` / `series=` > 0
