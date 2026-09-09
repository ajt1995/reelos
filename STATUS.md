# STATUS.md

***arr Torznab attach actually lands.*** 2026-09-09. House **1.2.50.11** after #67 Apply of 1.2.50.12 heal_red (no stamp). Prowlarr green; Radarr/Sonarr empty; NT `Requested — Radarr has no movie yet`. Stamp **1.2.50.13**. Complements #67. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.13`
- **Base:** latest `main` (merged #67 = 1.2.50.12)
- Did **not** take Tron chrome from #52
- **What it is:** Apply persists searchable indexers on Sonarr and Radarr. #67's POST never saved a row on the real house.

## Before / after (house after #67 Apply)

| Surface | After 1.2.50.12 Apply | After Apply 1.2.50.13 |
| --- | --- | --- |
| Stamp | heal_red, still 1.2.50.11 | 1.2.50.13 only if *arr has a search indexer |
| Prowlarr | eztv/showrss/tpb/yts PASS | unchanged |
| Request hop | Radarr has no search indexer | YTS/TPB searchable on Radarr |
| Sonarr indexers | no enabled indexer | TPB (not RSS-only EZTV) searchable |
| NT seerr-9 / tmdb-2059 | `Requested — Radarr has no movie yet` | recover/POST adds via lookup/tmdb |

## Code changes

1. **`public_indexers` / wire-engines 02+09** — schema clone, `forceSave`, honest 400, sync wait, container IP (compose `dns: 1.1.1.1` left alone).
2. **Seerr hostname** — PUT when hostname/apiKey drift so Seerr can reach Radarr.
3. **House HTTP test** — Prowlarr green + *arr empty after 400-name "attach" stays heal red; schema+forceSave lands.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-request-status.test.mjs scripts/public-indexers.test.mjs scripts/stack-smoke.test.mjs scripts/jellyfin-seed.test.mjs scripts/wire-provision.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.13`. Expect `ReelOS 1.2.50.13 applied.`
3. Doctor Request hop / Sonarr indexers must not stay Prowlarr-only green.
4. National Treasure recover must add the Radarr row.

## Do not

- Cut **1.2.51** (Tron reserved).
- Merge this PR from the agent.
- Storm the whole *arr backlog on recover.
- Duplicate #62 TWD heal / #64 lock enable / #66 OTA heal stamp / #67 attach attempt.
- Wipe `/media` local-disk libraries.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
