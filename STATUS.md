# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Stack-audited `#45`–`#50` so house Apply of the combined tree does not undo mailman, shelf, Finish-detach, or JF12 auth. `#50` already on `main` (`c3fa807`). This tip is overlay + named stamp **1.2.50**. Austin allowed VERSION + HAL/STATUS for a coherent house Apply.

## Stamp

- **VERSION / channel:** `1.2.50`
- **PR:** https://github.com/ajt1995/reelos/pull/51 (`cursor/stack-audit-a560`)
- **Writeup:** `docs/STACK-RISK.md` (go/no-go + merge order)
- **What it is:** `#45`–`#50` already on main (1.2.49). This tip overlays house `compose/configs` so `#49`'s seed cannot nest `configs/configs`, retargets stale mailman canaries, and names the stacked Apply.

## Fix

1. Rebased onto latest `main` (`c3fa807`). Duplicate `#50` commits dropped — they are already there (importPending + container ENOTCONN / `reelos-mnt-rshared.service`).
2. Mailman overlays house `compose/configs/.` onto staging (daemon + install twins). `#50` rshared enable-after-swap kept.
3. Stack smoke: lockfile `SKIP_NPM` + JF12 `Authorization` + `#46` cache + Finish no `spawnSync` pull + advisory search hop + importPending retry + rshared unit + parts twins.
4. Retargeted three stale mailman `need()` canaries so push-time `check-ota.py` is green.

## Owner / house Apply

**GO.** Merge `#51` → `main`. One Check→Apply. No house SSH required.

See `docs/STACK-RISK.md`. Short form:

1. Merge to **main**. Channel tarball stays `main.tar.gz`. VERSION **1.2.50**.
2. Phone Check→Apply. Must print `ReelOS 1.2.50 applied.` Search hop red is OK.
3. Home/Library still lean-cached. Finish must not wedge `:8080`.
4. `/api/box` Jellyfin green. Next cached grab should import when FUSE is readable (`#50`). Host listing is not enough — *arr containers must also `ls /mnt/debrid`.

## Do not

- Re-merge `#50` (already on `main` at `c3fa807`).
- Apply a feature-branch tarball — **main only**.
- Cut **1.2.51** in the same hour.
- Scope into TorBox wipe / pirate books.

## Hal / xorriso

Hal: stamp **1.2.50** in HAL.md. Phone OTA uses `main.tar.gz` + `channel.json`. ISO not required for this Apply.
