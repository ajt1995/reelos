# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 19:38 CDT**. VERSION stays **1.2.15**.

## Exception — on `main` (house is live)

HP is on 1.2.15. Jellyfin answers but has **zero libraries**. Doctor `releases` is red (`Provider indexer missing`). Lookup hop timed out once.

Do this on **`main`**. Then freeze again. No 1.2.16. Do not merge parked branches.

1. `wire-engines.py` must **retry** Jellyfin VirtualFolders until Movies (and Shows if intent.tv) exist with path `/symlinks`. Complete Startup if needed. Low-perf flags stay off. Do not send them to the Jellyfin wizard.
2. Same pass: retry `ReelOS-torbox` (official YML + add). Doctor `releases` must be able to go green.
3. `POST /api/wire` runs `wire-engines.py` again (409 if OTA running). Settings can call it. House can `curl` it without a full Apply.

Parked tickets stay on feature branches.
