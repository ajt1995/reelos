# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.9** (TWD season-year Home merge + leftover JF Series heal + National Treasure honest 0%). Does **not** take 1.2.51 (Tron reserved).

## Why Home still doubled TWD after 1.2.50.8

#61 stripped `S01` / `- Season 1` so both rows keyed `tv:thewalkingdead`. Then `dedupeLibraryTitles` refused the merge because years 2010 vs 2011 differ (`s.year === year`). Season-folder PremiereDate ≠ series start year is common. B99 was already unique (same year). Opus’s `aliasSafe` guard for two real-id series is fine — a **jf-only** season-folder row must merge with the tvdb/tmdb series even when years disagree.

House `/api/library` after Apply of 1.2.50.8:

1. `The Walking Dead - Season 1` year=2011 id=`jf-…` ids=`[jf-…]` only
2. `The Walking Dead` year=2010 id=`tvdb-153021` ids=`[tmdb-1402, tvdb-153021, jf-…]`

Jellyfin itself still had the season-named Series item: heal only dumped season-named dirs when the series folder already had media, and never deleted/renamed leftover Series entries.

## Why National Treasure still sat on downloading@0

After Apply+recover: tmdb-2059 / seerr-9 still `downloading@0` `engine=grabbing`. `pipeline.radarrMissing=[]` (Radarr has a row). Download lock now shows Radarr→Decypharr. Honesty only spoke when Radarr had **no** movie or **no** client — so a 0-file movie with a client stayed silent. MoviesSearch may not have stuck (unmonitored, quality floor, or search ran with nothing grabbed).

## 1.2.50.9

1. Year gate skips for a season-folder alias. Remakes with real ids + different years stay two rows. Anime split seasons with different tvdb/tmdb stay two rows.
2. Apply: move season-folder dump media onto the series folder (even an empty stub), then drop the season-named dir. Delete a jf-only season-folder Series when the real series exists; rename it when it is the only leftover. Anime split ids stay. Jellyfin's `DELETE /Items` removes the files too, so the item heal only ever names a season-named directory **inside a dump root** — a `/media` local-disk row and a canonical series folder are refused.
3. Requests: always say why a 0-file movie is 0% (`Searching — no file yet` / unmonitored / quality / queue). Recover monitors an unmonitored Seerr movie and MoviesSearchs.

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.9 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.9`.
2. `GET /api/library`: one Walking Dead (2010 / tvdb-153021). One Brooklyn Nine-Nine. Dune-style remakes still two rows.
3. Jellyfin Shows matches Home — no leftover `The Walking Dead - Season 1` Series. A `local`/`both` house still has every `/media/tv` folder it started with.
4. National Treasure: Requests shows a real reason (not silent 0%). `?recover=1` monitors + MoviesSearchs.

Do not Apply the Tron feature tarball as if it were main.
