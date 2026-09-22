# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.13** (*arr Torznab attach actually lands). Stacked on **#67 / 1.2.50.12**. Does **not** take 1.2.51 (Tron reserved).

## Why 1.2.50.12 missed the house

Apply of #67 on 100.100.154.16 heal_red'd correctly and did **not** stamp. Prowlarr publics were green (eztv/showrss/tpb/yts). Radarr and Sonarr still had **zero** enabled search indexers. NT stayed `Requested — Radarr has no movie yet`.

#67 mocked `post()` → True. Real *arr:

1. Tests the indexer on add unless `?forceSave=true`. Caps against `http://prowlarr:9696/{id}/` 400s (compose `dns: 1.1.1.1` can hide Docker service names; test-on-add fails either way).
2. Hand-rolled Torznab body (no `/indexer/schema` clone, no `minimumSeeders` / `supportsSearch`) 400s `'Categories' must be provided`.
3. `400` + indexer name was treated as attached. Re-read stayed empty → heal red (honest).
4. `ApplicationIndexerSync` was fire-and-forget, so Prowlarr never finished pushing before attach gave up.

## 1.2.50.13

1. Clone *arr Torznab schema. POST/PUT `?forceSave=true`. 400+name is **not** attached.
2. Wait for `ApplicationIndexerSync` to complete. Prowlarr/`*arr`/Seerr URLs use the container IP so compose `dns: 1.1.1.1` cannot hide service names. Do not put `127.0.0.11` in `dns:` (it can loop Docker's embedded resolver and break public indexer lookups).
3. Seerr→Radarr add (lookup/tmdb, tmdbId-matched) is unchanged. NT recover still adds only the requested movie.

## xorriso — do this

1. Merge this onto **main** after #67. Separate from Tron #52.
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.13 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.13`.
2. Doctor Request hop / Sonarr indexers green only when *arr has an enabled search indexer (not Prowlarr-only, not RSS-only EZTV).
3. National Treasure: recover/POST adds the Radarr row (reason leaves `no movie yet`).
4. Heal red still blocks the stamp.

Do not Apply the Tron feature tarball as if it were main.
