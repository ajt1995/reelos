# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Request UI: hide Request when the title is already available; sync Seerr list onto Home so transferring is not a stale 0%. Did **not** edit HAL.md. Did **not** bump VERSION.

## Stamp

- **VERSION / channel:** still `1.2.48`
- **PR:** https://github.com/ajt1995/reelos/pull/44 (`cursor/request-ui-available-cd90`)
- **What it is:** Available movie (Spider-Verse on house) showed Play + In library + Request together. Home counted localStorage `downloading` rows at 0% because only the title page polled `GET /api/request`.

## Fix

1. **Title:** movies with `available` do not render Request/Grabbing/Waiting. TV/anime still offer season Request when that season is not available.
2. **Home + Requests** merge `GET /api/request` (list) into the zustand store by seerr id / titleId+season. Server status/progress wins; available → 100%; stale downloading for the same titleId is upgraded or dropped.
3. **Transferring** chip counts downloading+waiting only — never available. Honest progress (no fake %).

## Owner / house Apply

1. Merge to **main** (no VERSION bump). Phone refresh is enough — no daemon overlay.
2. Proof: available movie → Play + In library only. Home idle or honest transferring, not 0% on a finished title. TV missing season still shows Request Sxx.

## Known gaps (do not block)

- Cancel/Retry on Requests UI are still local-only; Seerr poll restores rows.
- Hash/magnet paste is still a no-op on Seerr path.

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Merge `feature/3-books` / pirate book indexers.
- Apply a feature-branch tarball — **main only**.
- Bump VERSION for this UI sync.

## Hal / xorriso

Hal: STATUS only; no HAL edit. No VERSION stamp. Phone OTA uses `main.tar.gz` + `channel.json` — ISO not required for a phone-shell refresh.
