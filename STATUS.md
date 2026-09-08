# STATUS.md

Xorriso. **2026-09-07 21:17 CDT.** VERSION **1.2.42**. Channel still `main.tar.gz`. No 1.2.43.

## House (last dump)

- `applied-sha` **f7ab5f0** — behind `main` **4592e63**.
- Movies on disk: National Treasure, Guardians, Barbie. Jellyfin Movies works.
- FUSE **not** on host (`/mnt/debrid` empty). Shows **0**. Rick and Morty S04–S09 in TorBox, not in Jellyfin.
- Logger dump had empty `reelos.service` / `caddy.service` and no TV hop (old SHA).
- Caddy: Apply still falls back to nohup (`caddy systemd stuck`). Reboot can kill :80.

## On `main` (not on the HP until they Apply)

Logger never silent + `=== tv hop ===`. Stop bind-mounting `/mnt` over FUSE. Decypharr volume is `/mnt/debrid:rshared`. Sonarr import retries. Do not call that 1.2.43.

## Do not merge

0.x PRs are **not** live. HAL names a stamp.

| # | Issue | PR | Branch | Code? |
| - | ----- | -- | ------ | ----- |
| 0.1 Caddy survives reboot | [#23](https://github.com/ajt1995/reelos/issues/23) | [#31](https://github.com/ajt1995/reelos/pull/31) | `feature/0.1-caddy-unit` | yes |
| 0.2 Jellyfin token = owner | [#24](https://github.com/ajt1995/reelos/issues/24) | [#32](https://github.com/ajt1995/reelos/pull/32) | `feature/0.2-jellyfin-token` | yes |
| 0.3 Per-season TV | [#25](https://github.com/ajt1995/reelos/issues/25) | [#33](https://github.com/ajt1995/reelos/pull/33) | `feature/0.3-season-status` | scaffold |
| 0.4 Radarr dump import | [#26](https://github.com/ajt1995/reelos/issues/26) | [#34](https://github.com/ajt1995/reelos/pull/34) | `feature/0.4-radarr-import` | scaffold |
| 0.5 Check SHA drift | [#27](https://github.com/ajt1995/reelos/issues/27) | [#35](https://github.com/ajt1995/reelos/pull/35) | `feature/0.5-check-sha` | scaffold |
| 0.6 TorBox 530 honest | [#28](https://github.com/ajt1995/reelos/issues/28) | [#36](https://github.com/ajt1995/reelos/pull/36) | `feature/0.6-torbox-indexer` | scaffold |
| 0.7 Discover | [#29](https://github.com/ajt1995/reelos/issues/29) | [#37](https://github.com/ajt1995/reelos/pull/37) | `feature/0.7-discover` | scaffold |
| 0.8 OTA probe | [#30](https://github.com/ajt1995/reelos/issues/30) | [#38](https://github.com/ajt1995/reelos/pull/38) | `feature/0.8-ota-probe` | scaffold |

Parked: #2 Seerr, #3 Kavita, #4 Lidarr search, #9 extra disk. Do not merge #13 #15 #16 #17 #19 #20.

## Don’t

- Cut 1.2.43 / ISO / indexer roster.
- Touch `HAL.md`.
- Use the owner as a debugger. Apply is Settings → Check → Apply.
