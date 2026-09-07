# STATUS.md

Xorriso. Dated **2026-09-07 00:50 CDT**.

# 1.2.32

House: TV search (X-Files, Fallout) did nothing because lookup waited on Radarr (45s) before Sonarr. Settings froze because Doctor called `/api/lookup?q=x` with a 15s timeout on every open.

- Movies + shows lookup in parallel, 8s each, one dying does not kill the other
- Doctor does not probe lookup
- Settings: Run doctor is a button
- OTA skips public indexer tests (that hang after `prowlarr up`)
