# ReelOS house box — STATUS

Dated **2026-09-06 03:30 CDT**. For Hal. Do not treat Settings → Updates as decorative anymore; 1.2.2 is the first apply that followed the contract.

## What the HP is on

- Hostname `reelos`, LAN `192.168.1.233` (confirm with `hostname -I` if it moves)
- User `reelos` / password `reelos` unless Austin changed it
- SSH is on (`openssh-server`). ISO shipped with `install-server: false`; we enabled it by hand
- `/opt/reelos/VERSION` should be **1.2.2** (tag `v1.2.2`, commit series ending `17562e0` + later STATUS)
- Frontend Jellyfin, source **TorBox**, intent movies+tv+kids+music, extra disk `/dev/sdb` **not formatted**
- Wizard answers + API key live in `/var/lib/reelos/answers.json` — **do not re-run the wizard**

## What 1.2.2 actually is

The updater rewrite. Previous OTAs lied (`VERSION` moved or didn’t; files didn’t).

Contract now:

1. Fetch channel from several URLs, **pick the newest version** (jsDelivr cache served 1.2.1 while main was 1.2.2)
2. Tarball is **`https://github.com/ajt1995/reelos/archive/refs/tags/v1.2.2.tar.gz`**, not `main.tar.gz`
3. Re-exec updater from the tarball before touching the tree
4. Canary the staged tree (`Terminal`, `lookupMedia`, `runTerminal`, `rememberCatalogTitles`, compose `rshared`, `use_webdav`)
5. Stage in `/opt/reelos.next` while `reelos.service` **stays up**
6. Skip `npm` when `package.json` matches; this apply still ran `npm install` because lockfile was stale (`npm ci` failed, fallback worked)
7. Stop shell only for the swap. `.prev` is the rollback
8. Probe `http://127.0.0.1:8080` until 200, **then** stamp `VERSION`
9. `docker compose` **sources `compose/.env`** (`COMPOSE_PROFILES`). Bare `up` prints `no service selected` and is a no-op
10. Force-recreate `jellyfin` + `decypharr`
11. `wire-engines.py` — extra disks are try/except; Lidarr wait is 12s if no config.xml; root folders mkdir **host** paths (`/srv/media/movies` not `/media/movies`) and chown 1000

Log: `/var/lib/reelos/ota.log` (quiet after `canaries ok` — logger doesn’t capture npm/compose; fix later).

## Proven on the box (before/during 1.2.2)

| Check | Result |
|---|---|
| Radarr `movie/lookup?term=Batman` | 73 KB JSON, key present |
| Radarr download client | `ReelOS-Decypharr` / QBittorrent impl / enabled |
| Decypharr | `provider torbox`, `use_webdav False`, key yes |
| Radarr roots | `/mnt/symlinks`, `/media/movies` (added by hand after 400 + PermissionError) |
| Jellyfin 139 / Decypharr restart loop | Old compose had `user:` on Jellyfin and no `rshared`. Recreate with profiles fixed it to **Started** |
| Home `lookupMedia` | On disk after overlay; phone search was empty until tab kill — **confirm Batman dropdown after 1.2.2** |
| Settings Terminal | File MATCH’d; first card, default open |
| Lidarr | Started with `--profile music` |
| `/dev/sdb` | `wrong fs type` — skip forever until Austin formats it |
| `engine.json` | Was missing; 1.2.2 wire should have written it |

## What 1.2.2 did that it should not have

`wire-engines` calls `reelos-access.sh` + `kiosk.sh` on **every** apply.

- Wizard `access=tailscale` → Tailscale apt install. Hit `apt` lock (`E: Could not get lock ... held by process 98181`). May be half-installed. Auth URL if any: `/var/lib/reelos/tailscale-auth.url`
- HP has `/dev/dri` → `kiosk.sh` ran `apt-get install chromium-browser` and **blocked the stamp for minutes**. Austin killed that apt. Next patch: **OTA must not install Tailscale or Chromium.** Idempotent skip if already present; never `apt-get` from kiosk during apply.

## Still broken / not done

- **Indexers** — user-added in Prowlarr. We do not seed them. Do not add a one-click Trash Guides thing; Austin killed that thread.
- **Phone search** — Radarr answers; UI may still drop the result. If Batman is empty after a hard tab close, the client `lookupMedia({ data: { q } })` call is the bug.
- **Sonarr roots** — only Radarr roots were added by hand. Wire should have done Sonarr; **verify**.
- **OTA logger** — steps after canaries don’t hit `ota.log`. Need `log "swapping"` / `log "probe ok"` / `log "stamped"`.
- **`npm ci` vs lockfile** — `ajv` mismatch. Either commit a coherent lock or stop calling `ci` first.
- **Compose profiles on the generic `up`** — still printed `no service selected` then `compose up skipped`; explicit `up jellyfin decypharr` worked. load_env of `.env` is still flaky (quotes/export). Harden.
- **SSH on the disc** — still `install-server: false`. Next ISO: `true`. Web terminal cannot be the recovery channel (it lives in the tree that failed to apply).
- **No torrent client on debrid path** — lock script exists; Radarr client is Decypharr. Do not add qBittorrent unless source is local-vpn.

## Do not

- Re-run the wizard
- `docker compose up` without `COMPOSE_PROFILES` from `/opt/reelos/compose/.env`
- Stamp `VERSION` by hand to “make Check happy”
- Bake a new ISO unless OTA cannot fix it
- Trust jsDelivr `channel.json` alone
- Kill `reelos-update.sh` because the log stopped at `canaries ok`

## How Austin updates after this

Settings → Updates → Check → Apply. Phone stays up until swap. If Apply is dead, SSH:

```
ssh reelos@192.168.1.233
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/v1.2.2/daemon/reelos-update.sh | sudo bash -s apply
```

Prefer a **commit SHA** URL if the tag raw CDN is stale (that’s why 1.2.2 first curl still had the self-`cp` bug).

Repo: `https://github.com/ajt1995/reelos`  
Build (xorriso) owns the tree. Hal owns the house box. This file is the mailbox.
