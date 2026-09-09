# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.1** (TV season import). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.1 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign until a season request completes (Walking Dead S01 is the proof title).
5. Do not wipe TorBox. Search hop red is OK.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.1`.
2. Cancel the extra TWD S01 row if it is still `seerr-4` / 0%. One season request is enough.
3. Stuck log / wire log must **not** list Museum (or other radarr dumps) as `sonarr manualimport unmatched sample`.
4. Next Sonarr import of TWD S01: `sonarr manualimport matched=` > 0, then `sonarr series … files=` > 0. Title becomes Play on the phone.
5. `docker exec reelos-sonarr-1 ls /mnt/debrid` still works (keep #50 rshared heal).

Do not Apply the Tron feature tarball as if it were main.
