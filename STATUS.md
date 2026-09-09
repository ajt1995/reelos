# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Home/Library sat empty ~13s on launch because `/api/library` re-authed Jellyfin, pulled Recursive Movie/Series **with Overview**, and the zustand shelf was neither persisted nor refreshed. Did **not** edit HAL.md. Did **not** bump VERSION.

## Stamp

- **VERSION / channel:** still `1.2.48`
- **PR:** (this branch `cursor/library-cold-path-857b`)
- **What it is:** Cold Home showed “Nothing in Jellyfin yet…” until a large Items payload finished. Home only paints `shelf.slice(0, 24)`.

## Fix

1. **Lean Items query:** `Fields=ProviderIds` only (no Overview), `EnableImages=false`, `EnableTotalRecordCount=false`. Home calls `GET /api/library?limit=24`.
2. **Jellyfin token TTL cache** (10 min, keyed by user/PIN). Cleared on PIN change.
3. **Stale-while-revalidate:** last real titles in memory + `/var/lib/reelos/library-shelf.json`. Return immediately; refresh in background. Empty Jellyfin stays empty — no invented rows.
4. **Client:** persist `shelf`; `hydrateShelf` always refreshes (in-flight dedupe). Limited Home merge does not shrink a larger Library shelf. Empty copy is “Loading library…” until the first fetch.

## Owner / house Apply

1. Merge to **main** (no VERSION bump). Phone refresh is enough — no daemon overlay.
2. Proof:
   - `time curl -sS 'http://127.0.0.1:8080/api/library?limit=24' >/dev/null` — first hit lean; second hit should be milliseconds from cache.
   - `time curl -sS 'http://127.0.0.1:8080/api/library' >/dev/null` — after a Home visit, full list from cache or one lean uncached pull.
   - Phone: cold open Home paints last titles (or Loading… then real posters). Pull-to-refresh / revisit updates from Jellyfin. Library still lists real titles only.

## Known gaps (do not block)

- Title overview for Jellyfin-only rows comes from Seerr `/api/lookup`, not the shelf payload.
- Posters still load one-by-one from `:8096`.

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Merge `feature/3-books` / pirate book indexers.
- Apply a feature-branch tarball — **main only**.
- Bump VERSION for this UI/API lean-up.

## Hal / xorriso

Hal: STATUS only; no HAL edit. No VERSION stamp. Phone OTA uses `main.tar.gz` + `channel.json` — ISO not required for a phone-shell refresh.
