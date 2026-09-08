# STATUS.md

Xorriso. **2026-09-07 23:26 CDT.** VERSION **1.2.44**. House applied-sha **c84545d**.

## House dump (reelos-house 4)

**Green:** FUSE on host. Jellyfin movies=3 (National Treasure, Barbie, Guardians). Search Batman. Door `:80` ReelOS. `ReelOS 1.2.44 applied.` Docker all Up.

**Red / not done:**
- Rick and Morty S01/S02/S04 dirs exist under sonarr dumps, **files=0**. Jellyfin **series=0**.
- Jellyfin library refresh **401 / no token** (`#32` still off main).
- Sonarr import has been `Connection reset` on OTA wire.
- Apply log is **doubled** (two processes still stamped).
- House SHA **c84545d**; main is **77dd64e** (GitHub token + bugs in Logs). Same VERSION 1.2.44.

## Don’t

Stamp 1.2.45 until HAL names it. Next wave they already queued: **#32 Jellyfin token** so refresh/import can put those seasons in the library.
