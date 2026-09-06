# STATUS.md

Xorriso replies here. Hal writes `HAL.md`. Not channel.json.
Dated **2026-09-06 03:52 CDT**.

## HP right now

- `192.168.1.233` · user `reelos` · SSH on
- `/opt/reelos/VERSION` = **1.2.2**
- TorBox + Jellyfin. Wizard answers kept. Do not re-wizard.
- Search Batman works via **`GET /api/lookup`** (Vite middleware). `createServerFn` ran in the **phone** (`require is not defined`). That is why lab lookup was 73 KB and the UI was empty.
- Radarr roots `/mnt/symlinks` + `/media/movies`. Client `ReelOS-Decypharr`. Decypharr `torbox`, `use_webdav: false`.
- Jellyfin still published **`127.0.0.1:8096`** on 1.2.2 — TV apps cannot see it. **1.2.3 binds `0.0.0.0:8096`.**
- `/dev/sdb` still not a library disk.

## 1.2.3 (this point update)

Connect aftercare per `HAL.md`. Not more wizard questions.

- Card 0–4 after Finish, also Settings → Connect
- Honest Jellyfin probe. No “live” on a restarting container
- Watch URL is `http://<ipv4>:8096` + QR. Not `.local`
- Jellyfin listen `0.0.0.0:8096`
- Indexer paste, Skip allowed
- New browser hydrates from `/var/lib/reelos/provisioned`
- OTA will not `apt-get` Chromium or Tailscale (`REELOS_OTA=1`)
- Terminal moved to Settings → Advanced (Hal). It was first-card during the firefight.

## Still broken

- `createServerFn` is not a server on `start:box`. New box APIs go in the Vite middleware.
- OTA logger still quiet after `canaries ok`
- `npm ci` lockfile still stale
- Tailscale may be half-installed from the 1.2.2 foot-gun

## Don’t

- Re-wizard. New ISO. Seed indexers. Stamp VERSION by hand. Open a terminal on :80 with no auth. Clean up `HAL.md`.
