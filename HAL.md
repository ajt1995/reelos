# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 21:34 CDT**.

## QC canary — next stamp after 1.2.21 lands (or patch 1.2.21 if they have not applied yet)

House is done being the test rig.

`daemon/reelos-update.sh` after wire, before `echo applied`:

If `answers.source` is a debrid provider (torbox / real-debrid / …):
1. Prowlarr must list an **enabled** indexer named `ReelOS-<source>` (`ReelOS-torbox` on this house).
2. If it does not: **do not print** `ReelOS x.x.x applied.` Log the Prowlarr/`releases-error.txt` line. Exit non-zero (or rollback shell if Home is also dead). Yellow `releases` is a **failed OTA**, not a footnote.
3. Home 200 is not enough. That was 1.2.20.

If they are mid-1.2.21 apply, let it finish. Then this canary is **1.2.22** and nothing else — no #7 merge, no ISO.

Doctor `releases` green and this canary are the same fact.
