# STATUS.md

***Docker DNS: *arr can resolve each other.*** 2026-09-09. House still **1.2.50.11** after Apply of **1.2.50.13** heal_red (no stamp). Channel 1.2.50.13 fetched; hops green; `indexers heal red`. `docker compose ps` ETIMEDOUT; Torznab fell back to hostname `prowlarr` which `dns: 1.1.1.1` cannot resolve. Stamp **1.2.50.14**. Complements #68. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.14`
- **Base:** latest `main` (merged #68 = 1.2.50.13)
- Did **not** take Tron chrome from #52
- **What it is:** Drop per-container `dns: 1.1.1.1` so Docker embedded DNS (`radarr` / `prowlarr` / `decypharr` / `seerr`) works. Stop wire from re-injecting that block. Keep #68 forceSave/schema.

## Before / after (house after #68 Apply)

| Surface | After 1.2.50.13 Apply | After Apply 1.2.50.14 |
| --- | --- | --- |
| Stamp | heal_red, still 1.2.50.11 | 1.2.50.14 only if *arr has a search indexer |
| Compose DNS | `dns: 1.1.1.1` hid service names | no override; host resolver still 1.1.1.1 |
| Torznab URL | IP if `compose ps` works; else `prowlarr` (dead) | `http://prowlarr:9696/{id}/` |
| Seerr→Radarr | container IP (stale on recreate) | hostname `radarr` |
| Download lock | host `decypharr` (unresolvable) | hostname `decypharr` resolves |

## Code changes

1. **compose yml twins** — remove per-container `dns:`. Do not put `127.0.0.11` in `dns:`.
2. **`ensure_compose_dns`** — strips the 1.1.1.1 block. Does **not** write it back.
3. **`docker_service_ip`** — `docker inspect` by name (house `compose ps` timed out). URLs prefer hostnames.
4. **Indexer hop** — skip `research_missing` when attach already failed (no ManualImport storm on a red heal). OTA copies last wire heal lines into `ota.log`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-request-status.test.mjs scripts/public-indexers.test.mjs scripts/stack-smoke.test.mjs scripts/jellyfin-seed.test.mjs scripts/wire-provision.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply. Tarball `main.tar.gz`. Compose **yml changed** — expect a stack recreate.
2. `cat /opt/reelos/VERSION` → `1.2.50.14`. Expect `ReelOS 1.2.50.14 applied.`
3. Doctor Request hop / Sonarr indexers must not stay Prowlarr-only green.
4. National Treasure recover must add the Radarr row.

## Do not

- Cut **1.2.51** (Tron reserved).
- Merge this PR from the agent.
- Tap Apply twice (this dump was dual-apply).
- Wipe `/media` local-disk libraries.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
