# STATUS.md

**House honesty + leftover JF aliases.** 2026-09-09. House 1.2.50.7 after #60: National Treasure requested (seerr-9) still `downloading@0` with `pipeline.radarrMissing=[]`; Home `/api/library` still listed Brooklyn Nine-Nine twice (`tvdb-269586` + `… S01`) and The Walking Dead twice (`tvdb-153021` + `… - Season 1`); Jellyfin itself still showed those season-folder series. Year-aware title dedupe from #60 was not enough. Stamp **1.2.50.8**.

## Stamp

- **VERSION / channel:** `1.2.50.8`
- **Base:** latest `main` (merged #60 = 1.2.50.7)
- Did **not** take Tron chrome from #52
- **What it is:** Home one row per real title (season-folder aliases collapse; remakes with different years stay). Apply heals leftover Jellyfin virtual folders / extra paths and drops season-named dump dirs under `/mnt/symlinks/sonarr` when the series folder already has media. **Keeps `/media` on local/both.** Movie POST/reuse/`?recover=1` locks Decypharr, widens Ultra-HD (or falls back to Any), **adds the movie to Radarr if Seerr never pushed it**, then MoviesSearch. Requests show why when Radarr has no movie or no grab client.

## Before / after (house 1.2.50.7)

| Surface | Before | After Apply 1.2.50.8 |
| --- | --- | --- |
| Home `/api/library` | `Brooklyn Nine-Nine` **and** `Brooklyn Nine-Nine S01`; `The Walking Dead` **and** `The Walking Dead - Season 1` | One B99, one TWD. `Dune (1984)` / `Dune (2021)` still two rows |
| Jellyfin Shows | Same double series (season-folder dumps next to imported series; leftover extra libraries/paths after #60) | Extra virtual folders deleted once their paths are safe to lose (keep-paths like `/media/movies` migrate onto Movies first; a `/media` path we cannot hand over keeps the library). Season-named dumps under `/mnt/symlinks/sonarr` removed only when the series folder already has media. `/media` not wiped |
| Requests · National Treasure (tmdb-2059) | Seerr reuse, `downloading@0`, `radarrMissing=[]`, MoviesSearch never locked a client / never added the movie | Honest reason if Radarr has no row or no Decypharr client. Recover adds+MoviesSearch after lock/quality, same hop TV already had for SeasonSearch |

## Code changes

1. **`reelos-library.mjs`** — `stripSeasonFolderSuffix` so `Title S01` / `Title - Season 1` share a shelf key with `Title`. Year-aware remake split from #60 unchanged.
2. **`wire-engines` Jellyfin heal** — `extra_jellyfin_libraries` + `delete_jellyfin_library`; `collapse_season_named_dumps` (sonarr dump root only, allowlist is a parameter not an env var). `plan_extra_library_drop` is the gate: a leftover library is deleted only when every path it holds is already on the canonical library, is a keep-path we migrate first, or is a `/symlinks`/`/mnt/symlinks` dump view. Any other `/media` path on a local/both house blocks the delete, and nothing is deleted before the canonical library exists. `jellyfin_keep_paths` still keeps `/media` for local/both.
3. **`kickArrRecover` movies** — `ensureMovieGrabPath` (Decypharr client + Ultra-HD→Any) then MoviesSearch. `addRadarrMovie` when Seerr requested but Radarr has no row. `?recover=1` also kicks Seerr movie orphans.
4. **Honesty** — `Requested — Radarr has no movie yet` / `No grab client — search cannot land` on the downloading row (not a fake %). Doctor Download lock probes Radarr too.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
node --test scripts/reelos-library.test.mjs scripts/reelos-request-status.test.mjs scripts/reelos-seerr.test.mjs scripts/jellyfin-seed.test.mjs scripts/relink-dumps.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.8`. Expect `ReelOS 1.2.50.8 applied.`
3. Home: one Brooklyn Nine-Nine, one Walking Dead. Jellyfin Shows the same. `/media/movies` still on Movies if the wizard kept files on disk.
4. Request National Treasure again or `GET /api/request?recover=1`. Should MoviesSearch (and add to Radarr if missing). Requests must not sit on silent `0%` if Radarr never got the movie.

## Do not

- Cut **1.2.51** (Tron reserved).
- Wipe `/media` local-disk libraries.
- Invent a progress % on Requests.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
