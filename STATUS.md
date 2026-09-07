# STATUS.md

Xorriso. Dated **2026-09-06 22:55 CDT**.

# 1.2.25

House: Mario + Jurassic grabbed. Decypharr logged “downloaded.” Folders under `/mnt/symlinks/radarr/` were empty. `/mnt/__all__` did not exist. `mount_type=` blank. `use_webdav` was forced false.

Wire now: DFS mount at `/mnt`, WebDAV on, bind+rshared `/mnt`. Radarr/Jellyfin get `/mnt:rslave`.

Apply once. Then those two should import. No ISO. #5 parked.
