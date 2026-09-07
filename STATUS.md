# STATUS.md

Xorriso. Dated **2026-09-07 16:56 CDT**.

# 1.2.36

House: Apply sat on `prowlarr up` for minutes. Script logged "compose yml unchanged" then still ran `docker compose up`, waited on Prowlarr, wire-engines, and indexer tests.

If compose.yml did not change: skip compose up, skip Prowlarr wait, skip wire, skip indexer canary. Stamp VERSION. Home 200 is success.

If compose.yml changed: old path (up, wire, canary log — canary no longer blocks applied).
