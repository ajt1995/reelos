# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.39**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later. **Beta channel is wired; Arena+Books stay off this stamp (different agent).**

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.


## Beta sidecar (this tree — do not merge until house is 1.2.50.39)

VERSION / `channel.json` / stamps stay **1.2.50.39**. `channel-beta.json` is a **2.0.0 pointer** at `cursor/beta-arena-books-5ba6.tar.gz`, not `main.tar.gz`. Mailman honors Beta and skips the old stub. Arena CSS stays off this tree. Draft until house VERSION is already 1.2.50.39. Do not stamp 1.2.50.40.

## Current ship

***1.2.50.39 is the ship.*** Stamp-first Apply: hops + door, then `applied`, then dump import/heal in the background (same recover timer job). Check is not frozen on `import after hops`. Import/heal red does not un-stamp a successful UI swap. Skip Sonarr folders that already have files; no `RescanSeries` without an id; no host+container double list; skip a FUSE folder on a short timeout. No hybrid 1080 grab on Apply. Background import capped on 4GB. First provision can still do a long walk. Never `/media`. Never walk FUSE dfs. 38 wizard honesty + DirectPlay stays. Does not take Tron (#52 / #70 / #59). 1.2.51 parked. **No house Apply from the agent.** Endure the current 38 Apply; after it finishes, Check→Apply **39 once**.

## Stamp

- **VERSION / channel:** `1.2.50.39`
- **channel tarball:** `main.tar.gz`
- **Base:** `main` at 1.2.50.38 ([#117](https://github.com/ajt1995/reelos/pull/117)); keeps 1.2.50.37 prebuilt hashed UI
- **House snapshot:** 1.2.50.31; firstboot disabled; `stack-installed` latched; **endure 38**; then Check→Apply 39 once
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Stamp first, library catch-up in the background

UI-only OTA: hops + door, then VERSION / `applied-sha`, then dump import/heal via the recover timer (`reelos-selfheal` + lock-clients). `ota.log` prints `applied` then `library catch-up in background`. Catch-up is `systemd-run` (TimeoutStartSec=600) so the 90s selfheal oneshot / flock cannot kill it; `KillMode=process` + `9>&-` nohup fallback if systemd-run fails. Apply does not await full `kick_imports`. Import/heal red does not un-stamp a UI swap. Compose-changed hops/indexer canary still fail-close. First provision (`wire-engines.py` without `REELOS_OTA`) still does a long library walk.

### Import efficiency (do not melt 4GB)

Do not ManualImport every dump every time — skip folders Sonarr already has files for. Do not `RescanSeries` with no id (all shows). Do not list host `/mnt/symlinks` and container `/symlinks` twice. List timeout is 20s (was 120); skip that folder on timeout and continue. No hybrid 1080 grab bolted onto Apply. Catch-up caps folder count on a small box. `dump_has_media` does not `rglob` into FUSE.

### 4GB detect, don’t only toggle

`box_is_small()` reads MemTotal. ≤4.5Gi is small even if `performance.json` says `low: false`. Encoding, scan caps, and skip-compile all use that. Loadavg ≥2 with nothing playing skips extra recover/compose/heal. ffprobe D-state skip from 35/36 stays first.

### Cap library scans / keep MediaInfo off

`enableMediaInfo` stays false in compose configs and PUTs (36 — do not regress). `rescanAfterRefresh: Never` on *arr debrid configs. Jellyfin periodic library-scan triggers are cleared on a small/low box. Trickplay/chapter/subtitle extraction stay off. Import still scans dump folders.

### One FUSE — don’t remount if listed

Same as 36: lazy-unmount stale only. Persist `/var/lib/reelos/fuse-listed` + `fuse-policy.json` (`remountIfListed: false`) when `/mnt/debrid` lists. `nudge_fuse` / `ensure_fuse` log don’t remount if listed. Never umount `/media`.

### Prebuilt client — 4GB never compiles

`prebuilt/vercel-output` (hashed `/assets/…`, nitro server, no poster dupes) ships in `main.tar.gz`. Mailman copies it into staging and skips `vite build`. `npm ci` still only when the lockfile changed (35).

### Production API + static UI

`NODE_ENV=production npm run start:box` prefers nitro+api: hashed `/assets/styles-*.css` (not `/src/styles.css`) plus existing `/api` plugins. Leftover Vite is `vite preview` of that prebuild if nitro import fails. `vite --host` only when no prebuild exists (dev checkout).

### No GPU: DirectPlay/DirectStream only

`has_vaapi_dri()` / `hasVaapiDri()` is a host `/dev/dri` **renderD*** or **card*** node (empty `/dev/dri` is no GPU). **GPU present:** VAAPI transcode allowed; low-perf still one ffmpeg thread. **No GPU:** persist `encoding.xml` (hardware encode off) and disable user video/audio transcode so clients DirectPlay/DirectStream (remux stays). Provision seeds XML before compose up; self-heal `--performance` and Settings `/api/performance` re-apply XML + policies. TorBox dumps stay unread. 37 claimed this in the channel note; **38 is the persist.**

### Wizard does not present untested providers as working

Seven-step wizard is unchanged. Default source is TorBox. Continue on the source step requires a real TorBox Validate. Real-Debrid, AllDebrid, Premiumize, and Local+VPN are labeled Untested; Validate refuses and does not call those APIs (Local+VPN is not a fake OK). Plex / Both and Cloudflare Tunnel are labeled Untested; Continue and `/api/provision` refuse. Jellyfin + this network / Tailscale stay. No Books chip. No Arena.

## Proof

```
python3 scripts/check-ota.py .   # ok version=1.2.50.39 warn=0 contracts=86
node --test scripts/stack-smoke.test.mjs scripts/apply-stamp-first-39.test.mjs scripts/wizard-honesty.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-update.test.mjs scripts/reelos-repair.test.mjs scripts/update-notes.test.mjs scripts/fuse-ffprobe-36.test.mjs scripts/scale-prod-37.test.mjs scripts/jf-directplay-38.test.mjs scripts/jellyfin-seed.test.mjs scripts/sonarr-manual-import.test.mjs scripts/relink-dumps.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / → 200 with /assets/styles-*.css, not /src/styles.css
# GET /api/ready → 200
```

## Owner / house Apply

House endures the current **1.2.50.38** Apply. **Do not interrupt `reelos-ota`.** **Do not Apply from the agent.** After 38 finishes, Check→Apply **1.2.50.39 once**. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Ship Arena chrome or Books in this stamp (different agent)
- Interrupt `reelos-ota` / Apply 38 on the house
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
- Apply 36 or 37 from the agent (38 supersedes)
