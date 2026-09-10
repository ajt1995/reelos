# STATUS.md

***Movie dump folders collapse into Title (Year).*** 2026-09-09. House Jellyfin Movies showed Interstellar×3 and John Wick×2. This VM’s live stack had the same mess plus patterns the first 1.2.50.20 patch missed: `Dune Part One (2021) [2160p]` next to `Dune (2021)`, and `Brooklyn Nine-Nine (2013) Season 1 S01 (1080p AMZN…)`. ReelOS Library hid the dupes; Jellyfin Movies did not. Stamp **1.2.50.20**. Complements #71. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.20`
- **Base:** current `main` (1.2.50.19 / #71)
- Did **not** take Tron chrome from #52 / #70
- **What it is:** `collapse_movie_named_dumps` parks `Title.Year.2160p…` / `Title (Year) [YTS.MX]` / `Dune Part One (Year) [2160p]` into `Title (Year)` under `/mnt/symlinks/radarr` only. Remakes keep the year (Dune 1984 ≠ 2021). Part Two is not Part One. TV collapse now strips `Season 1 S01 (1080p…)` and a trailing `(Year)` so the pack lands on `Brooklyn Nine-Nine`. After collapse, `heal_merge_movie_versions` POSTs Jellyfin `/Videos/MergeVersions` so two files in one folder are versions, not two posters. Never `/media`. Heal runs in `heal_after_import` after *arr scan.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.20`.
3. Jellyfin Movies is one Interstellar, one Dune, one Matrix — not the phone shelf (that already hid dupes).

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media`
