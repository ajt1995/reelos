# STATUS.md

**Reelist (TV recover extras on 1.2.50.3).** 2026-09-09. Fold-in after #55 merge (Stage 3 heartbeat + FUSE dump recreate). Separate from Tron #52. Stamp **1.2.50.4**.

## Stamp

- **VERSION / channel:** `1.2.50.4`
- **Base:** latest `main` (merged #55 = 1.2.50.3)
- Did **not** take Tron chrome from #52
- **What it is:** SeasonSearch on TV POST add/reuse when the season has 0 files. `GET /api/request?recover=1`. stuck-downloads searches/relinks 0-file monitored seasons. lock-download-clients keeps Decypharr dumps (`removeCompletedDownloads: false`). Requests stay visible if Seerr is empty but Sonarr/Decypharr still have unfinished TV.

## Kept from 1.2.50.3 (#55)

- Stage 3 `cp -a node_modules` heartbeats.
- `relink_dumps.py` recreates empty `sonarr`/`radarr` dumps from FUSE.
- Title-page GET `/api/request` is season-scoped (`pickSeerrRequestForTitle`). `requestTitle` no longer invents 42%.

## House QA (1.2.50.2) — still the hole this stamp closes

- Requests honesty PASS (`/api/request count=0`, no stale Museum grabbing).
- Library: Museum only.
- TWD never landed files after wipe. Relink can recreate dumps when FUSE has the pack (#55). If FUSE is also empty, the POST/reuse/recover hops must `SeasonSearch`.

## Code changes (this stamp)

1. **POST `/api/request` TV** — after add **or reuse**, `SeasonSearch` if that season has 0 files, then kick relink + ManualImport.
2. **GET `/api/request?recover=1`** — HTTP recover for QA (search missing + import). Phone polls omit this flag.
3. **stuck-downloads** — 0-file monitored season: relink/import or SeasonSearch (15 min after the first). Uses `#55` `relink_dumps.py` (`decide_missing_action`).
4. **lock-download-clients** — `removeCompletedDownloads: false`; PUT existing Decypharr clients.
5. **Honesty** — empty Seerr + unfinished Sonarr/Decypharr/Seerr-media still shows one S01 row. Ghost Seerr AVAILABLE + files=0 stays downloading. Museum on JF is not re-invented.

## Residual (no code change)

- `TimeoutStartSec=infinity` + hung `cp`/`npm ci`/`compose up` can leave `running: true` forever.
- Relink still cannot classify a FUSE pack if *arr has no series/movie/queue row for it (need the TWD S01 POST, or a leftover Sonarr series).
- If `pipeline.sonarrMissing`, `fuseTv`, and `decypharr` are all 0 after recover, the POST did not land — grab miss, not matching.

## Proof

```
python3 scripts/check-ota.py .
python3 install/bin/relink_dumps.py --self-test
python3 install/bin/lock-download-clients.py --self-test
python3 install/bin/stuck-downloads.py --self-test
python3 install/bin/sonarr_manual_import.py --self-test
node --test scripts/reelos-update.test.mjs scripts/relink-dumps.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-request-status.test.mjs scripts/stuck-downloads.test.mjs scripts/sonarr-manual-import.test.mjs scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.4`. Expect `ReelOS 1.2.50.4 applied.`
3. In-flight or new `POST /api/request` TWD S01 → one downloading S01 row at 0%.
4. `GET /api/request?recover=1` once. Then `GET /api/activity` for relink / ManualImport / SeasonSearch.
5. That S01 row → Available / Play. Title: TWD S01 Play does not hide Request S02. No 42%.

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests.
- Change season-by-season TV UX.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
- Scan parent `/mnt/symlinks`.
- Replace `#55` `relink_dumps.py` with a second dump-recreate module.
