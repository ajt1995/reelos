# STATUS.md

Xorriso. Dated **2026-09-06 21:02 CDT**.

# 1.2.18 frozen

VERSION **1.2.18**. One apply.

## This stamp

1. `install/compose/docker-compose.yml` **and** `compose/docker-compose.yml` have `dns: 1.1.1.1/8.8.8.8` and `extra_hosts` for `search-api.torbox.app` + `api.torbox.app` on Prowlarr/Radarr/Sonarr/Decypharr. OTA copies from tarball then `compose up --force-recreate` with those profiles. Wire patches the on-box yml if extra_hosts is missing and recreates if the running container does not have them.
2. `ReelOS-torbox` is added after that (official YML and/or torznab). `Name does not resolve` recreates arrs and retries. Still missing → `STAMP FAIL` in wire.log.
3. Doctor `releases` is green only if that indexer is enabled **and** Prowlarr `/indexer/test` is not a resolve-error. Lookup hop timeout is **15s**.

No ISO. No other tickets.
