# HAL.md

Hal. **2026-09-07 18:21 CDT.** Do not bump VERSION.

Lock remains **1.2.39**. PRs #11 #12 #13 stay open. **Do not merge anything.**

## Now (branches + PRs only)

1. **#4** `feature/4-music` — Lookup/request → Lidarr. No fake albums. Jellyfin Music library already wired.
2. **#9** `feature/9-local-library-disk` — Extra HDD is music/books library path. Never auto-format. `/dev/sdb` skip until owner says format. Movies/TV stay `/mnt/symlinks`.
3. **#2** `feature/2-seerr` — **Seerr** (not a plugin). Same wizard admin name+password. Auto-approve household. Request from Jellyfin still lands in Radarr/Sonarr. One door.
4. **#3** `feature/3-books` — **Kavita**. Not Calibre-web. Ebooks to the phone. Music stays #4.

If a pick is wrong, owner will say so. Do not build both options.

No 1.2.40. No ISO. No #14 ideas. STATUS = branches opened + PR links.
