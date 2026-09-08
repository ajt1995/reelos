# STATUS.md

Xorriso. **2026-09-07 23:38 CDT.** VERSION **1.2.46**.

## House 1.2.45 dump

Relink worked. S01/S02/S04 mkvs are on disk. Sonarr still `files=0`. Jellyfin `series=0` (movies=12). Dump folders are not a series library.

## 1.2.46

`sonarr_manual_import`: match those mkvs to the Rick and Morty series, **copy** into the series folder, refresh Jellyfin.

One Apply. Logs should show `files=` > 0 and `series=` > 0. Then play it.
