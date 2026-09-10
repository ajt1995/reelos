# STATUS.md

***1.2.50.22 is the ship.*** 2026-09-10. One Apply from house **1.2.50.21** / #73. Fixes the hybrid 1080+4K path so a title lands both resolutions in one Jellyfin tile. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.22`
- **Base:** `main` at 1.2.50.21 (#73)
- **PR:** https://github.com/ajt1995/reelos/pull/79
- Did **not** take Tron chrome from #52 / #70

## Changelog (everything in this Apply)

Each fix was root-caused on the live house box and proven on a faithful cloud replica of it (its real Radarr/Sonarr/Prowlarr DBs + the same TorBox mount).

### Hybrid recycle keeps the 1080 (Radarr no longer 400s)

OTA runs `wire-engines` as root, so `/mnt/symlinks/.reel-recycle` was created root-owned and Radarr's `FolderWritableValidator` rejected the `config/mediamanagement` PUT with `400 "not writable by user 'abc'"` — every Apply logged `radarr hybrid recycle put HTTP Error 400`, the recycle bin was never set, and a 4K upgrade deleted the 1080. The bin is now `chmod 0775` + `chown 1000:1000` after mkdir, so the PUT lands and the 1080 is recycled.

### Apply removes leftover `dns:1.1.1.1` before recreate

`docker compose up -d` cannot replace the fixed-name `seerr` / `decypharr` containers, so it failed with `container name "/seerr" is already in use` → `compose up skipped`, and the stale `HostConfig.Dns=1.1.1.1` survived every Apply. Apply now `docker rm -f` the containers still carrying `dns 1.1.1.1` before the recreate, so compose brings them back fresh.

### Sonarr manualimport no longer times out

One `manualimport` call on the whole `/symlinks/sonarr` tree made Sonarr probe every episode over the FUSE debrid mount and blow past the 120s client timeout, so TV dumps never imported. It now scans each dump subfolder on its own (bounded) and drops the duplicate `/symlinks` vs `/mnt/symlinks` alias.

### 1080 companion actually grabs for 4K-only titles

Radarr's interactive `/release` search (live Prowlarr→indexer aggregation, 30–60s) was capped at 25s → `radarr hybrid 1080 <title> TimeoutError timed out`, and the `--hybrid-1080` sweep was killed at 90s, so a 4K-only title never got a 1080. The `/release` search now gets 90s and the sweep 300s.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/stuck-downloads.py --self-test
python3 daemon/sonarr_manual_import.py --self-test
node --test scripts/stack-smoke.test.mjs scripts/sonarr-manual-import.test.mjs
```

## Owner / house Apply

1. Merge #79 to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.22`.
3. A requested hybrid title lands `Title (Year) - 1080p` + `Title (Year) - 2160p` in one folder → one Jellyfin tile with a version picker.
4. No container carries `HostConfig.Dns=1.1.1.1` after Apply.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media` or TorBox
