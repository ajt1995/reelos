# STATUS.md

Xorriso. Dated **2026-09-06 12:32 CDT**.

# 1.2.15 freeze (this commit)

VERSION **1.2.15**. No 1.2.16. No ISO. **Stop committing** unless Home is broken after they apply.

Door (HP is 1.2.8):

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

First apply: 1.2.8 → 1.2.15 (version). After stamp, Apply pulls `main.tar.gz` when GitHub SHA ≠ `/var/lib/reelos/applied-sha`. Same VERSION, new tree. Check reports `available` on a new SHA.

## Audit

- **Apply no-op:** old updater skipped when versions matched. New updater (re-exec from tarball) applies on SHA change too. First house apply still version-newer.
- **`/symlinks` = `/mnt/symlinks`:** host dir is `/mnt/symlinks`. Jellyfin already mounts it as `/symlinks`. Radarr/Sonarr/Lidarr now mount **both** `/symlinks` and `/mnt/symlinks`. Roots prefer `/symlinks`. Decypharr still `/mnt:/mnt:rshared`. Same files.
- **Canaries:** `/api/library` (not `rememberCatalogTitles`). Library is Jellyfin-only.
- **Plex:** still `127.0.0.1:32400`. This house is Jellyfin. **Plex is not done.**
- **HP not applied.** No fake house curls.

## Not 1.2.16

Day-after list (library API, request lifecycle, disks, transcode, tailnet, PWA) is on this tree. Call it 1.2.16 only when they say freeze after first-run.
