# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.4** (TV recover extras on shipped 1.2.50.3). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.4 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Search hop red is OK.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.4`.
2. In-flight or new `POST /api/request` TWD S01 → **one** downloading S01 row at 0%. Reuse of an empty Sonarr season still `SeasonSearch`s.
3. `GET /api/request?recover=1` once. `GET /api/activity`:
   - `relink created` / `relink N links` if FUSE has TWD
   - then `sonarr manualimport … folder=/mnt/symlinks/sonarr rows>0 matched>0`
   - else `SeasonSearch The Walking Dead S01`
4. That S01 row → **Available / Play**. Library still Museum. Title page: S01 Play does not hide Request S02. No 42%.
5. `docker exec reelos-sonarr-1 ls /mnt/debrid` still works (#50).

Do not Apply the Tron feature tarball as if it were main.
