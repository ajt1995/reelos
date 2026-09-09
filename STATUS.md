# STATUS.md

**Reelist (EZTV/ShowRSS actually land).** 2026-09-09. House 1.2.50.6 doctor: releases **ReelOS-tpb only**. B99 S01 + TWD S01 still `sonarr-missing@0` after SeasonSearch. `#58` claimed OTA adds EZTV/ShowRSS; Cardigann schema miss + doctor first-pass-test hid it. Stamp **1.2.50.7**.

## Stamp

- **VERSION / channel:** `1.2.50.7`
- **Base:** latest `main` (merged #58 = 1.2.50.6)
- Did **not** take Tron chrome from #52
- **What it is:** OTA POSTs EZTV/ShowRSS via native **TorrentRss** when Cardigann schema is missing, fullSyncs Sonarr, doctor lists **every** enabled indexer (TPB-only is a fail), hybrid Sonarr allows 720p WEB-DL, SeasonSearch re-fires after sync.

## Root cause (code)

| Layer | What 1.2.50.6 did | What the house showed |
| --- | --- | --- |
| `ensure_public_indexers` | POST only if `_schema_blob` contains `eztv` / `showrss` | Cardigann YAML often not in `/indexer/schema`. Native `Torrent RSS Feed` does not match. Log `no schema`, continue. |
| Doctor `releases_hop` | Live `indexer/test`, return **first** success name | **ReelOS-tpb**. Cannot see EZTV missing. |
| Hybrid quality | Map wizard `hybrid` → Sonarr **Ultra-HD** (2160p-only) | EZTV 720p WEB-DL rejected even if the indexer existed. Expanse 4K packs pass. |
| SeasonSearch cooldown | `SEARCH_INTERVAL_SEC=900` after first 0-file search | After EZTV lands, B99 waits 15 minutes (or forever if lock-clients failed). |

Not a duplicate sandbox Sonarr. Not “just catalog.” Movies + Expanse already Available via Decypharr.

## Code changes

1. **`public_indexers.py`** — `pick_add_plan` / `plan_adds`: TPB/YTS-only house with only TorrentRss schema still POSTs ReelOS-eztv + ReelOS-showrss RSS bodies. `doctor_releases_detail` fails closed if those names are missing. `widen_hybrid_profile_items` allows 720p/1080p/2160p.
2. **`ensure_public_indexers`** — Cardigann POST, then **rss fallback**. Verify required TV names. Log the full doctor detail.
3. **Doctor** — list every enabled indexer. No `indexer/test` first-pass. TPB-only → `ok: false`.
4. **`widen_sonarr_hybrid`** — PUT Ultra-HD in place (same profile id on B99/TWD).
5. **`--research-missing`** — clear `missing:*` SeasonSearch cooldown and sweep immediately after indexer sync.

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
4. B99 S01 / TWD S01: SeasonSearch runs on this Apply (not the next 15min tick). Available if EZTV/ShowRSS/TorBox have a 720p+ pack. Interstellar / John Wick / Expanse stay Available.

## Do not

- Cut **1.2.51** (Tron reserved).
- Commit private tracker credentials.
- Invent a progress % on Requests.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
