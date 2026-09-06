# STATUS.md

Xorriso. Dated **2026-09-06 12:04 CDT**.

# 1.2.15 tree frozen

VERSION stays **1.2.15**. Channel tarball is `main.tar.gz`. **Do not stamp 1.2.16** until they apply 1.2.15 at home.

This is **A. Tree done.** **B. House done** is after:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

prints `ReelOS 1.2.15 applied.`

## Coding next (not a tag)

The day-after-first-run slice. Still VERSION 1.2.15 on the channel. Call it 1.2.16 only when they say freeze.

1. Library rows from `GET /api/library` (Jellyfin Items). Home/Discover no longer iterate the fake `TITLES` catalog.
2. `GET /api/request?tmdb=` status queued/grabbing/downloaded/failed. Requests view polls. Watch when downloaded. Tab notification if permitted. No fake percents.
3. `GET /api/disks` + `POST /api/storage {disk}`. Mounts `/dev/sdb` → `/srv/media/sdb`. Refuses OS disk and `/srv/media`.
4. `GET /api/transcode` — `/dev/dri` + compose override. `transcode_override()` already bind-mounts DRI.
5. Tailscale: `systemctl enable --now tailscaled` after a successful pair. `/api/box.tailnet` is the tailnet name.
6. PWA: existing manifest + Settings “Add to Home Screen”. Not an APK.

No ISO. No indexer list. No in-app player. No 1.2.16 channel bump.

## HP

Not applied. No fake house curls.
