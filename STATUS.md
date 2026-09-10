# STATUS.md

***Jellyfin Movies stays one poster; hybrid keeps 1080 and 4K; the phone UI paints without waiting on the box probe.*** 2026-09-10. 1.2.50.20 collapsed dumps and merged versions, then `Library/Refresh` split them again. ReelOS Library still hid dupes; Jellyfin Movies did not. Radarr upgrade used to replace the 1080 when 4K landed. Phone Home blocked on `GET /api/box` (Tailscale spawn + VirtualFolders) before first paint. Stamp **1.2.50.21**. Complements #72. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.21`
- **Base:** current `main` (1.2.50.20 / #72)
- Did **not** take Tron chrome from #52 / #70
- **What it is:** Jellyfin already merges 1080p + 4K when files are named `Title (Year) - 1080p.mkv` / `- 2160p.mkv`. Apply labels dump files that way (no third-party plugin; this box is Jellyfin 12). Hybrid Radarr still upgrades to 4K, but recycle (`/mnt/symlinks/.reel-recycle`) keeps the 1080 and restore puts it back; cutoff MoviesSearch hunts 4K after 1080. Identical clones (same-size [TGx] copy) still park to `/mnt/symlinks/.reel-parked`. MergeVersions runs **after** scan. Phone splash does not wait on `/api/box`. Never `/media`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/lock-download-clients.py --self-test
python3 daemon/stuck-downloads.py --self-test
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs scripts/reelos-library.test.mjs scripts/relink-dumps.test.mjs scripts/stuck-downloads.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.21`.
3. Jellyfin Movies is one Interstellar with a 1080p/4K version picker, not two posters. Hybrid keeps both files (1080 is not replaced). Identical clones only in `/mnt/symlinks/.reel-parked`.
4. Phone Home should paint the chrome before doctor/Tailscale finish.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media`
