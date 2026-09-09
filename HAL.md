# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.3** (regression audit + empty-dump recovery on shipped 1.2.50.2). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.3 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Search hop red is OK.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.3`.
2. If Stage is slow: `ota.log` prints `still copying node_modules (15s…)` — not a frozen last line.
3. If `/mnt/symlinks/sonarr` was empty and FUSE still has TWD: `wire.log` `relink created sonarr/… from FUSE`, then `sonarr manualimport matched=` > 0. Museum stays under radarr.
4. Night at the Museum on Requests stays **Available**. Title page: S01 Play does not hide Request S02. No 42%.
5. `docker exec reelos-sonarr-1 ls /mnt/debrid` still works (#50).

Do not Apply the Tron feature tarball as if it were main.
