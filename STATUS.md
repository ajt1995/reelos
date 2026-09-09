# STATUS.md

**Reelist (regression audit).** 2026-09-09. Cloud audit of main **1.2.50.2** (`cf758bc`, #54). Separate from Tron #52. Stamp **1.2.50.3** — only the real bugs. Findings that are not bugs stay in this file.

## Stamp

- **VERSION / channel:** `1.2.50.3`
- **Base:** latest `main` `cf758bc` (1.2.50.2 from merged #54)
- Did **not** take Tron chrome from #52
- **What it is:** Stage 3 `cp -a node_modules` heartbeats in ota.log. Title-page GET `/api/request` is season-scoped. `requestTitle` no longer invents 42%.

## Code changes (this stamp)

1. **OTA Stage 3 heartbeat (hypothesis: confirmed).** `copy_node_modules_with_heartbeat` still runs `cp -a`. Every 15s it logs `still copying node_modules (Ns, staging N bytes)`. No timeout, no SKIP_NPM change, no stamp-order change.
2. **#54 leftover — title poll painted every season.** `GET /api/request?id=` used `reqs[0]`. `useEngineRequest` then wrote that status onto every row with the same `titleId`. TWD S01 available closed S02. Now: `pickSeerrRequestForTitle` + `season=` + `applyTitleRequestPoll`.
3. **#54 leftover — title page invented 42%.** Discover installed `installHonestRequest()`. Title page used store `requestTitle` (`progress: 42`, `downloading` on cache hit). Store now matches honest: `waiting` / `0`.

## Audit — verified OK on 1.2.50.2 (unchanged)

| Area | Verdict |
|------|---------|
| Search hop | Advisory, 4×20s, does not block stamp |
| Stamp honesty | `$ROOT/VERSION` + `applied-sha` written **last**, after `ensure_door`. Swap does not flip VERSION mid-flight |
| Mailman twins | `daemon/reelos-update.sh` ≡ `install/bin/reelos-update.sh` |
| SKIP_NPM | Both package.json **and** lockfile must match |
| Failed npm ci | Deletes `.next` only; no live swap |
| Compose pull | After `applied.`, `timeout 600` |
| #50 FUSE heal | docker exec radarr/sonarr/jellyfin; missing container ≠ stale; `make-rshared /mnt` before restarts; host remount only if host stale |
| #50 importPending | `retry_import`, not ignore/blocklist |
| #53 Sonarr | ManualImport (not scan-only). Scans `/mnt/symlinks/sonarr` only. Skip `/radarr/`. `S01.E01` / `1x01` / season-pack / queue hint |
| #53 Radarr | Category folders only |
| #54 GET list | `honestifyRequests`: failed / AVAILABLE 5 / JF movie / *arr hasFile / else downloading 0 / waiting. TV series-in-JF does not close another season. Duplicate collapse. #53 season POST reuse kept |
| JF12 / #47 / #49 | `Authorization` + `X-Emby-Authorization` on login; `X-Emby-Token` after. Finish does not `spawnSync` compose pull. Seed durable |

## Audit — residual (no code change)

1. **`TimeoutStartSec=infinity` + unbounded `cp` / `npm ci` / `compose up`.** A hung I/O leaves `reelos-ota` `activating` and `/api/update/status` `running: true` forever; second Apply is 409. Heartbeat makes a *slow* copy honest; it does not kill a *stuck* copy. Finite timeout would be a behavior change (could SIGTERM a legitimate long Apply).
2. **`HEAD_SHA` captured at start**, not from the tarball. If `main` moves mid-download, `applied-sha` can drift immediately. Need archive commit to stamp honesty.
3. **Post-swap hop/door/indexer fail** (compose-changed) leaves the new tree with the old VERSION (no restore). Check offers Apply again. By design since #48.
4. **FUSE heal early-return.** `heal_fuse_if_stale` True (including 300s backoff) skips the queue loop that tick. Successful heal still `kick_import`s. Residual: backoff window can delay `retry_import`.
5. **`lock-download-clients` timeout 90s** vs `kick_import` timeout 120s. A heal+import tick can be SIGTERM'd. Residual, not reproduced in lab.
6. **Unbounded `retry_import`** every 90s with no terminal fail. Permanently unimportable rows stay `importPending`.
7. **`compose/docker-compose.yml` vs `install/compose`** bind paths differ (`/mnt` vs `/mnt/debrid`). OTA uses `install/compose`.
8. **Post-stamp `docker compose pull`** keeps the oneshot `activating` up to 600s; phone stays “applying” until the unit exits even after VERSION matches.

## Proof

```
python3 scripts/check-ota.py .
python3 install/bin/stuck-downloads.py --self-test
python3 install/bin/sonarr_manual_import.py --self-test
node --test scripts/reelos-update.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-request-status.test.mjs scripts/stuck-downloads.test.mjs scripts/sonarr-manual-import.test.mjs scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.3`.
3. If Apply sits on Stage, `ota.log` must keep printing `still copying node_modules` — not a dead last line.
4. Title: TWD S01 Play does not hide Request S02. No 42% on a title-page request.

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests.
- Change season-by-season TV UX.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
- Change mailman stamp order, search-hop fail-close, or `TimeoutStartSec`.
