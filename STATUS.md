# STATUS.md

**Reelist (cloud test-build).** 2026-09-09. Tron-night UI + legal Books from [#52](https://github.com/ajt1995/reelos/pull/52) rebased onto latest `main` through **1.2.50.6** (public TV indexers + Prowlarr→Sonarr). **HOLD.** Do not merge. Do not house Apply.

## QA gate (Austin 2026-09-09)

Purpose: everything-merged `main` + Books/Tron from rebased #52. **Not** for house Apply. Do **not** lift Tron HOLD.

| Gate | Verdict | Evidence |
| --- | --- | --- |
| **Books legal-only** | **PASS** | Search modules are Gutenberg + Standard Ebooks + IA only. HTTPS allowlist: `gutenberg.org` / `www.gutenberg.org` / `standardebooks.org` / `archive.org` / `*.archive.org`. Unit + live refuse Anna’s Archive, Libgen, LAN, HTTP, arbitrary hosts. |
| Search catalogs | **PASS** (with note) | Live SE + IA rows. Gutendex (`gutendex.com`) is Cloudflare **403** on this VM — Gutenberg search reports unavailable honestly. Gutenberg.org download still works. |
| Download allowlist | **PASS** | `ownsDownload` + `downloadLegalBook` require HTTPS + those hosts. |
| Refuse pirate / LAN | **PASS** | Anna’s Archive, Libgen, `192.168.1.4`, HTTP gutenberg all refused. |
| Kavita / Caddy `/books*` | **PASS** | Kavita on profile `books`, `:5000`, `handle /kavita*` in install + compose Caddyfiles. No `handle /books*`. |
| Tron UI (cloud review) | **PASS** | Phone previews in `docs/tron-previews/`. House stays on 1.2.50.x reliability stamps. |
| TV/movies Request/grab | **expected FAIL** | No private API keys / debrid. **Not a blocker** for this test-build. |

PR: https://github.com/ajt1995/reelos/pull/59 · agent: https://cursor.com/agents/bc-afdf7214-3c42-4bab-a492-241569773b8e

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

Settings → **How to watch / read**: Jellyfin on the phone (LAN or Tailscale/MagicDNS) for movies/TV; Kavita `:5000` / `/kavita` for books in `/srv/media/books`. Not TorBox. Connect still holds the QR clutter.

## Cloud proof (this VM, 2026-09-09)

No TorBox / Seerr / house secrets. **TV/movies Request/grab broken without keys — by design for this run.**

| Check | Result |
| --- | --- |
| Rebase onto `main` 1.2.50.6 (`61a4922`) | Done. 11 #52 commits replayed. Conflicts in stamps, Seerr, lookup, Discover, stack-smoke, HAL/STATUS, sync-requests tests. Reliability from #53–#58 kept. |
| `npm ci` | Green (429 packages) |
| `npx tsc --noEmit` | Green |
| `npm run build` | Green (client + SSR + Nitro). `books-*.js` emitted. |
| `scripts/books-catalog.test.mjs` | **14/14** including Anna’s Archive / Libgen refuse |
| Live `searchLegalBooks` | Standard Ebooks + Internet Archive return real rows (`dracula` / `frankenstein` / `pride and prejudice`). Gutendex (`gutendex.com`) is Cloudflare **403** from this VM — `unavailable: ["Project Gutenberg"]` is honest, not a silent empty shelf. |
| Live download → books dir | Standard Ebooks *Dracula* 633860 B; Gutenberg.org *Frankenstein* 473485 B (direct `www.gutenberg.org`, not Gutendex); IA *Frankenstein* 3560858 B. All under a temp books dir (`Author/Title.epub`). Anna’s Archive refused. |
| Kavita compose / Caddy | Static sanity **OK**: profile `books`, `:5000`, `/srv/media:/media`, `handle /kavita*`, no `handle /books*`. **No Docker** in this VM — did not `compose up` Kavita. |
| `reelos-seerr.test.mjs` + stack-smoke + `sync-requests.test.ts` | Green (Kavita Caddy, Discover no In progress, Grabbing/Waiting/Ready, 1.2.51 stamp + 1.2.50.6 in HAL) |
| `npm test` whole tree | 296/313. **17 failures** are grok-template / `.grok/skills` / app-env fixtures this VM does not ship. Same class of tests exist on `main`. Not a Books/Tron regression. |
| Phone previews | Recaptured at 390×844 with mocked box APIs: `docs/tron-previews/{home,discover,discover-typeahead,books,requests,settings}.png` |

Settings → How to watch / read paints: Jellyfin for movies/TV; Kavita `:5000` / `/kavita`; files in `/srv/media/books`; **Not TorBox**.

## Do not

- Merge to `main` or mark ready-to-merge for the house.
- House Apply this tarball.
- Lift the Tron HOLD.
- Merge `feature/3-books` / pirate book indexers.
- Point Caddy `/books*` at Kavita (steals the phone tab).
- Commit TorBox / Seerr / private tracker secrets.
- Invent a progress % on Requests.
