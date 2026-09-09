# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.51 candidate** (Tron-night UI + legal Books on **1.2.50.6** `main`). **HOLD.** Cloud test-build only. Do not merge. Do not house Apply. Do not lift the Tron HOLD.

**QA (Austin 2026-09-09):** Books legal-only **PASS**. TV/movies Request/grab **expected FAIL** without keys — not a blocker. Tron visual OK for cloud review. House stays on 1.2.50.x.

## xorriso — do this

1. Review this draft test-build PR. Do **not** merge to `main`. Channel tarball on `main` stays `main.tar.gz` at **1.2.50.6**.
2. Books is legal catalogs only (Gutenberg, Standard Ebooks, Internet Archive public scans) + Kavita. No Anna’s Archive / Libgen. No private book keys.
3. TV/movie Request/grab **will be broken or mocked** in this cloud VM — no TorBox / Seerr / house secrets. That is expected. Do not fake live debrid e2e.
4. Hold Tron redesign for production. Do not wipe TorBox. Do not paste private tracker keys.
5. Discover typeahead (when previewed): `/api/lookup` hits + a Books group hopping to `/books?q=`. Idle shelves stay visible while typing. Active grabs live on **Requests** only.

## Proof on this test-build (no house keys)

1. Tree stamp `VERSION` → `1.2.51` (candidate). `main` remains `1.2.50.6`.
2. Books: catalog search/list against Gutenberg / Standard Ebooks / Internet Archive. Download writes under the books dir allowlist. Kavita compose profile + Caddy `/kavita*` (not `/books`). **This VM:** SE + IA search live; Gutendex 403 (honest unavailable); Gutenberg.org + SE + IA downloads wrote `Author/Title.epub`. Pirate hosts refused.
3. Phone chrome is Tron-night (cyan/magenta/neon-gold on black). Previews in `docs/tron-previews/`.
4. Discover/Request/Seerr paths keep 1.2.50.1–1.2.50.6 honesty (one-season TV POST, no invented %, SeasonSearch, public TV indexers). They need house keys to grab — **TV/movies broken without keys — by design for this run.**

Do not Apply this feature-branch tarball as if it were main.
