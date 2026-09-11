# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).`
- **Stable ship is 1.2.50.38** on `main.tar.gz`. Do not replace that stamp. Do not Apply from the agent. Arena+Books live only on **beta** (`1.2.50.38-beta.1`, branch tarball). Do not merge this tree onto `main` — SHA-drift Check would offer Arena on stable.

### Books path

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Do not glue Books to Tron CSS or burn it as 1.2.51. Lidarr is not this ship.

## Current ship

***1.2.50.38 is the stable ship.*** `channel.json` / `main.tar.gz` stay 38. House Applies 38 from main — **not this agent.** Folds [#114](https://github.com/ajt1995/reelos/pull/114) wizard honesty and [#116](https://github.com/ajt1995/reelos/pull/116) no-GPU DirectPlay onto main at 1.2.50.37 ([#115](https://github.com/ajt1995/reelos/pull/115)). Wizard stays seven steps; TorBox is the only first-class source. 1.2.51 parked.

***1.2.50.38-beta.1 is the beta sidecar.*** Arena chrome (black floor, cyan circuit, neon kept; gold only Watch / Download / Begin) plus Books (Kavita, Gutenberg / Standard Ebooks / Internet Archive, phone file download). Wizard Books chip off by default. Check+beta on this tarball offers `cursor/beta-arena-books-5ba6.tar.gz`. Stable Check stays 38. **No house Apply from the agent. Draft PR only — do not merge Arena CSS onto main.**

## Stamp

- **Stable VERSION / channel.json:** `1.2.50.38` / `main.tar.gz`
- **This tree VERSION / channel-beta.json:** `1.2.50.38-beta.1` / `cursor/beta-arena-books-5ba6.tar.gz`
- **Base:** `main` at 1.2.50.38 ([#117](https://github.com/ajt1995/reelos/pull/117))
- **House snapshot:** 1.2.50.31; firstboot disabled; `stack-installed` latched; about to Apply 38
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### 4GB detect, don’t only toggle

`box_is_small()` reads MemTotal. ≤4.5Gi is small even if `performance.json` says `low: false`. Encoding, scan caps, and skip-compile all use that. Loadavg ≥2 with nothing playing skips extra recover/compose/heal. ffprobe D-state skip from 35/36 stays first.

### Cap library scans / keep MediaInfo off

`enableMediaInfo` stays false in compose configs and PUTs (36 — do not regress). `rescanAfterRefresh: Never` on *arr debrid configs. Jellyfin periodic library-scan triggers are cleared on a small/low box. Trickplay/chapter/subtitle extraction stay off. Import still scans dump folders.

### One FUSE — don’t remount if listed

Same as 36: lazy-unmount stale only. Persist `/var/lib/reelos/fuse-listed` + `fuse-policy.json` (`remountIfListed: false`) when `/mnt/debrid` lists. `nudge_fuse` / `ensure_fuse` log don’t remount if listed. Never umount `/media`.

### Prebuilt client — 4GB never compiles

`prebuilt/vercel-output` (hashed `/assets/…`, nitro server, no poster dupes) ships in the tarball. Mailman copies it into staging and skips `vite build`. `npm ci` still only when the lockfile changed (35).

### Production API + static UI

`NODE_ENV=production npm run start:box` prefers nitro+api: hashed `/assets/styles-*.css` (not `/src/styles.css`) plus existing `/api` plugins. Leftover Vite is `vite preview` of that prebuild if nitro import fails. `vite --host` only when no prebuild exists (dev checkout).

### No GPU: DirectPlay/DirectStream only

`has_vaapi_dri()` / `hasVaapiDri()` is a host `/dev/dri` **renderD*** or **card*** node (empty `/dev/dri` is no GPU). **GPU present:** VAAPI transcode allowed; low-perf still one ffmpeg thread. **No GPU:** persist `encoding.xml` (hardware encode off) and disable user video/audio transcode so clients DirectPlay/DirectStream (remux stays). Provision seeds XML before compose up; self-heal `--performance` and Settings `/api/performance` re-apply XML + policies. TorBox dumps stay unread. 37 claimed this in the channel note; **38 is the persist.**

### Wizard does not present untested providers as working

Seven-step wizard is unchanged. Default source is TorBox. Continue on the source step requires a real TorBox Validate. Real-Debrid, AllDebrid, Premiumize, and Local+VPN are labeled Untested; Validate refuses and does not call those APIs (Local+VPN is not a fake OK). Plex / Both and Cloudflare Tunnel are labeled Untested; Continue and `/api/provision` refuse. Jellyfin + this network / Tailscale stay. Books chip is off by default. Arena paints only on the beta tarball.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/beta-arena-books.test.mjs scripts/books-catalog.test.mjs scripts/wizard-honesty.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-update.test.mjs scripts/reelos-repair.test.mjs scripts/update-notes.test.mjs scripts/fuse-ffprobe-36.test.mjs scripts/scale-prod-37.test.mjs scripts/jf-directplay-38.test.mjs scripts/jellyfin-seed.test.mjs scripts/reelos-ready.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / → 200 with /assets/styles-*.css, not /src/styles.css
# GET /api/ready → 200
```

## Owner / house Apply

House stays **1.2.50.31** until it Applies **1.2.50.38** from main. **Do not Apply from the agent.** Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`.

## Do not

- Merge this Arena+Books tree onto `main` (SHA-drift would offer Arena on stable Check)
- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Replace the 1.2.50.38 stable stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
