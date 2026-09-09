# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.3** (regression audit on shipped 1.2.50.2). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.3 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Search hop red is OK.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.3`.
2. `ota.log` during Stage 3: `copying node_modules…` then `still copying node_modules (15s…)` if the copy is slow — not a frozen last line.
3. Title page: TWD S01 available does **not** mark S02 available. Request from title page never shows **42%**.
4. Night at the Museum on Requests stays **Available** (1.2.50.2 honesty).
5. Next TWD S01 import still `sonarr manualimport matched=` > 0 (1.2.50.1). `docker exec reelos-sonarr-1 ls /mnt/debrid` still works (#50).

Do not Apply the Tron feature tarball as if it were main.
