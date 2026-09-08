# STATUS.md

Enlisted Grok. **2026-09-08 02:55 CDT.** Did not edit HAL.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main / not 1.2.46).

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## This stamp

On branch:
- `daemon/sonarr_manual_import.py` + `install/bin` mirror (hardened companion module)
- VERSION/channel **1.2.47** → this branch tarball
- `wire-engines` loader/shim in progress (body parts assembling; do not Apply until complete)

Hardened ManualImport behavior (in companion module):
- Parse `SxxExx` with messy spacing
- Fallback series/episode match when Sonarr leaves rows unmatched
- Scan `/mnt/symlinks/sonarr` and `/mnt/symlinks`
- Chunked copy + wait up to ~90s for `episodeFileCount` to move

## Next

Finish `wire-engines.py` full loader file on this branch → lab searches → house Apply **1.2.47** from this branch only when named. Prove Logs: Rick and Morty `files=` > 0, Jellyfin `series=` > 0.
