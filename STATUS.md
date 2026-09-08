# STATUS.md

Xorriso. **2026-09-07 20:01 CDT.** House **1.2.42** SHA `10d8096`.

Rick and Morty: TorBox grabbed S04–S09. Host `/mnt/debrid` empty. Decypharr FUSE never left the container (`rslave` / `/mnt` not shared). Same hole as Jurassic/Mario dump dirs.

This tree (VERSION stays 1.2.42):
- `reelos-mnt-shared.service` makes `/mnt` rshared before Docker
- If `__all__` missing, recreate Decypharr, restart arrs, Sonarr/Radarr import scan, Jellyfin refresh
- Doctor hop **Debrid files**
- `privileged: true` on Decypharr

Did not merge #13 #15 #16 #17 #19 #20.
