# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.30**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later.

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.30+). Do not merge Tron+Books as one 1.2.51 stamp.

## Standing — house appliance facts (copy onto every later STATUS)

Austin 2026-09-11. He is right: **cloud `npm run start:box` is not the house.** Mailman, overlay, and compose must be developed against this layout. SSH as `reelos@100.100.154.16` (`reelos`) 2026-09-11.

### Must assume on the next stamp

- **~4GB box** (3.2Gi RAM, 3.7Gi swap with ~1.1Gi in use). Vite/OTA already peak hundreds of MB. Overlay or `cp -a` of FUSE dumps starves the box.
- **FUSE overlay must exclude dfs/cache.** 1.2.50.28 proved it: mailman walked `compose/configs`, copied Decypharr FUSE cache, probe never returned Home, restore, `reelos-ota` failed (30min, 677M peak). Live sizes (this scan): `configs` **1000M**; `decypharr/cache` **547M** (all in `cache/dfs`). Apparent ~11G; `/mnt/debrid` apparent tens of TB is FUSE — do not `du` it. Also skip Jellyfin cache/transcodes, MediaCover, logs, sqlite wal/shm. Do not walk millions of files; `du -sh` on cache dirs only. 1.2.50.29 rsync excludes are the contract — test mailman against **this** tree, not cloud.
- **House stamp is 1.2.50.27** (`/opt/reelos/VERSION`). `.prev` is stripped (16K: VERSION + yml only). `/api/ready` 404. Channel already offers 1.2.50.30 — **do not Apply from the agent.**
- **\*arr bind localhost:** `:9696` Prowlarr, `:7878` Radarr, `:8989` Sonarr, `:8686` Lidarr, `:6767` Bazarr, `:8282` Decypharr. **Jellyfin 12** `0.0.0.0:8096`, Seerr `0.0.0.0:5055`, Caddy `:80`, Vite `:8080`. MediaBrowser Token (JF 12 401 on X-Emby-Token alone).
- **Leftover Gemini stack:** `/home/reelos/media-sandbox/docker-compose.yml` (no sandbox containers). Offset ports 8196/17878/18989/19696/16767/13378/15055. Services: rclone, linuxserver jellyfin/radarr/sonarr/prowlarr/bazarr, audiobookshelf, jellyseerr. Leftover images still on disk: `python:3.12-slim`, `python:3.12-alpine`, `alpine`. Empty `sandbox_default` network. Do not `compose down` it as ReelOS. Do not wipe `/media`.
- **Seerr is unlabeled** (empty compose project labels, created Sep 8) while `docker compose ls` shows `reelos` **running(7)** — Seerr is the 8th container on `reelos_default`. Next `compose up` must not spawn a second Seerr on `:5055`.
- **FUSE** `fuse.decypharr` on `/mnt/debrid` is **stacked 4×**. `/mnt` rshared units exist (`reelos-mnt-rshared` + leftover `reelos-mnt-shared`). Do not bind-mount `/mnt` over the live FUSE. Hops use `ls`, not `[ -e ]`.
- **`ota.lock` exists** (`/var/lib/reelos/ota.lock`, empty file). **Do not delete.** Dual Apply still doubles `ota.log`.
- **systemd:** `reelos` + `caddy` active (door live; `:80`/`:8080`/`:8096` 200 this scan). `reelos-ota` **failed** since 2026-09-10 23:21 (the 28 Apply — do not restart it). `reelos-firstboot` **inactive/disabled** as of this retry (NRestarts 0; `stack-installed` still missing). Do not re-enable or re-run house `install.sh`. `compose.override.yml` is `/dev/dri` for jellyfin+plex — keep it. Lidarr+Bazarr are up on 4GB even with music off.
- **Live compose (one project `reelos`, 8 containers):** sonarr/prowlarr/radarr ~8h; decypharr+jellyfin ~10h healthy; seerr/lidarr/bazarr ~43h. No HostConfig.Dns leftover. No extra *arr containers.
- Disk is **sda only** (458G, 24G used). No `/dev/sdb`. `/srv/media/sdb` is an empty dir.

### Messy Apply reconstruction (`ota.log` + journalctl — lines are doubled)

Last **stamp** is **1.2.50.27** (`applied-sha` `5dd6a88`, 2026-09-10 22:00). Channel Check already offers **1.2.50.30**. **Do not Apply.**

| When (UTC Sep 10) | Attempt | Outcome |
|---|---|---|
| 17:24 → 17:44 | 1.2.50.21 → **22** | stamped (`ReelOS 1.2.50.22 applied.`) after earlier heal_red / hops_red / restore on the same 21 |
| 20:45 → 21:16 | 1.2.50.22 → 26 | **heal_red**, not printed applied; installed stayed 22 |
| 21:31 → 22:00 | 1.2.50.22 → **27** | stamped; door `:80` ReelOS |
| 22:19 → 22:49 | 1.2.50.27 → 28 | **home never returned**; SIGKILL Vite on stop; restore `20260910T224644-restore_`; ota exit 1 |
| 22:50 → 23:21 | 1.2.50.27 → 28 again | probe 90/90; SIGKILL (`final-sigterm` timeout); restore `20260910T231446-restore_`; `reelos-ota` **failed** (30min, 677M). Caddy restarted 23:21/23:25; door came back. |

Older 50.x: 11 stamped; 12/13 heal_red (stayed 11); 19/20 applied; 21 heal_red then applied. Dual Apply still **doubles every `ota.log` line**. `ota.lock` file present, flock **not** held — do not delete.

## Current ship

***1.2.50.30 is the ship.*** 2026-09-10. Owner Home showed Night at the Museum (Cached), John Wick (Available now), Coyote vs. Acme (Available now) plus "25 transferring" in **Your requests** at the top — redundant with On this box. 1.2.50.29 (splash /api/ready / rsync overlay) did not change that row. This stamp hides shelf/library hits on Home and counts transferring with the same in-flight definition. Requests still lists everything. Does not take Tron (#52 / #70 / #59). Tron chrome is scrapped (see standing orders).

## Stamp

- **VERSION / channel:** `1.2.50.30`
- **Base:** `main` at 1.2.50.29
- Did **not** take Tron chrome from #52 / #70 / #59
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Home Your requests is in-flight only

Hide rows already on the shelf/library: status available, engine downloaded, overlay library hit, Cached / Available now. Keep searching, grabbing, and linked waiting for import. The row disappears when nothing is in flight.

### Transferring chip uses the same definition

Do not show "25 transferring" when those 25 are mostly available. Overlay library presence first, then count downloading/waiting only. Nav Requests badge matches Home.

### Requests page unchanged

Filters still list available / downloading / waiting / failed. Honesty overlay still upgrades library hits to available there.

## Proof

```
python3 scripts/check-ota.py .
node --experimental-strip-types --test src/lib/sync-requests.test.ts
node --test scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-request-status.test.mjs scripts/jellyfin-seed.test.mjs scripts/reelos-ready.test.mjs scripts/reelos-library.test.mjs
```

## Owner / house Apply

**This STATUS update is not a stamp. Do not house Apply for this PR.**

House is still **1.2.50.27**. Door `:80`/`:8080` 200. Firstboot is **idle/disabled**. 1.2.50.28 overlay already failed closed and restored (twice). Next mailman must exclude dfs/cache and be tested against this layout before any owner Apply of 1.2.50.29+.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Treat cloud `npm run start:box` as the house
- Overlay `decypharr/cache` / `cache/dfs` (or walk FUSE dumps)
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media`, TorBox, or `~/media-sandbox`
- Restart `reelos-ota` / post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
- Reboot unless the door is fully dead (it is not)
