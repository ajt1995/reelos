# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Phone UI was charcoal/gold and Discover idle was only the Jellyfin shelf — no Seerr trending, easy to look empty. Books lived on stale PRs #40/#42 (dirty / stacked, Standard Ebooks parser dead until #42). Owner asked for a Tron-night overhaul **and** legal Books in the same stamp. Did **not** add Anna’s Archive.

Rebased onto **1.2.50** `main` (PR #51). Stack overlay / FUSE rslave / importPending / mailman canaries stay from that stamp.

## Stamp

- **VERSION / channel:** `1.2.51`
- **PR:** https://github.com/ajt1995/reelos/pull/52 (`cursor/tron-ui-books-2ad2`)
- **Base:** latest `main` **1.2.50** (PR #51 overlay + stack-smoke). Writeup for that stack: `docs/STACK-RISK.md`.
- **What it is:** Tron-night design system across the phone shells + first-class Discover + Kavita/legal Books.

## Discover (must work)

Idle Discover was a pretty empty room if Jellyfin had nothing. That fails this stamp.

1. **Search** still hits live `GET /api/lookup?q=` (Seerr `/api/v1/search`). Typeahead is the primary hit list (no duplicate Results row). Kind filter `movie|tv` is passed through. Tap opens `/title/$id`. Request is the existing `/api/request` path (Seerr/*arr). No fake %. A small **Books** group in the same typeahead hops to `/books?q=` (legal catalogs only).
2. **Idle rows** from `GET /api/discover`: Seerr `/discover/trending`, `/discover/movies`, `/discover/tv`, plus recently added shelf. No in-progress / transferring row — that lives on **Requests** only. Honest error if Seerr has no key. Idle shelves stay visible while typing.
3. **TV seasons** on the title page stay one-season-per-tap (`Request Sxx`). Unchanged contract.

## Books (legal only)

Folded the useful bits of #40 (Kavita compose, wizard chip, Connect card) and #42 (OPDS parser, IA public scans, hardened download) onto latest main.

- Search: Gutenberg (Gutendex), Standard Ebooks OPDS (`/open-access` + query-string hrefs), Open Library `ebook_access=public` → archive.org EPUB.
- Download: HTTPS + host allowlist only. Staged `.part` + 200 MB cap. Path segments cannot traverse.
- Kavita: compose profile `books`, `:5000`, Caddy `/kavita*` (not `/books` — that is the phone tab).
- Settings → Library can toggle Books and `POST /api/intent` starts/stops Kavita.

## UI

Global tokens in `src/styles.css` (cyan / magenta / electric blue / neon-gold on `#03060c`). Page enter, card hover glow, live chips. `prefers-reduced-motion` kills motion. Contrast kept readable (cool white + `#8aa3b8` muted).

Design dialect after polish: chrome select (FilterChip) = cyan glow; commit CTAs stay gold. Books uses `--shadow-magenta` (source chips, Kavita card, Library→Books hop, Discover Books group). Row labels: magenta **In progress** (Requests only — Grabbing / Waiting / Ready words, no invented %), gold **Continue** (Home), cyan otherwise. Discover idle has no active-request chrome. Ready = Watch / open, never Send to Arr. Home after provision says “On the shelf”, not the install slogan. `.tron-grid` breathes via `grid-breathe` (reduced-motion off). Phone header Settings gear has title + cyan glow.

## Stack kept from 1.2.50

`#45`–`#51` already on the rebase base. Mailman overlays house `compose/configs/.` so `#49` seed cannot nest. `#50` importPending + container ENOTCONN / `reelos-mnt-rshared.service`. Stack smoke and mailman canaries stay. Search hop red is still OK.

Settings → **How to watch / read**: Jellyfin on the phone (LAN or Tailscale/MagicDNS) for movies/TV; Kavita `:5000` / `/kavita` for books in `/srv/media/books`. Not TorBox. Connect still holds the QR clutter.

## Owner / house Apply

1. Merge to **main**. Channel tarball stays `main.tar.gz`. VERSION **1.2.51**.
2. Phone Check → Apply (or house CLI `/opt/reelos/bin/reelos-update.sh apply`).
3. Proof:
   - Discover: type a real title → results → title page → Request (TV: pick a season). Idle: trending/popular if Seerr is up.
   - Books: search `dracula` → Add → file under `/srv/media/books`. Open Kavita `:5000`.
   - Nav: Home / Discover / Requests / Library / Books.
   - Stack: Home/Library lean-cached. Finish must not wedge `:8080`. `/api/box` Jellyfin green. Next cached grab should import when FUSE is readable (`#50`). Host listing is not enough — *arr containers must also `ls /mnt/debrid`.

## Tests

```
node --test scripts/books-catalog.test.mjs scripts/reelos-seerr.test.mjs
npx tsc --noEmit
```

## Do not

- Merge `feature/3-books` / pirate book indexers.
- Point Caddy `/books*` at Kavita (steals the phone tab).
- Cut **1.2.52** in the same hour.
- Apply a feature-branch tarball.
- Re-merge `#50` / `#51` (already on `main`).

## Hal / xorriso

Stamp **1.2.51**. Phone OTA uses `main.tar.gz` + `channel.json`. ISO not required for a phone-shell + API refresh.
