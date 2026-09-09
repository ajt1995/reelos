# STATUS.md

**Reelist (Requests honesty).** 2026-09-09. Titles already in Jellyfin still painted as grabbing/importing/0% because `GET /api/request` trusted stale Seerr `processing`. On top of shipped **1.2.50.1** (#53 TV season import). Separate from Tron #52 (1.2.51 reserved). Stamp **1.2.50.2**.

## Stamp

- **VERSION / channel:** `1.2.50.2`
- **Base:** latest `main` `f4298d3` (1.2.50.1 from merged #53)
- Did **not** take Tron chrome from #52
- **What it is:** `honestifyRequests` overlays library / Seerr season AVAILABLE / *arr `hasFile`. Duplicate same `titleId+season` collapses; a done sibling wins. #53 reuse of duplicate season POSTs stays.

## What was lying

Phone Requests showed Night at the Museum as **Cache hit · importing** with Cancel. `GET /api/library` already listed it. `GET /api/request` still returned `status: downloading`, `progress: 0`, `engine: grabbing` (seerr-2). Duplicate Walking Dead S01 rows stayed active.

Cause: Seerr media status 3/4 mapped to grabbing and never consulted Jellyfin or *arr `hasFile`. Series-level processing also hid a season that Seerr already marked AVAILABLE. Two Seerr ids for the same title+season both rendered.

## How status is derived now (no fake %)

`GET /api/request` (list and by id) runs `honestifyRequests`:

1. Seerr request declined/failed → **failed**
2. Seerr media **or requested season** AVAILABLE (5) → **available** (progress 100)
3. Jellyfin library hit for that **movie** TMDB → **available**
4. Radarr `hasFile` / Sonarr season `episodeFileCount > 0` → **available**
5. Else processing/partial → **downloading** at progress **0** (not an invented percent)
6. Else pending/approved → **waiting**

TV stays season-by-season: a series sitting on the JF shelf does **not** close S02. Duplicate Seerr rows for the same `titleId+season` collapse to one; if any sibling is available, the row is available.

Phone merge (`overlayLibraryPresence`) is a belt: movies already on the Home/Library shelf cannot stay downloading.

## Proof

```
node --test scripts/reelos-seerr.test.mjs scripts/reelos-request-status.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
python3 scripts/check-ota.py .
```

House after Apply: Night at the Museum on Requests is **Available** (Play), not importing/Cancel. Duplicate Walking Dead S01 is one honest row. TWD import path from 1.2.50.1 is unchanged.

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply (or `/opt/reelos/bin/reelos-update.sh apply`). Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.2`.
3. Museum on Requests is Available. One TWD S01 row.

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests.
- Change season-by-season TV UX.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
