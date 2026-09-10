# STATUS.md

***Jellyfin Movies stays one poster; the phone UI paints without waiting on the box probe.*** 2026-09-10. 1.2.50.20 collapsed dumps and merged versions, then `Library/Refresh` split them again. ReelOS Library still hid dupes; Jellyfin Movies did not. Phone Home blocked on `GET /api/box` (Tailscale spawn + VirtualFolders) before first paint. Stamp **1.2.50.21**. Complements #72. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.21`
- **Base:** current `main` (1.2.50.20 / #72)
- Did **not** take Tron chrome from #52 / #70
- **What it is:** MergeVersions runs **after** the Jellyfin scan, never before. `lock-clients` calls `wire-engines.py merge-movies` every minute (no Library/Refresh). Same-TMDB dump rows merge across folders. Splash hydrates from localStorage; `/api/box` continues in the background. `/api/library` serves a stale shelf immediately. Posters are `/api/jf/Items/{id}/Images/Primary?maxWidth=240` (not full-size LAN :8096). Never `/media`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/lock-download-clients.py --self-test
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs scripts/reelos-library.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.21`.
3. Jellyfin Movies is one Interstellar / John Wick / Night at the Museum — the same titles the phone Library already showed.
4. Phone Home should paint the chrome before doctor/Tailscale finish.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media`
