# STATUS.md

***Movie dump folders collapse into Title (Year).*** 2026-09-09. House Jellyfin Movies showed Interstellar×3 and John Wick×2 because Decypharr left release-named dirs next to Radarr’s `Interstellar (2014)`. TV season-folder collapse already existed; movies did not. Stamp **1.2.50.20**. Complements #71. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.20`
- **Base:** current `main` (1.2.50.19 / #71)
- Did **not** take Tron chrome from #52 / #70
- **What it is:** `collapse_movie_named_dumps` parks `Title.Year.2160p…` / `Title (Year) [YTS.MX]` into `Title (Year)` under `/mnt/symlinks/radarr` only. Remakes keep the year (Dune 1984 ≠ 2021). `heal_movie_dump_items` deletes leftover Jellyfin Movie rows for those dump paths. Never `/media`. Heal runs in `heal_after_import` after *arr scan.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.20`.
3. Jellyfin Movies is one Interstellar, one John Wick, one Museum.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media`
