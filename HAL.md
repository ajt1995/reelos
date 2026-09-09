# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.8** (Home/JF season-folder aliases; National Treasure MoviesSearch honesty). Does **not** take 1.2.51 (Tron reserved).

## Why Home still doubled B99 / TWD after 1.2.50.7

#60 keyed Home dedupe on `kind:title` + year. Jellyfin also listed the same show as a season-folder series with no Tvdb id:

- `Brooklyn Nine-Nine` (`tvdb-269586`) vs `Brooklyn Nine-Nine S01` (`jf-…`)
- `The Walking Dead` (`tvdb-153021`) vs `The Walking Dead - Season 1` (`jf-…`)

Those keys never collided. Movies (Interstellar / Wick / Museum) were already unique.

Jellyfin itself still showed the extras because leftover virtual folders/paths from overlapping dumps survived Apply, and `/mnt/symlinks/sonarr` still had season-named dump dirs next to the imported series folder.

## Why National Treasure sat on downloading@0

Seerr had `seerr-9` (tmdb-2059). `pipeline.radarrMissing=[]` — Radarr had no 0-file row to recover. POST reuse waited for a Radarr movie that never appeared, skipped MoviesSearch, and did not lock Decypharr / widen Ultra-HD the way TV SeasonSearch does after #60. UI showed `0%` with no reason.

## 1.2.50.8

1. Collapse trailing `S01` / `Season 1` folder names on `/api/library`. Remakes with different years stay separate.
2. Apply: drop extra Jellyfin libraries, but only once every path they hold is safe to lose — keep-paths migrate onto Movies/Shows first, dump views (`/symlinks`, `/mnt/symlinks`) just go, and any other `/media` path on a `local`/`both` house **blocks the delete**. Remove season-named sonarr dumps only when the series folder already has media. **Do not wipe `/media`.**
3. Movie recover: add to Radarr if missing, lock client, quality fallback, MoviesSearch. Honest request reason when the hop never ran.

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.8 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.8`.
2. `GET /api/library`: one Brooklyn Nine-Nine, one Walking Dead. Dune-style remakes still two rows if both years exist.
3. Jellyfin Shows matches Home. Movies library still has `/media/movies` on a local/both house.
4. National Treasure: recover adds/searches; Requests says `Requested — Radarr has no movie yet` or `No grab client — search cannot land` instead of a silent 0% if that hop is still missing.

Do not Apply the Tron feature tarball as if it were main.
