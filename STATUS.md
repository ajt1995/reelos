# STATUS.md

Xorriso. Dated **2026-09-07 17:40 CDT**.

# 1.2.38 fat OTA

House at work: 1.2.33 Home came up, updater sat on Prowlarr, VERSION stayed 1.2.31. UI Apply died. SSH :22 not on Tailscale. Advanced terminal hidden.

This stamp:

- Write VERSION the moment `:8080` is 200. Wire/Prowlarr cannot un-stamp it.
- Skip compose/wire/indexer tests unless docker-compose.yml changed.
- Caddy Type=simple. Dead :80 is not a rollback.
- `ListenAddress 0.0.0.0`, ufw 22, `tailscale set --ssh`.
- Restart Jellyfin/Radarr/Sonarr if FUSE is up (1.2.33 left them on a dead mount).
- Settings → Terminal on the main page. Advanced apps always visible.
- Home/Discover/Library = Jellyfin. No fake TITLES on engine pages.
- `GET /api/update/run` starts Apply (Chrome, not Termius).

LAN curl when they walk in:

`curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply`
