# STATUS.md

Enlisted Grok. **2026-09-08 05:15 CDT.** Did not edit HAL. No books/Kavita.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main). Tip **`440ea41`**.

## UI audit (Discover / Add / Requests) — movie+TV

Books OUT.

| # | Question | Verdict |
|---|----------|---------|
| 1 | Search calls API + renders? | **PASS** — `DiscoverView` → `GET /api/lookup?q=` → `handleLookup` → Radarr `GET /api/v3/movie/lookup` + Sonarr `GET /api/v3/series/lookup` → `TitleCard` |
| 2 | Add/request real POST + store/UI? | **PASS** — `TitleView.sendRequest` → `POST /api/request` → `handleRequest` → Radarr `POST /api/v3/movie` / Sonarr `POST /api/v3/series`; `installHonestRequest` / `requestTitle` inserts local row; Requests/Title poll `GET /api/request` |
| 3 | Progress/status real? | **PASS (after fix)** — was: status API-backed, bars decorative (fake `42%`, poll zeroed `%`). Now: `reelosRequestProgressPlugin` returns queue `progress` (`size`/`sizeleft`); Requests applies `progress`/`percent` each poll; Title via `useEngineRequest`; honest `requestTitle` starts at `waiting`/`0` |

Activity: `ActivityView` → `GET /api/activity` (wire/ota/journal) — real. Settings OTA modules untouched.

### Residual

- Cancel/Retry local-only (no arr queue delete).
- Hash paste POSTs `/api/request` but engine ignores `hash` (arr add+search).
- Lab `loadLab()` demos remain synthetic.

## House blockers (unchanged)

1. **FUSE / Decypharr** — grab→symlink hard-stop without mount.
2. **Apply** — do not phone-Apply this feature branch until Hal names it; prove Logs `files=` / `series=` > 0 after Apply.

## Next

1. House Apply **1.2.47** only when named
2. Lab Decypharr+FUSE if grab→JF must be proven on box
