# STATUS.md

Xorriso. Dated **2026-09-06 17:16 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. No tracker roster. **Stop committing.**

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

## This pass

- If Prowlarr schema has no TorBox hit, fetch **official** `TorBox-App/torbox-prowlarr-indexers` YML into `configs/prowlarr/Definitions/Custom`, restart Prowlarr, add `ReelOS-torbox` with the wizard key. Not a scrape. Not a roster. RD/AD/PM only if they publish the same.
- Add failure stays in `wire.log`. Doctor `releases` stays red.
- `downloaded` → `POST` Jellyfin `/Library/Refresh`.
- Provision: `compose pull` (15m) then `up` (5m). Fail with the compose log.

## Sandbox (no engines)

```
curl -sS http://127.0.0.1:8080/api/doctor
# releases: No release source. Provider indexer missing.

curl -sS http://127.0.0.1:8080/api/lookup?q=batman
# {"titles":[],"error":"Movies/TV engines have no API key yet"}
```

No fake HP curls.
