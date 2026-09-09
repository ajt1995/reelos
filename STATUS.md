# STATUS.md

**Reelist (Discover→Request honesty on 1.2.50.4).** 2026-09-09. Fold-in after #56 merge (SeasonSearch + recover hop). Separate from Tron #52. Stamp **1.2.50.5**.

## Stamp

- **VERSION / channel:** `1.2.50.5`
- **Base:** latest `main` (merged #56 = 1.2.50.4)
- Did **not** take Tron chrome from #52
- **What it is:** Discover search no longer looks like an empty shelf while Seerr is looking or timed out. TV `POST /api/request` is one season (`[n]` or S01), never `seasons: "all"`. Live TMDB/Seerr ids do not get a lab **Cached** glow. Unit sandbox locks Austin’s 4-title 2012–2016 gate: Interstellar + The Martian + Brooklyn Nine-Nine S01 + Mr. Robot S02 → search → Seerr POST → honest 0% / AVAILABLE.

## Kept from 1.2.50.4 (#56)

- SeasonSearch on TV POST add/reuse when the season has 0 files.
- `GET /api/request?recover=1`. stuck-downloads searches/relinks 0-file monitored seasons.
- lock-download-clients keeps Decypharr dumps. Honest unfinished TV when Seerr is empty.

## House QA hole this stamp closes

- Discover typed ≥2 chars and immediately said “No titles from Seerr” (debounce + fetch + AbortError all looked empty).
- TV POST without a season asked Seerr for **all** seasons (hash paste omitted season).
- No unit proof that four 2012–2016 TMDB titles survive lookup→request without a year filter or fake %.
- Discover search cards glowed **Cached** for every live `tmdb-*` id (`titleInCache` treated them as lab catalog).

## Code changes (this stamp)

1. **`mapSeerrSearchResults` / `normalizeMediaType`** — person/collection dropped; `Movie`/`TV` still map. **No year filter.**
2. **`buildSeerrAddPayload` / `tvSeasonsForRequest`** — TV always `[season]` or `[1]`. Never `"all"`.
3. **`GET /api/lookup`** — 45s Seerr search; `AbortError` → “Seerr lookup timed out. Try the search again.”
4. **Discover** — Looking up… / real error / results. Title cards stay request-free (no In progress).
5. **Title hash paste** — includes the selected TV season.
6. **`ERA_QA_TITLES` / `proveEraLookupRequest`** — Interstellar (2014), The Martian (2015), Brooklyn Nine-Nine S01 (2013), Mr. Robot S02 (2015).
7. **`titleInCache`** — live `tmdb-` / `tvdb-` / `jf-` ids are never lab-Cached.

## Residual (no code change)

- Live e2e (2 random 2012–2016 movies + 2 TV seasons on the house box) still needs Seerr/TMDB/*arr/TorBox. Agent has no house secrets.
- Discover **shelf** TV from Jellyfin still prefers `tvdb-*` when TMDB is present. Request from an unfinished shelf series can 400 (“Search again”) — use Discover **search** (`tmdb-tv-*`).
- Seerr down / no API key still returns empty titles with an error string. House hop must read `error`, not only `titles.length`.
- `TimeoutStartSec=infinity` + hung `cp`/`npm ci`/`compose up` can leave `running: true` forever.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/reelos-seerr.test.mjs scripts/reelos-request-status.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts src/lib/adapter.test.ts
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.5`. Expect `ReelOS 1.2.50.5 applied.`
3. Discover: search two 2012–2016 movies and two 2012–2016 shows. Results, not an empty shelf or a silent timeout.
4. Request each movie. Request **one season** of each show. Seerr → Radarr/Sonarr. Requests: AVAILABLE / Grabbing / Waiting — no fake %.
5. Discover cards stay free of In progress and **Cached** glow on live TMDB ids (that stays on Requests / title).

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests or Discover.
- Change season-by-season TV UX back to all-at-once.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
