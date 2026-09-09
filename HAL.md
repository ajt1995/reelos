# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.10** (disabled-client lock + recover scope + ghost/GET reason). Rebased onto **main** after **#62 / 1.2.50.9** (TWD year-gate + NT honesty) and **#63**. Does **not** take 1.2.51 (Tron reserved).

## Why National Treasure can still sit at 0% after a green lock

#61/#62 treat a Decypharr *row* as the grab path. `is_allowed` / doctor `_decypharr_client_ok` match host+port only. A disabled `ReelOS-Decypharr` client is kept, never re-enabled, and Doctor still says `Radarr → Decypharr`. MoviesSearch returns 201 and grabs nothing.

`?recover=1` still listed every monitored 0-file Radarr/Sonarr title. One recover kicked Interstellar / Wick / the whole backlog, not just the Seerr row.

Ghost AVAILABLE (Seerr 5, *arr 0 files) wiped `reason`. GET `/api/request?id=` never returned `reason`, so the title page stayed silent grabbing. Retry flipped local state and never POSTed.

## 1.2.50.10

1. Lock PUTs `enable: true` on a disabled Decypharr client. Doctor and JS treat `enable: false` as missing. Empty downloadclient probes fail closed.
2. `listRecoverTargets` scopes *arr missing rows to Seerr-requested titles when Seerr rows are supplied. Requests do not invent grabbing rows for the rest of the *arr catalog.
3. Ghost demotion keeps a reason. GET-by-id returns `reason`. Retry re-POSTs `/api/request`.

#62 on main still owns TWD year-gate, leftover JF Series heal, unmonitored remonitor, and `Searching — no file yet`. This stamp does not duplicate that.

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52). Then **#65**.
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.10 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.10`.
2. Doctor Download lock is red if Decypharr is disabled or unprobeable — never a silent green.
3. `GET /api/request?recover=1` MoviesSearchs National Treasure only, not every past Radarr movie.
4. Title page + Requests show a reason on ghost / 0-file rows. Retry POSTs.

Do not Apply the Tron feature tarball as if it were main.
