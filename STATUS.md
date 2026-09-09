# STATUS.md

***Apply actually recreates the stack.*** 2026-09-09. House Apply of **1.2.50.13** swapped the new compose yml then compared it to the tarball (same file) → `compose yml unchanged` → containers stayed **Up 14 hours** with `HostConfig.Dns=1.1.1.1`. DNS-free yml in **1.2.50.14** cannot land unless compose up runs. Stamp **1.2.50.15**. Complements #69 DNS. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.15`
- **Base:** latest `main` (merged #68 = 1.2.50.13) + 1.2.50.14 DNS on this PR
- Did **not** take Tron chrome from #52
- **What it is:** Mailman compose-change vs **pre-swap** `$ROOT.prev/docker-compose.yml`. Do not delete `ota.lock` (inode split = dual Apply). Remount FUSE after compose up before hops. Keep 1.2.50.14 Docker embedded DNS.

## Before / after (house after #68 Apply)

| Surface | After 1.2.50.13 Apply | After Apply 1.2.50.15 |
| --- | --- | --- |
| Stamp | heal_red, still 1.2.50.11 | 1.2.50.15 only if *arr has a search indexer |
| Compose up | skipped (yml vs already-swapped live = equal) | runs when pre-swap yml differs (dns drop) |
| Compose DNS | `dns: 1.1.1.1` hid service names | no override; host resolver still 1.1.1.1 |
| Dual Apply | steal lock by deleting `ota.lock` | second Apply refused |
| FUSE after recreate | hops immediately (can fail-close red) | remount + wait before hops |
| Torznab URL | IP if `compose ps` works; else `prowlarr` (dead) | `http://prowlarr:9696/{id}/` |
| Seerr→Radarr | container IP (stale on recreate) | hostname `radarr` |

## Code changes

1. **`COMPOSE_CHANGED`** — cmp tarball yml vs `$ROOT.prev/docker-compose.yml`, not live `$ROOT/compose` (already swapped).
2. **`ota.lock`** — if `flock -n` fails, refuse. Never `rm` the lock file.
3. **FUSE after compose up** — `nudge_fuse` + `wait_fuse` before hops; longer Jellyfin wait when compose changed.
4. **1.2.50.14 DNS** — still on this PR: drop per-container `dns:`; strip in wire; hostname Torznab/Seerr.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-request-status.test.mjs scripts/public-indexers.test.mjs scripts/stack-smoke.test.mjs scripts/jellyfin-seed.test.mjs scripts/wire-provision.test.mjs scripts/reelos-update.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**. Tarball `main.tar.gz`. Compose **yml changed** — expect a stack recreate, then FUSE remount.
2. `cat /opt/reelos/VERSION` → `1.2.50.15`. Expect `ReelOS 1.2.50.15 applied.`
3. Doctor Request hop / Sonarr indexers must not stay Prowlarr-only green.
4. National Treasure recover must add the Radarr row.

## Do not

- Cut **1.2.51** (Tron reserved).
- Merge this PR from the agent.
- Tap Apply twice.
- Wipe `/media` local-disk libraries.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
