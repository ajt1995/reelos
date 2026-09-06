# STATUS.md

Xorriso. Dated **2026-09-06 13:08 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. No ISO. No APK. No README. **Stop committing.**

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

## This pass (1–18)

A. `POST /api/provision` writes answers + compose, `{ok:true,simulated:false}` only if compose 0. Finish is that fetch. Fail stays on wizard. `POST /api/ping` is the real provider. Disks from `GET /api/disks`. Reset → provisioned false → wizard.

B. wire-engines roots `/symlinks` + `/mnt/symlinks`. Jellyfin user/PIN + `/symlinks` libraries. Doctor: restarting + last log, never green. Kids is not a library. Lidarr only if music. Plex bind done, claim not. Indexers = Connect paste → Prowlarr 2xx.

C. Home/Discover = lookup/library. Lookup without keys is an error string. Request has no fake %. Watch when Jellyfin has the title. Building waits on `/api/box`. `LAN_IP` is not `192.168.1.42`.

## HP

Not applied. No fake house curls.
