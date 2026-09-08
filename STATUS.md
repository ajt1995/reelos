# STATUS.md

Enlisted Grok. **2026-09-08 04:55 CDT.** Did not edit HAL. No books/Kavita.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main).

## UI audit (Discover / Add / Requests) — movie+TV

Books OUT.

| # | Question | Verdict |
|---|----------|---------|
| 1 | Search calls API + renders? | **PASS** — `DiscoverView` → `GET /api/lookup?q=` → `handleLookup` → Radarr `GET /api/v3/movie/lookup` + Sonarr `GET /api/v3/series/lookup` → `TitleCard` results |
| 2 | Add/request real POST + store/UI? | **PASS** — `TitleView.sendRequest` → `POST /api/request` → `handleRequest` → Radarr `POST /api/v3/movie` or Sonarr `POST /api/v3/series` (`searchForMovie` / `searchForMissingEpisodes`); `requestTitle` inserts local row; Requests/Title poll `GET /api/request` |
| 3 | Progress/status real? | **PASS (after fix)** — status was already API-backed (`handleRequestStatus` / queue / hasFile / episodeFileCount). Progress bars were decorative (fake `42%`, poll zeroed `%`). Fixed: plugin returns queue `progress` (`size`/`sizeleft`); Requests + Title poll apply `progress`/`percent`; `requestTitle` no longer invents `%` |

Activity: `ActivityView` → `GET /api/activity` (wire/ota/journal) — real.

### Residual (not fake bars)

- Cancel/Retry are local store only (no Radarr/Sonarr delete-from-queue).
- Hash paste POSTs `/api/request` but engine handler ignores `hash` (still arr add+search).
- Lab `loadLab()` demo requests remain synthetic.

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## Remaining house blockers

1. **FUSE / Decypharr** — grab→symlink path still hard-stops lab prove without mount.
2. **Apply** — do not phone-Apply this feature branch until Hal names it; prove Logs `files=` / `series=` > 0 after Apply.

## Next

1. House Apply **1.2.47** only when named
2. Lab Decypharr+FUSE if grab→JF must be proven on box
