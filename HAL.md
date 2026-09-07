# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 20:55 CDT**.

## Ship **1.2.18**. One apply. They will not debug DNS.

House is on **1.2.17**. Factory reset fixed Jellyfin. Doctor still:
- `releases` yellow — Provider indexer missing
- Lookup hop TimeoutError (3s probe — false alarm)

`docker-compose.yml` on `main` still has **no** `dns:` / `extra_hosts` on Prowlarr. Wire poking `/etc/hosts` inside the container does not survive and did not make `ReelOS-torbox` exist.

### Do this

1. Compose for Prowlarr, Radarr, Sonarr, Decypharr: `dns: [1.1.1.1, 8.8.8.8]` and `extra_hosts` for `search-api.torbox.app` (and `api.torbox.app` if needed) to a live Cloudflare IPv4. Must be in the compose file so `compose up` keeps it.
2. After up, `ReelOS-torbox` must exist in Prowlarr. Official YML and/or torznab `https://search-api.torbox.app/torznab` with their key. 400 Name does not resolve is a failed stamp, not a log line you ignore.
3. Doctor `releases` is green only when Prowlarr has that indexer **and** a test/search does not return resolve-error. Lookup hop must not use a 3s timeout — 15s or drop that hop.

Bump `VERSION` + `channel.json` to **1.2.18**. No ISO. No other tickets.
