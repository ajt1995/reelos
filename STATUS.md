# STATUS.md

**Reelist (regression audit + empty-dump recovery).** 2026-09-09. Cloud audit of main **1.2.50.2** plus house QA (2026-09-08 ~23:14 CT). Separate from Tron #52. Stamp **1.2.50.3**.

## Stamp

- **VERSION / channel:** `1.2.50.3`
- **Base:** latest `main` `cf758bc` (1.2.50.2 from merged #54)
- Did **not** take Tron chrome from #52
- **What it is:** Stage 3 `cp -a node_modules` heartbeats. Relink recreates empty `sonarr`/`radarr` dumps from FUSE when *arr still knows the title. Title-page GET `/api/request` is season-scoped. `requestTitle` no longer invents 42%.

## House QA (1.2.50.2) — folded in

- Stamp 1.2.50.2 OK. Lookup OK.
- Requests honesty PASS (`/api/request count=0`, no stale Museum grabbing).
- Library: Museum only.
- **Import path FAIL-to-prove:** Sonarr symlink dumps empty after wipe → ManualImport 0/0. TWD files never landed. Apply/wipe may have cleared dumps without recovery.
- Mid-Apply of 1.2.50.1 sat a long time in Stage 3/8 (`node_modules`) before the 1.2.50.2 Apply.
- In flight on the box: Reelist POSTing TWD S01 to create a real dump for re-proof.

OTA Apply does **not** `rm -rf /mnt/symlinks`. Soft-reset does not either. After hops, mailman already runs `wire-engines.py import` (scan + Sonarr ManualImport). The hole: **relink only filled dump folders that already existed.** Empty `/mnt/symlinks/sonarr` + FUSE still holding the pack → 0 links → ManualImport 0/0.

## Code changes (this stamp)

1. **OTA Stage 3 heartbeat.** `copy_node_modules_with_heartbeat` still runs `cp -a`. Every 15s: `still copying node_modules (Ns, staging N bytes)`.
2. **Relink creates missing category dumps.** If FUSE `/mnt/debrid/__all__` has the pack and Sonarr/Radarr (series, movie, or queue) still has that title stem, mkdir `/mnt/symlinks/{sonarr|radarr}/<pack>/` and symlink files, then the existing ManualImport harden runs. Never parent `/mnt/symlinks`. Never guess a pack into Sonarr from `SxxExx` alone (Museum bleed).
3. **#54 leftover — title poll painted every season.** `pickSeerrRequestForTitle` + `season=` + `applyTitleRequestPoll`.
4. **#54 leftover — title page invented 42%.** Store `requestTitle` is `waiting` / `0`.

## Audit — verified OK on 1.2.50.2 (unchanged)

| Area | Verdict |
|------|---------|
| Search hop | Advisory, 4×20s, does not block stamp |
| Stamp honesty | VERSION + `applied-sha` written **last**, after `ensure_door` |
| SKIP_NPM / npm ci fail | Lockfile-gated; fail deletes `.next` only |
| OTA import after hops | Still runs on every provisioned Apply (compose unchanged included) |
| #50 FUSE heal | docker exec readers; missing container ≠ stale; rshared before restarts |
| #50/#53 importPending | `retry_import` → Sonarr ManualImport, not scan-only / ignore / blocklist |
| #53 path isolation | Scans `/mnt/symlinks/sonarr` and `/mnt/symlinks/radarr` only |
| #54 GET list | honestify + TV isolation + duplicate collapse + #53 POST reuse |
| JF12 / #47 / #49 | Auth headers correct. Finish does not `spawnSync` pull |

## Residual (no code change)

- `TimeoutStartSec=infinity` + hung `cp`/`npm ci`/`compose up` can leave `running: true` forever. Heartbeat makes a *slow* copy honest; it does not kill a *stuck* one.
- `HEAD_SHA` captured at start, not from the tarball.
- FUSE heal/backoff can skip that tick’s queue loop; lock-clients 90s vs `kick_import` 120s.
- Unbounded `retry_import` with no terminal fail.
- Relink still cannot classify a FUSE pack if *arr has no series/movie/queue row for it (need the TWD S01 POST, or a leftover Sonarr series).

## Proof

```
python3 scripts/check-ota.py .
python3 install/bin/relink_dumps.py --self-test
python3 install/bin/stuck-downloads.py --self-test
python3 install/bin/sonarr_manual_import.py --self-test
node --test scripts/reelos-update.test.mjs scripts/relink-dumps.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-request-status.test.mjs scripts/stuck-downloads.test.mjs scripts/sonarr-manual-import.test.mjs scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.3`. Expect `ReelOS 1.2.50.3 applied.`
3. If Apply sits on Stage, `ota.log` must keep printing `still copying node_modules`.
4. After Apply (and after the in-flight TWD S01 POST if Sonarr has the series): `wire.log` should show `relink created sonarr/… from FUSE` when dumps were empty, then `sonarr manualimport matched=` > 0.
5. Title: TWD S01 Play does not hide Request S02. No 42%.

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests.
- Change season-by-season TV UX.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
- Scan parent `/mnt/symlinks`.
