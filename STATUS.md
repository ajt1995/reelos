# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. #49 already stamped **1.2.49** (durable Jellyfin seed). This tip is PR **#50**: TorBox already cached, Decypharr symlink under `/mnt/symlinks/{radarr|sonarr}`, Radarr/Sonarr stuck `completed`/`importPending` with “Unexpected error processing file”, `hasFile` false until manual import or FUSE heal. Night at the Museum 2026-09-09. VERSION stays 1.2.49 — do not cut 1.2.50.

## Stamp

- **VERSION / channel:** `1.2.49` (already on main from #49)
- **PR:** https://github.com/ajt1995/reelos/pull/50 (`cursor/fuse-arr-import-0b46`)
- **What it is:** Retry *arr import when the FUSE target is stat-able. Do not ignore `importPending`+warning. Keep #49 JF seed.

## Root cause

`stuck-downloads.py` already stopped same-hash re-adds and stuck 0%. It treated a **visible symlink** as success (`ignore`). Decypharr notifies *arr as soon as the link exists; FUSE may not be readable yet. Heal remounted on `ENOTCONN` and returned without scanning. `/symlinks` vs `/mnt/symlinks` is already bind-mounted both ways — not the house fail.

## Fix

- `importPending` / unexpected error → `retry_import` when FUSE `stat` works (scan + `RefreshMonitoredDownloads` + Radarr ManualImport with `movieId`). Wait if the file is not readable. Do not fail/blocklist (no second TorBox add).
- After FUSE green, kick `wire-engines.py import`.
- `kick_imports` waits for FUSE `listdir` (skip `local-vpn`).
- `lock-download-clients.py` unchanged — it already runs this sweep.
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
