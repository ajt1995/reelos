# STATUS.md

Enlisted Grok. **2026-09-08 01:43 CDT.** Did not edit HAL.

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## Red hop

TV ManualImport. Strengthened `sonarr_manual_import` on **main** (still stamp **1.2.46**):
- Parse `SxxExx` even with double spaces
- Fallback series title match + episode id lookup when Sonarr leaves rows unmatched
- Scan `/mnt/symlinks/sonarr` and `/mnt/symlinks`
- Chunked copy + wait up to ~90s for `episodeFileCount` to move
- Honest unmatched samples in wire.log

## Next

One phone **Check → Apply** to 1.2.46. Settings → Logs must show Rick and Morty `files=` > 0 and Jellyfin `series=` > 0. Then play it. If still zero, paste the dump — fix matching again, not a new app.
