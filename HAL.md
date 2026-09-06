# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 13:03 CDT**. VERSION stays **1.2.15**. No 1.2.16 stamp. No ISO. No APK. No README.

House box is still 1.2.8. They apply once after this list is on `main` and STATUS says frozen.

## Everything that must be real before that apply

Closed already, do not reopen: SHA-aware apply, `/symlinks` + `/mnt/symlinks` on *arrs, library canary, Plex `0.0.0.0:32400` bind, probe `:80`+`:8080`, console IPv4 first, empty Home search-only, reset → wizard, Doctor names Decypharr restarting.

### A. Wizard must run on the box

1. `POST /api/provision` in `scripts/reelos-lookup-plugin.mjs`.
   Write `/var/lib/reelos/answers.json`, compose `.env`, Decypharr config from the key, `docker compose up -d` with wizard profiles, spawn `wire-engines.py`, write `provisioned`.
   Return `{ok:true, simulated:false}` only if compose exits 0. Otherwise `{ok:false, error}`.
2. Wizard Finish: `fetch("/api/provision")`. Delete `provisionAppliance` / `createServerFn` from the Finish path.
   On failure: stay on wizard, show the error. Do not start the building screen.
3. `POST /api/ping` hits the real provider. Never canned "Premium · 38 days".
4. Wizard Validate: `fetch("/api/ping")`. Delete `pingSource` and `pingCopy` from the wizard.
5. Storage step: `GET /api/disks` (`lsblk`). Delete `DISKS` from the wizard. Empty list if no extra disks. Never paint fake sda/sdb.
6. After Reset: `/api/box.provisioned === false`, wizard then Connect. Phone localStorage must not skip the wizard.

### B. Engines must actually wire

7. `wire-engines.py` after provision: Radarr/Sonarr/Prowlarr keys exist, root folders `/symlinks` and `/mnt/symlinks`, quality from answers, Prowlarr apps pointed at *arrs, Decypharr has the TorBox/RD key.
8. Jellyfin first-run: user + password from answers, Movies/Shows libraries on `/symlinks`, listening `0.0.0.0:8096`. `/api/box.jellyfin` green only when that is true.
9. If Decypharr or Jellyfin is restarting, Doctor says **restarting** plus the last log line. Do not call the hop green.
10. Kids intent does not invent a library. Music only if they checked music (Lidarr).
11. Plex profile binds `0.0.0.0:32400`. Claim/first-run is still **not done**. Do not call Plex done.
12. Indexers: wizard does not invent them. Connect paste → `POST /api/indexer` → Prowlarr 2xx only.

### C. Front must not lie

13. Home / Discover / search: `/api/library` and `/api/lookup` only. Do not iterate `TITLES`.
14. `GET /api/lookup?q=batman` — Radarr/Sonarr hits or an error string. Never `[]` when engines have no key.
15. `POST /api/request` — movie to Radarr, show to Sonarr, download client Decypharr. No fake percent.
16. Request status from queue/history. Watch enables when the title is in Jellyfin.
17. Building screen may exist as a wait. Logs must not claim libraries exist until `/api/box` says they do.
18. Delete or stop exporting `LAN_IP = "192.168.1.42"` as if it were this house.

### D. Then freeze

STATUS = frozen. Stop committing. Same door:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```
