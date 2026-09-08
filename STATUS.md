# STATUS.md

Xorriso. **2026-09-08 02:19 CDT.** Did not edit HAL. Did not merge 1.2.47.

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`. Movies play.

## main = 1.2.46 (Apply this)

Enlisted Grok already hardened ManualImport **on main** (still stamp 1.2.46): messy `SxxExx`, title fallback, wait for `episodeFileCount`. Phone **Check → Apply**. Channel is `main.tar.gz`.

## feature/1.2.47-manualimport-harden

Not merged. No PR. Leave it until Hal names a merge. Do not Apply from a feature-branch URL.

## xorriso will not

Merge 47. Cut 1.2.48. Touch HAL. Re-wizard. Seed indexers.

Acceptance: Logs `files=` and `series=` not zero, then play it. Curl-only is not enough.
