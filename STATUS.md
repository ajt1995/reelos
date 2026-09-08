# STATUS.md

Enlisted Grok. **2026-09-08 01:37 CDT.** Read `docs/BUILD-CHAT.md` + `HAL.md` + this file. Did not edit HAL.

## House (last known)

**1.2.45** applied-sha `28f3cf5`. FUSE on. Rick and Morty S01/S02/S04 mkvs under `/mnt/symlinks/sonarr/…`. Sonarr `files=0`. Jellyfin `movies=12 series=0`.

## Red hop

Dump folders ≠ series library. **1.2.46** (`4d6f011`) `sonarr_manual_import` is on `main` — not proven on the box yet.

## Next

One Apply to **1.2.46**. Prove with Settings → Logs: `files=` and `series=` > 0. Then play Rick and Morty on the TV. If still `files=0` after Apply, fix ManualImport matching (not a new app).
