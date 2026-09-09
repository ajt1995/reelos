# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. #49 already stamped **1.2.49** (durable Jellyfin seed). This tip is PR **#50**: TorBox already cached, Decypharr symlink under `/mnt/symlinks/{radarr|sonarr}`, Radarr/Sonarr stuck `completed`/`importPending` with “Unexpected error processing file”, `hasFile` false until manual import or FUSE heal. Night at the Museum 2026-09-09. VERSION stays 1.2.49 — do not cut 1.2.50.

## Stamp

- **VERSION / channel:** `1.2.49` (already on main from #49)
- **PR:** https://github.com/ajt1995/reelos/pull/50 (`cursor/fuse-arr-import-0b46`)
- **What it is:** Retry *arr import when the FUSE target is stat-able. Do not ignore `importPending`+warning. Keep #49 JF seed.

## Root cause

**House-confirmed (Night at the Museum):** host `ls /mnt/debrid` listed fine while Radarr/Sonarr/Jellyfin `docker exec ls /mnt/debrid` got **Socket not connected**. Compose binds `/mnt/debrid` **rslave**. After Decypharr remounts FUSE, those binds stay on the old connection unless `/mnt` is **rshared** on the host (before docker) and the reader containers are restarted.

`fuse_stale()` only `listdir`’d the host, so heal never ran. `decide_queue_action` then treated `path_exists` + `completed` as **ignore**, so `importPending` + “Unexpected error processing file” sat forever. `/symlinks` vs `/mnt/symlinks` is already bind-mounted both ways — not the house fail.

## Fix

- `fuse_stale()` also `docker exec` radarr/sonarr/jellyfin. Heal: `mount --make-rshared /mnt` **before** restarts; remount Decypharr only if the **host** is stale; always restart readers; then `kick_import`.
- `reelos-mnt-rshared.service` (install + firstboot) makes `/mnt` rshared before docker. Wire-engines persist/enable the same unit. Apply copies it to `/etc`.
- `importPending` / unexpected error → `retry_import` (house `reimport`) when the FUSE target is stat-able. Wait if not readable. Do not fail/blocklist.
- `kick_imports` waits for FUSE `listdir` (skip `local-vpn`).
- #49 kept: visible admin, Movies/Shows paths, published URI by request, wipe re-seed.

## Owner / house Apply

1. Merge this tip to **main**. Channel tarball stays `main.tar.gz`. VERSION stays **1.2.49**.
2. Phone Check→Apply. SHA drift if 1.2.49 is already local. Search hop red is OK (#48).
3. `applied-sha` is this tip. `/opt/reelos/bin/stuck-downloads.py` contains `retry_import`.
4. Proof: `/api/box` Jellyfin green (#49). Next cached TorBox movie imports without babysitting (`hasFile=true`). Stuck log: `retry import … FUSE readable`.

## Tests

```
python3 install/bin/stuck-downloads.py --self-test
node --test scripts/stuck-downloads.test.mjs
```

## Do not

- Apply a feature-branch tarball — **main only**.
- Cut **1.2.50** in the same hour.
- Merge `feature/3-books` / pirate book indexers.
- Wipe TorBox / add wipe features.

## Hal / xorriso

Stamp stays **1.2.49**. Phone OTA uses `main.tar.gz` + `channel.json`. ISO not required.
