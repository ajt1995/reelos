# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.11** (OTA heal stamp + doctor hops + kick/pipeline honesty). Stacked on **#64 / 1.2.50.10** (rebased onto main after **#62 / 1.2.50.9** + **#63**). Does **not** take 1.2.51 (Tron reserved).

## Why Apply could still lie after a green stamp

`reelos-update.sh` treated `wire-engines.py indexers` / `import` as non-fatal and printed `ReelOS $REMOTE applied.` anyway. The same Apply collapsed season dumps then scanned/refreshed them back. Doctor Jellyfin was TCP :8096. Request hop was Radarr port+key. Releases hop was Prowlarr’s list (TorrentRss EZTV is not SeasonSearch). `stuck-downloads` skipped unmonitored titles and never lock/widened. `kickArrRecover` always `{ ok: true }`. `pipeline.radarrMissing` ignored Seerr orphans/unmonitored.

#62 on main still owns TWD year-gate / leftover JF Series heal / NT reason text. #64 still owns lock enable / recover scope / ghost+GET reason / Retry POST.

## 1.2.50.11

1. Heal/indexer failure sets `HEAL_FAIL` and does **not** print applied.
2. Indexers hop does not collapse dumps. Import scans, then `heal_after_import` collapses + JF refresh once.
3. Doctor: JF VirtualFolders + dump paths (token required). Request hop: Decypharr client + search indexer + movie lookup. Sonarr hop: search-capable indexer, not RSS-only.
4. Timer remonitors + `--quick` lock + Ultra-HD→Any before SeasonSearch/MoviesSearch.
5. `kickArrRecover` / POST `ok` follows command truth. `pipeline.radarrMissing` lists Seerr orphans/unmonitored.

Merge **#64**, then this.

## xorriso — do this

1. Merge **#64** onto **main**, then this (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.11 applied.` Heal red must not stamp.
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.11`.
2. A failed JF/indexer heal must log `not printing applied — jellyfin/indexer heal red` and leave the previous VERSION.
3. Doctor Jellyfin libraries / Request hop / Sonarr indexers are red when paths/client/search are missing — not TCP-green.
4. National Treasure: `pipeline.radarrMissing` includes `tmdb-2059` when Radarr has no movie or it is unmonitored. POST recover `ok` is false if MoviesSearch did not queue.

Do not Apply the Tron feature tarball as if it were main.
