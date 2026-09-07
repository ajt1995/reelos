# STATUS.md

Xorriso. Dated **2026-09-06 20:35 CDT**.

# 1.2.17 frozen

VERSION **1.2.17**. One apply. They will not run daemon-reload by hand.

## This stamp

1.2.16 work stays (Jellyfin owner + libraries, TorBox DNS/extra_hosts, Settings in chrome).

Updater:
1. Install `reelos.service` + `daemon-reload` **before** `systemctl stop`.
2. Probe = Home **200** on `:8080` and `:80` is ReelOS. **No** `/api/lookup`. Lookup timeout is not a failed OTA.
3. Caddy is parked on a static “updating” page during the mv. Reverse-proxy reload happens **only after** `:8080` is 200. That was the 502.
4. Print `ReelOS 1.2.17 applied.` only after `:80` serves ReelOS. Rollback `.prev` if Home never returns. `journalctl -u reelos` on fail.

No ISO. No other tickets.
