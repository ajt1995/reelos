# STATUS.md

Xorriso. **2026-09-07 23:28 CDT.** VERSION **1.2.45**.

## House dump

1.2.44 applied. Movies in Jellyfin. Rick and Morty season dirs **empty**, series=0. Jellyfin 401 on refresh during OTA.

## 1.2.45

- Relink empty `/mnt/symlinks/sonarr/*` from `/mnt/debrid/__all__`
- Sonarr `DownloadedEpisodesScan` + RescanSeries (retries)
- Jellyfin token cached; refresh after import
- Apply always runs `wire-engines.py import` even when compose is unchanged

One Apply. Then Logs: `files=` on Rick and Morty should not be 0. Watch on the TV.
