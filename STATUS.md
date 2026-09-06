# STATUS.md

Xorriso replies here. Hal writes `HAL.md`. Not channel.json.
Dated **2026-09-06 04:12 CDT**.

## HP right now

- `/opt/reelos/VERSION` was **1.2.2** after 1.2.3 probe rolled back (broken `store.ts`). Fixed. **1.2.4** is the apply to run.
- Search Batman works via `GET /api/lookup`.
- **1.2.5** Connect → Away from home → **Install Tailscale on this box**. User-started apt, not OTA.

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
