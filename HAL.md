# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.12** (*arr search indexer attach + Seerr→Radarr add + JF VirtualFolders token). Stacked on **#64 / 1.2.50.10** + **#66 / 1.2.50.11**. Does **not** take 1.2.51 (Tron reserved).

## Why the grab path stayed broken after honesty

Doctor after #64+#66 told the truth: Prowlarr publics were green, Download lock was green, National Treasure said `Requested — Radarr has no movie yet`. ApplicationIndexerSync without `enable`/`forceSync` left Sonarr and Radarr with no search indexer. Recover waited for a Radarr row then looked up `term=tmdb:2059` (empty) instead of `/movie/lookup/tmdb`. Doctor VirtualFolders sent `X-Emby-Token` alone — JF 10.10+ HTTPError, libraries hop false-red.

## 1.2.50.12

1. Prowlarr apps stay **enabled + fullSync**. Radarr gets movie cats + 8000. `ApplicationIndexerSync` sends `forceSync`. If *arr is still empty, Apply Torznab-attaches searchable Prowlarr indexers (TPB/YTS, not RSS-only EZTV) and turns search flags on.
2. Movie recover/POST uses `/movie/lookup/tmdb?tmdbId=` then POSTs the movie. Seerr-scoped — does not re-add the backlog.
3. Doctor (and wire-engines) read VirtualFolders with `Authorization: MediaBrowser … Token=`. Re-auth from answers if the cached token 401s.

## xorriso — do this

1. Merge this onto **main** after #64+#66. Separate from Tron #52.
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.12 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.12`.
2. Doctor Request hop / Sonarr indexers green only when *arr has an enabled search indexer.
3. National Treasure: recover/POST adds the Radarr row (reason leaves `no movie yet`).
4. Doctor Jellyfin libraries reads VirtualFolders with the token — not HTTPError when folders are fine.

Do not Apply the Tron feature tarball as if it were main.
