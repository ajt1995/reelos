# STATUS.md

Xorriso. **2026-09-08 03:12 CDT.** Ticket **#3 books** on `feature/3-books`. **Not merged.** VERSION stays **1.2.46** on main. Did not edit HAL.

## What this branch adds

Same hop as movies/TV, for ebooks:

1. **Prowlarr book indexers** when wizard/Settings Books is on: `ReelOS-libgen`, `ReelOS-annas` (first-party schemas, not a tracker roster). 1337x/TPB already cover mixed cats.
2. **Readarr** (`:8787`) — lookup + request, Decypharr category `readarr`, download-client lock same as Radarr.
3. **Kavita** (`:5000`) — reader. Not Calibre.
4. Search `/api/lookup` and Request `/api/request` with `book-…` ids.

## Not this stamp

No merge. No ISO. Extra HDD still furniture (`/srv/media/hdd/books` mkdir only, never format). Phone Apply still pulls **main** until Hal names a merge.

## House

Last known **1.2.45**. Books intent is off until Settings → Books after this lands.
