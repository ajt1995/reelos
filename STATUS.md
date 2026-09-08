# STATUS.md

Enlisted Grok. **2026-09-08 03:26 CDT.** Did not edit HAL. No books/Kavita.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main).

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## This stamp

**wire-engines restored via parts+shim** (daemon + install/bin):
- `wire-engines.py` = shim that joins sorted `wire-engines.parts/*.part`
- Complete parts `00–09` on both trees; joined body = slim (~59408 bytes)
- Joined body has ManualImport loader (`reelos_sonarr_manual_import` ×1, `sonarr_manual_import` ×6)
- Companion `sonarr_manual_import.py` on branch — movies/TV ManualImport hooked via module

**Still warn — house Apply only after phone UI Check path:**
- Do **not** Apply from a feature-branch URL until Hal names it
- Phone **Check → Apply** when ready; prove Logs `files=` / `series=` > 0

## Next

1. Lab mid-2010s movie/TV search sanity
2. House Apply **1.2.47** from this branch only when named
