# STATUS.md

**TWD season-year leftover + NT silent 0%.** 2026-09-09. House after Apply of **1.2.50.8** (#61, tip `1de6263`): Home `/api/library` still listed two Walking Dead rows (`The Walking Dead - Season 1` 2011 jf-only + `The Walking Dead` 2010 tvdb-153021). B99 unique. Jellyfin still had the season-named Series. National Treasure (tmdb-2059, seerr-9) still `downloading@0` with `pipeline.radarrMissing=[]` and Radarr→Decypharr locked. Stamp **1.2.50.9**.

## Stamp

- **VERSION / channel:** `1.2.50.9`
- **Base:** latest `main` (merged #61 = 1.2.50.8)
- Did **not** take Tron chrome from #52
- **What it is:** Home merges a jf-only season-folder row onto the real series even when PremiereDate year ≠ series start. Remakes / anime split seasons with real ids stay separate. Apply heals leftover JF Series items (delete or rename), not only dump dirs. Requests never sit on silent 0% — reason is searching / unmonitored / quality / queue. Recover monitors and MoviesSearchs.

## Before / after (house 1.2.50.8)

| Surface | Before | After Apply 1.2.50.9 |
| --- | --- | --- |
| Home `/api/library` | TWD 2010 **and** `TWD - Season 1` 2011 jf-only. B99 already unique | One TWD (keep tvdb-153021 / 2010). Remakes with real ids still two rows |
| Jellyfin Shows | Season-named Series leftover after dump-only heal | jf-only season-folder Series deleted when the real series exists; renamed when it is the only leftover. Season dump media moves onto the series folder first |
| Requests · National Treasure (tmdb-2059) | `downloading@0`, no reason, client locked, Radarr has a row | Reason on the row. Recover monitors if needed, then MoviesSearch |

## Code changes

1. **`reelos-library.mjs`** — `yearsCompatible` / `isSeasonFolderAlias`: year gate does not block a season-folder alias. `aliasSafe` still keeps two real-id series apart.
2. **`wire-engines` Jellyfin heal** — `plan_season_folder_item` + `heal_season_folder_items` (DELETE / rename leftover Series). `collapse_season_named_dumps` moves media onto an empty series stub, then drops the season-named dir.
3. **`movieRequestReason`** — after no-movie / no-client: unmonitored, quality floor, queue, else `Searching — no file yet`.
4. **`kickArrRecover` / `listUnmonitoredMovieRecoverTargets`** — monitor a Seerr movie Radarr left unmonitored, then MoviesSearch. GET recover refreshes facts after the kick.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
python3 daemon/lock-download-clients.py --self-test
node --test scripts/reelos-library.test.mjs scripts/reelos-request-status.test.mjs scripts/reelos-seerr.test.mjs scripts/jellyfin-seed.test.mjs scripts/relink-dumps.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.9`. Expect `ReelOS 1.2.50.9 applied.`
3. Home: one Walking Dead. Jellyfin Shows the same. `/media/movies` still on Movies if the wizard kept files on disk.
4. Requests · National Treasure must show why it is 0%, and `GET /api/request?recover=1` must MoviesSearch.

## Do not

- Cut **1.2.51** (Tron reserved).
- Wipe `/media` local-disk libraries.
- Invent a progress % on Requests.
- Merge two real-id series that only share a season-suffix name.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
