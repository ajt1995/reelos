# STATUS.md

**Reelist (EZTV/ShowRSS actually land).** 2026-09-09. House 1.2.50.6 doctor: releases **ReelOS-tpb only**. B99 S01 + TWD S01 still `sonarr-missing@0` after SeasonSearch. `#58` claimed OTA adds EZTV/ShowRSS; Cardigann schema miss + doctor first-pass-test hid it. Stamp **1.2.50.7**.

## Stamp

- **VERSION / channel:** `1.2.50.7`
- **Base:** latest `main` (merged #58 = 1.2.50.6)
- Did **not** take Tron chrome from #52
- **What it is:** OTA POSTs EZTV/ShowRSS via TorrentRss, doctor lists every indexer, recover=1 upserts Sonarr→Decypharr and falls Ultra-HD back to Any so SeasonSearch can grab 720p, then re-searches 0-file seasons.

## Why TV defs never appear (5 hypotheses)

| # | Hypothesis | 1.2.50.6 |
| --- | --- | --- |
| 1 | OTA hop not run / early-exit | Hop runs (`wire-engines.py indexers` after hops, compose-unchanged included). Early-exit only if no Prowlarr key, or schema+list in one try (schema fail aborted adds — fixed). |
| 2 | Schema miss eztv/showrss | **Why they never POSTed.** Cardigann hints only. Native TorrentRss does not contain `eztv`. |
| 3 | fullSync never pushes to Sonarr | Nothing on Prowlarr to push. Sync is still `fullSync`. |
| 4 | Doctor lists a subset | First `indexer/test` pass → **ReelOS-tpb**. 1.2.50.7 lists all; TPB-only is red. |
| 5 | lock-clients blocks indexer hop | **No.** Unit FAILED on boot. Indexer hop does not wait on it. |

Not a duplicate sandbox Sonarr. Not “just catalog.” Movies + Expanse already Available via Decypharr.

## Code changes

1. **`public_indexers.py`** — `apply_public_indexers` + HTTP sandbox: TPB-only Prowlarr, no Cardigann eztv, still POSTs ReelOS-eztv + ReelOS-showrss TorrentRss bodies. `doctor_releases_detail` fails closed if those names are missing.
2. **`ensure_public_indexers`** — list indexers even if schema GET fails; Cardigann POST then **rss fallback**; `wire-engines.py indexers` skips live tests. Inline RSS if `public_indexers.py` is missing from bin/.
3. **Doctor** — list every enabled indexer. No `indexer/test` first-pass. TPB-only → `ok: false`.
4. **`widen_sonarr_hybrid`** — PUT Ultra-HD in place (same profile id on B99/TWD).
5. **`--research-missing`** — lock Decypharr (`--quick`) then clear cooldown and SeasonSearch.
6. **`kickArrRecover` / `?recover=1`** — POST ReelOS-Decypharr if missing; PUT series to Any when Ultra-HD disallows 720p; then SeasonSearch.
7. **lock-clients.service** — `TimeoutStartSec=180`; OTA copies the unit to systemd.

`/api/performance {low:true}` is Jellyfin trickplay. Not the grab path.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/public_indexers.py --self-test
python3 daemon/reelos-doctor.py --self-test
python3 daemon/stuck-downloads.py --self-test
node --test scripts/public-indexers.test.mjs scripts/reelos-request-status.test.mjs scripts/stack-smoke.test.mjs scripts/wire-provision.test.mjs scripts/stuck-downloads.test.mjs
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.7`. Expect `ReelOS 1.2.50.7 applied.`
3. Doctor releases: must include `ReelOS-eztv` and `ReelOS-showrss`. If you still see only `ReelOS-tpb (missing …)` the hop failed — Rewire engines, do not shrug catalog.
4. B99 S01 / TWD S01: Apply + optional `GET /api/request?recover=1`. Doctor Download lock = `Sonarr → Decypharr`. Available if EZTV/ShowRSS have a 720p+ pack. Interstellar / John Wick / Expanse stay Available.

## Do not

- Cut **1.2.51** (Tron reserved).
- Commit private tracker credentials.
- Invent a progress % on Requests.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
