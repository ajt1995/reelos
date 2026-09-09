# STATUS.md

**Reelist (cloud test-build).** 2026-09-09. Tron-night UI + legal Books from [#52](https://github.com/ajt1995/reelos/pull/52) rebased onto latest `main` through **1.2.50.6** (public TV indexers + Prowlarr→Sonarr). **HOLD.** Do not merge. Do not house Apply.

## Stamp

- **VERSION / channel:** `1.2.51` (candidate / test-build)
- **Base:** latest `main` **1.2.50.6** (`61a4922`, #58)
- **Source:** #52 `cursor/tron-ui-books-2ad2` recreated on that tip
- **What it is:** Tron-night design system + first-class Discover chrome + Kavita/legal Books, stacked on every reliability stamp already merged (`#45`–`#58`).

## Intentionally broken (no house secrets)

TV and movie **Request / grab / TorBox / Seerr** are broken or mocked in this cloud VM. No TorBox, Seerr, or house keys were added. Do not treat a failed grab as a Books or Tron regression.

## What passed here (Books, no private keys)

- Legal catalogs only: Gutenberg (Gutendex), Standard Ebooks OPDS, Internet Archive public scans.
- Download: HTTPS + host allowlist. Staged `.part` + size cap. No path traversal. No Anna’s Archive / Libgen.
- Kavita: compose profile `books`, `:5000`, Caddy `/kavita*` (not `/books` — that is the phone tab).
- Settings → How to watch / read (Jellyfin for movies/TV, Kavita for books) when present.

## Discover / Requests (code kept from 1.2.50.x; live grab not this run)

1. **Search** hits live `GET /api/lookup?q=` when Seerr has a key. Typeahead is the primary hit list; kind `movie|tv` is passed through. Honesty from 1.2.50.5: timeout/empty is not a silent empty shelf. No Cached glow on live TMDB ids. Books group hops to `/books?q=`.
2. **TV POST** is one season (`seasons: [n]`, never `all`). SeasonSearch + `?recover=1` from 1.2.50.4. Import/symlink from 1.2.50.1.
3. **Requests** tell the truth (1.2.50.2): status words are **Grabbing / Waiting / Ready**. No invented %. Ready → Watch. Active grabs live on **Requests** only — Discover idle has no In progress row.
4. **Public TV indexers** (1.2.50.6): EZTV/ShowRSS + Prowlarr `fullSync`. YTS is movies-only. No private tracker credentials.

## UI

Global tokens in `src/styles.css` (cyan / magenta / electric blue / neon-gold on `#03060c`). Page enter, card hover glow, live chips. `prefers-reduced-motion` kills motion. Contrast kept readable (cool white + `#8aa3b8` muted).

Design dialect: chrome select (FilterChip) = cyan glow; commit CTAs stay gold. Books uses `--shadow-magenta`. Discover typeahead is the hit list (plus Books hop to `/books?q=`). Idle Seerr shelves stay visible while typing. Discover idle has no In progress chrome — that lives on Requests as Grabbing / Waiting / Ready. Ready = Watch, never Send to Arr.

## Tests

```
node --test scripts/books-catalog.test.mjs scripts/reelos-seerr.test.mjs
npx tsc --noEmit
```

## Do not

- Merge to `main` or mark ready-to-merge for the house.
- House Apply this tarball.
- Lift the Tron HOLD.
- Merge `feature/3-books` / pirate book indexers.
- Point Caddy `/books*` at Kavita (steals the phone tab).
- Commit TorBox / Seerr / private tracker secrets.
- Invent a progress % on Requests.
