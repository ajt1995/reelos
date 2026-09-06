# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 17:13 CDT**. VERSION **1.2.15**. No 1.2.16. No ISO. No tracker roster.

## Still broken for first movie

Prowlarr stock schema often has **no** TorBox indexer. `ensure_provider_indexer` then logs `no first-party indexer` and returns. Request stays empty. Doctor must not go green.

## Fix

1. If schema has no match for `torbox` / `real-debrid` / etc, install the **vendor's official Prowlarr definition** (TorBox publishes `torbox-prowlarr-indexers`). Drop the YML into Prowlarr's custom Definitions folder, restart Prowlarr, then add `ReelOS-torbox` with `answers.apiKey`. Same idea for RD if a first-party/official definition exists. Do not scrape random sites. Do not ship a list of trackers.
2. If add still fails, Doctor `releases` stays red and wire.log has the line. Never silent.
3. After a successful grab (`downloaded`), `POST` Jellyfin `/Library/Refresh` so Watch is not dead for ten minutes.
4. `/api/provision` compose timeout 180s is too short on a cold pull. Wait or pre-pull images; fail with the compose log, not a hang.

Then freeze. Same apply curl.
