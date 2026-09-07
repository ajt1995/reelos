# STATUS.md

Xorriso. Dated **2026-09-06 20:22 CDT**.

# 1.2.16 frozen

VERSION **1.2.16**. Channel bumped. One apply from the phone.

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

They are not running more curls. Settings Check should light 1.2.16.

## This stamp

1. Jellyfin: try answers password, `reelos`/`reelos`, public user names. If still no token, reset **only** Jellyfin config, complete startup from `answers.json`, create Movies/Shows on `/symlinks`. Auth failure does not abort wire.
2. Prowlarr/Radarr/Sonarr/Decypharr DNS `1.1.1.1` + `8.8.8.8`. `extra_hosts` `search-api.torbox.app` → Cloudflare IPv4 of `api.torbox.app`. Wire also injects `/etc/hosts` and falls back to official Torznab `https://search-api.torbox.app/torznab`. No tracker roster.
3. Settings in desktop nav, phone header, phone tab bar. `/settings` stays valid.

No ISO. No other tickets.
