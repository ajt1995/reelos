# STATUS.md

Xorriso. Dated **2026-09-06 21:52 CDT**.

# 1.2.23 frozen

1.2.22 canary correctly refused applied. Wire reached Prowlarr too soon (104), then POST got Cloudflare **530** because `extra_hosts` pinned `search-api.torbox.app` to `api.torbox.app`’s A (`172.66.170.114`).

## This stamp

1. Compose: `dns: 1.1.1.1/8.8.8.8` only. No `extra_hosts`. Wire strips a pinned file on the box and recreates Prowlarr.
2. Wait until `GET /api/v1/indexer` returns 200 before POST. YML install waits again after restart.
3. Canary: enabled `ReelOS-torbox` **and** indexer test is not 530/resolve. Doctor keeps the Prowlarr 530 line (does not overwrite with STAMP FAIL).

No `applied.` until that test is green. No #7. No ISO.
