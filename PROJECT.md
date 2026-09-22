# Project: ReelOS Cinema OS Transformation & Native Streaming Engine (historical plan)

> **Historical, not current authority.** This plan predates the recovered repository’s active scope and source policy. Read [`AGENTS.md`](AGENTS.md) and run `npm run context:brief` before relying on it.

## Architecture
ReelOS is a zero-Docker, zero-VM native cinema operating system and neural streaming engine running natively on Node.js and modern web browsers.
- **Frontend Architecture**: React 19 + Vite + Tailwind CSS v4. Edge-to-edge desktop viewport (`w-full px-6 md:px-12 lg:px-16`) with widescreen multi-column poster grids (responsive up to 2K/4K), docked top-0 fluid glass navigation, F11/Maximize Cinema toggle, stealth auto-hiding scrollbars, and full-bleed hero banners.
- **Streaming Pipeline**: Unified 1-Tap Play/Stream button flow. Instant debrid availability check via TorBox / ReelFlow (`triggerReelFlowFulfill`), in-place progress caching badge ("Caching 4K Stream · X%"), auto-resuming next unplayed episode for TV series, direct episode-level streaming, end-of-stream retention velvet card (>80% completion "Keep in Library?"), and resident Sub/Dub sovereignty auto-selecting audio/subtitle tracks.
- **Metadata & TV Lookup**: Direct Cinemeta (`v3-cinemeta.strem.io/meta/series/:id.json`) and TMDB fallback pipeline in `/api/lookup` and `scripts/reelos-episodes.mjs`, guaranteeing complete season trees and episode arrays with zero Overseerr/Sonarr dependency. Complete eradication of synthetic dummy records.
- **Taste & Recommendation Engine**: Endless streaming bubble calibration with 4-way affinity (❤️ Love, 👍 Like, ☕ Comfy, ✕ Dismiss), pinned viewport finish button, resident shelf persistence (`favorites`, `likes`, `cozy`), and first-visit Home marquee pinning tray.
- **Editorial Synthesis**: Dynamic Criterion-standard blurb generator in `src/lib/personalized-hooks.ts` ingesting genuine TMDB metadata (genres, director, synopsis motifs, release era, rating, cast) + resident cinema taste with an expansive vocabulary matrix guaranteeing zero identical phrasing.
- **Catalog Discovery**: Dynamic Reel Roulette candidate multi-tier seeding (`shelf` -> `remoteTitles` -> curated `TITLES` -> TMDB discover) ensuring zero empty-shelf bails.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Edge-to-edge Desktop Layout | Expand containers to `w-full px-6 md:px-12 lg:px-16` | M1 | Survey 1 |
| 2 | 2K/4K Multi-Column Poster Grids | Extended breakpoints (3xl/4xl/5xl) with up to 10 columns | M1 | Survey 1 |
| 3 | Full-Bleed Hero Presentation | Widescreen hero artwork without negative-margin hacks | M1 | Survey 1 |
| 4 | Fullscreen Cinema Toggle | Desktop shell Maximize/Minimize button with F11 listener | M1 | Survey 1 |
| 5 | Stealth Auto-Hiding Scrollbars | Thin 6px transparent scrollbars with auto-fading thumbs | M1 | Survey 1 |
| 6 | Fluid Top Navigation Clearance | Docked `top-0 h-16 w-full` header eliminating bleed & overlaps | M1 | Survey 1 |
| 7 | Unified 1-Tap Play/Request Button | Banish disabled gates; pulse/spin & transition to playback | M2 | Survey 2 |
| 8 | In-Place Stream Caching Badge | Inline "Caching 4K Stream · X%" badge with zero modals | M2 | Survey 2 |
| 9 | Direct TorBox / ReelFlow Resolution | Replace `seerrApiKey()` 503 check in `/api/request` | M2 | Survey 2 |
| 10| TV Series Resume & Episode 1-Tap | Auto-resume next episode; direct Play on episode rows | M2 | Survey 2 |
| 11| Resilient Cinemeta/TMDB TV Lookup | Fix `/api/lookup` and `loadSeasonEpisodeList` | M2 | Survey 2 |
| 12| Synthetic Dummy Record Elimination | Eradicate `{ id: "dummy", title: "Dummy" }` in progress plugin | M2 | Survey 2 |
| 13| Endless Bubble Calibration | Uncapped streaming candidate pool with real-time learning | M3 | Survey 3 |
| 14| 4-Way Affinity Reactions | Love (❤️), Like (👍), Comfy (☕), Dismiss (✕) | M3 | Survey 3 |
| 15| Pinned Bottom Finish Button | Viewport-pinned "Finish Calibration Whenever →" bar | M3 | Survey 3 |
| 16| Resident Taste Shelf Population | Auto-populate resident Favorites, Likes, Cozy shelves | M3 | Survey 3 |
| 17| First-Visit Home Marquee Pinning | 1-time curated marquee tray on Home; 1-tap pin 3–5 titles | M3 | Survey 3 |
| 18| Dynamic Criterion Editorial Blurbs | Deep-metadata synthesis with expansive vocabulary matrix | M4 | Survey 3 |
| 19| Reel Roulette Dynamic Discovery | Never bails on empty shelf; multi-tier catalog & TMDB seeding | M4 | Survey 3 |
| 20| End-of-Stream Retention Velvet Card | >80% completion "Keep in Library?" card in cinema-player | M2 | Austin Directive |
| 21| Resident Sub/Dub Sovereignty | Auto-select audio/subtitle tracks per resident preference | M2 | Austin Directive |
| 22| E2E Multi-Tier Verification & Audit | `node --test`, `verify:ground-truth`, `cmd /c npm run build` | M5 | Survey 1-3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Cinema OS Desktop Shell & Layout | R1 edge-to-edge layout, 2K/4K grids, full-bleed hero, F11 toggle, stealth scrollbars, R7 navbar clearance | None | IN_PROGRESS |
| M2 | Native Streaming Engine & TV Architecture | R2 unified 1-tap play flow, in-place caching badge, TorBox /api/request, TV resume/episode plays, R6 TV season lookup, R7 dummy eradication, end-of-stream retention card, resident sub/dub sovereignty | None | IN_PROGRESS |
| M3 | Endless Taste Calibration & Marquee Pinning | R3 endless bubble game, 4-way affinity, pinned finish bar, resident shelf auto-population, R4 first-visit Home marquee pinning tray | M1 | PLANNED |
| M4 | Dynamic Editorial Blurbs & Roulette Discovery | R5 Criterion-grade deep-metadata synthesis engine, R7 Reel Roulette dynamic multi-tier seeding | None | IN_PROGRESS |
| M5 | Verification, Hardening & Forensic Audit | Full test suite (`node --test`), ground truth compliance, production Vite build, forensic anti-facade audit | M1, M2, M3, M4 | PLANNED |

## Code Layout & Write Boundaries
- **Milestone 1 (Worker 1)**:
  - `src/styles.css`
  - `src/components/shell.tsx`
  - `src/components/library-view.tsx`
  - `src/components/discover-browse-view.tsx`
  - `src/components/requests-view.tsx`
  - `src/components/settings-view.tsx`
  - `src/components/collection-view.tsx`
  - `src/components/person-view.tsx`
  - `src/components/discover-view.tsx`
- **Milestone 2 (Worker 2)**:
  - `scripts/reelos-lookup-plugin.mjs`
  - `scripts/reelos-episodes.mjs`
  - `scripts/reelos-request-progress-plugin.mjs`
  - `src/components/season-episode-accordion.tsx`
  - `src/components/title-view-live.tsx`
  - `src/components/cinema-player.tsx`
- **Milestone 3 (Worker 3)**:
  - `src/lib/store.ts`
  - `scripts/services/profile-service.mjs`
  - `src/components/taste-primer.tsx`
  - `src/components/mindful-concierge-wizard.tsx`
  - `src/components/marquee-pinning-tray.tsx`
  - `src/components/home-view.tsx`
- **Milestone 4 (Worker 4)**:
  - `src/lib/personalized-hooks.ts`
  - `src/lib/personalized-hooks.test.ts`
  - `src/components/reel-roulette.tsx`
- **Milestone 5 (Auditor & Reviewers)**:
  - Read-only review across all changed files; executes test suites and static analysis.
