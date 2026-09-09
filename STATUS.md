# STATUS.md

***arr search indexer attach + Seerr→Radarr add + JF token.*** 2026-09-09. House **1.2.50.11** after #64+#66. Honesty works; grab path broken: Prowlarr-only green, Radarr/Sonarr no search indexer, NT `Requested — Radarr has no movie yet`, JF VirtualFolders HTTPError. Stamp **1.2.50.12**. Complements #64/#66. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.12`
- **Base:** latest `main` (merged #64 + #66 = 1.2.50.11)
- Did **not** take Tron chrome from #52
- **What it is:** Apply actually attaches searchable indexers to Sonarr and Radarr after Prowlarr fullSync. Recover/POST adds an orphan Seerr movie to Radarr via lookup/tmdb. Doctor JF libraries hop sends MediaBrowser Token headers.

## Before / after (house 1.2.50.11)

| Surface | Before | After Apply 1.2.50.12 |
| --- | --- | --- |
| Prowlarr fullSync | Apps may be disabled; command no-ops; *arr empty | `enable` + `forceSync` + Torznab attach if still empty |
| Request hop | Radarr has no search indexer | YTS/TPB searchable on Radarr |
| Sonarr indexers | No enabled indexer | TPB (not RSS-only EZTV) searchable |
| NT seerr-9 / tmdb-2059 | `Requested — Radarr has no movie yet` | recover/POST adds the movie then MoviesSearch |
| JF libraries | `Cannot read virtual folders (HTTPError)` | MediaBrowser Token= + re-auth |

## Code changes

1. **`public_indexers` / wire-engines 02+09** — Radarr sync cats, forceSync, `ensure_arr_search_indexers` Torznab attach.
2. **`addRadarrMovie`** — `/movie/lookup/tmdb?tmdbId=` then POST.
3. **doctor / wire-engines JF** — `jellyfin_auth_headers` / `jellyfin_headers` with Token=.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-request-status.test.mjs scripts/public-indexers.test.mjs scripts/stack-smoke.test.mjs scripts/jellyfin-seed.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.12`. Expect `ReelOS 1.2.50.12 applied.`
3. Doctor Request hop / Sonarr indexers must not stay Prowlarr-only green.
4. National Treasure recover must add the Radarr row.

## Do not

- Cut **1.2.51** (Tron reserved).
- Merge this PR from the agent.
- Storm the whole *arr backlog on recover.
- Duplicate #62 TWD heal / #64 lock enable / #66 OTA heal stamp.
- Wipe `/media` local-disk libraries.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
