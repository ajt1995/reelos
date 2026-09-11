# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.38**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later. **Beta channel is wired in this stamp; Arena+Books are not shipped here.**

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.38 is the ship.*** 2026-09-11. Wizard stays seven steps. TorBox is the only first-class source (Validate hits `api.torbox.app` with User-Agent `ReelOS`). Real-Debrid / AllDebrid / Premiumize / Local+VPN / Plex claim / Cloudflare Tunnel are labeled untested — Validate and Finish refuse; no fake always-ok. Books chip stays out. 1.2.50.37 is reserved for scale/prod (separate PR). Does not take Tron (#52 / #70 / #59). 1.2.51 parked. **No house Apply from the agent.**

## Stamp

- **VERSION / channel:** `1.2.50.38`
- **channel tarball:** `main.tar.gz`
- **Base:** `main` at 1.2.50.36 ([#113](https://github.com/ajt1995/reelos/pull/113) ffprobe/FUSE)
- **House snapshot:** 1.2.50.31; firstboot disabled; `stack-installed` latched
- **1.2.50.37** reserved for scale/prod — merge this after 37 if 37 is still landing
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Wizard does not present untested providers as working

Seven-step wizard is unchanged. Default source is TorBox. Continue on the source step requires a real TorBox Validate. Real-Debrid, AllDebrid, Premiumize, and Local+VPN are labeled Untested; Validate refuses and does not call those APIs (Local+VPN is not a fake OK). Plex / Both and Cloudflare Tunnel are labeled Untested; Continue and `/api/provision` refuse. Jellyfin + this network / Tailscale stay. No Books chip.

### Sonarr/Radarr do not ffprobe FUSE dumps (from 36)

`enableMediaInfo` is PUT false on Sonarr, Radarr, and Lidarr. Recycle-bin PUTs keep it false. `compose/configs/{sonarr,radarr,lidarr}/reelos-debrid.json` ships in the tarball and is re-copied after house overlay so Apply cannot turn analysis back on. Import/grab still use filenames and dump-folder scans. Jellyfin trickplay / chapter / subtitle extraction stay off (`no-ffprobe` re-applies those flags).

### One Decypharr FUSE — do not stack

`nudge_fuse` / `ensure_fuse` / `patch_decypharr` do not remount or restart Decypharr when `/mnt/debrid` already lists. Extra layers are lazy-unmounted **only when the mount is stale** (ENOTCONN). A live stacked mount is left alone (unmounting the top layer would drop the working library). Never umount `/media`.

### 4GB Apply / self-heal (from 35)

House `package.json` only differs in `scripts.start:box`. Lockfile matches. Mailman reuses `node_modules` when the lockfile matches. Staging `vite build` is skipped on ≤4.5Gi MemTotal (or <1.8Gi MemAvailable). Self-heal skips `compose up` and recover while any `ffprobe` is D-state.

### Settings / production start / beta (from 34)

Check / Apply stay on Box; Heal/Hops/Doctor behind Advanced. `start:box` → `reelos-box.mjs`. Beta stub only.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/wizard-honesty.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-update.test.mjs scripts/reelos-repair.test.mjs scripts/update-notes.test.mjs scripts/fuse-ffprobe-36.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / and GET /api/ready → 200
```

## Owner / house Apply

House stays **1.2.50.31**. **Do not Apply from the agent.** Do not Apply this stamp until 1.2.50.37 (scale/prod) has landed if that PR is still in flight. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Ship Arena chrome or Books in this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
