# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.51** (Tron UI + Discover + legal Books). Rebased onto **1.2.50** `main` (PR #51 overlay / FUSE / OTA stack). Do not merge `feature/3-books` / pirate indexers.

## xorriso — do this

1. Merge this tip → **main**. Channel tarball = `main.tar.gz`. VERSION **1.2.51**.
2. Books is legal catalogs only (Gutenberg, Standard Ebooks, Internet Archive public scans) + Kavita. No Anna’s Archive / Libgen.
3. Owner phone: Settings → Check → Apply.
4. Proof:
   - Phone chrome is Tron-night (cyan/magenta/neon-gold on black). Home / Discover / Library / Requests / Settings / title share the system.
   - Discover idle shows Seerr trending/popular (or an honest Seerr error) plus in-progress requests and recently added. Search hits `/api/lookup`, opens a title page, Request still season-by-season for TV.
   - Books tab search returns real catalog rows; Add writes under `/srv/media/books`. Kavita on `:5000` / `/kavita`.
   - Stack from **1.2.50** stays: Home/Library lean `/api/library`. Finish does not wedge `:8080`. `/api/box` Jellyfin **green**. Cached TorBox grab imports when FUSE is readable (`retry import`). Host `ls /mnt/debrid` is not enough — *arr containers must also list (rslave / `reelos-mnt-rshared.service`). Search hop red is OK.

Do not Apply a feature-branch tarball. Do not cut 1.2.52 in the same hour. Mailman from #48 stays fail-open on search.
