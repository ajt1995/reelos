# STATUS.md

***Tron-night phone chrome + Books file download.*** 2026-09-09. Stamp **1.2.51**. Phone Read is a real file download (`Content-Disposition: attachment`) so iOS/Android offer Apple Books / Kindle / Drive. Kavita is the box library (profile `books`, off like Music), not a ReelOS in-app player. Legal catalogs stay allowlisted in grab code. Movie/TV grab-path, Discover unowned Seerr (`GET /api/discover`), wizard Finish, OTA mailman, and Docker DNS are unchanged from **1.2.50.18**.

## Stamp

- **VERSION / channel:** `1.2.51`
- **Base:** `origin/main` after #69 (1.2.50.18)
- Reused Tron chrome from #52 (tokens, FilterChip cyan, magenta Books, Settings gear glow, How to watch accordion). **Rewrote** Books Read: no “Open Kavita as the only path”; Download hits `/api/books/file` (shelf) or `/api/books/fetch` (allowlisted catalog → disk + phone attachment). OPDS at `/api/books/opds`.
- Did **not** take #52 daemon/grab-path hunks, Discover-as-shelf, or `intent.books !== false` (Books is off by default).

## Books

- Wizard + Settings intent chip, off like Music.
- Kavita `linuxserver/kavita` on compose profile `books`, files in `/srv/media/books`. No per-container `dns:`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Discover typeahead Books group hops to `/books?q=` when Books is on. Browse stays unowned Seerr. In-progress stays on Requests. Ready for a movie/TV is Watch (Jellyfin). Ready for a book is Download.

## Do not

- Edit **HAL.md**.
- Merge to main / tell the house to Apply this stamp (1.2.50.18 Apply is another chat).
- Re-inject compose `dns: 1.1.1.1`. Delete `ota.lock`. Wipe `/media`.
