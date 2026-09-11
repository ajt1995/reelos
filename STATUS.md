# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.42**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later. **Beta toggle on Settings is real: ON Check fetches 2.0.0 Arena+Books from `cursor/beta-arena-books-5ba6.tar.gz`. OFF stays 1.2.50.x. Arena CSS stays off this stamp.**

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.42 is the ship.*** 41 measured the HP but did not make the library faster: catch-up was masked, and Sonarr still spawned ffprobe on FUSE dumps with `enableMediaInfo` already false. Extra `fuse.decypharr` rows were rshared `/mnt` self-binds of **one** device. 42 stubs *arr/Jellyfin ffprobe, peels extra `/mnt` binds without lazy-umounting live FUSE or `/media`, and runs catch-up skip-existing (splash idle unless actually importing). Hardware profile from 41 stays. Prebuilt hashed UI, no Arena. Settings **Beta channel** still fetches **2.0.0** as a separate tarball. 1.2.51 parked. **One house Apply of 42 after merge** so the stub survives compose recreate. Never twice.

## Stamp

- **VERSION / channel:** `1.2.50.42`
- **channel tarball:** `main.tar.gz` (gold hashed UI, no Arena)
- **channel-beta:** `2.0.0` / `cursor/beta-arena-books-5ba6.tar.gz` (pointer only; Arena stays off this tarball)
- **Base:** `main` at 1.2.50.41 ([#124](https://github.com/ajt1995/reelos/pull/124)); 1.2.50.40 Apply/library split ([#122](https://github.com/ajt1995/reelos/pull/122)) stays. 1.2.50.38 wizard honesty + DirectPlay and 1.2.50.37 4GB detect stay.
- **House snapshot:** HP Laptop 15-bs0xx, 3.2Gi MemTotal, 4× Pentium N3710, WD5000LPCX HDD; 41 is installed and live-patched (one FUSE, ffprobe stubbed, catch-up unmasked); firstboot disabled
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Stub dump ffprobe + one FUSE (the library actually progress)

`enableMediaInfo` false was not enough — Sonarr still ffprobe'd `/mnt/symlinks/sonarr` (B99, TWD, …) into D-state on stacked `fuse.decypharr`. `no-ffprobe` now stubs container ffprobe (busy-inode rename) even when MediaInfo is already off. Extra FUSE rows were the same maj:min listed through rshared `/mnt` self-binds; peel extras with `umount /mnt` (never `-l`, never `/media`, stop if the live FUSE would drop). `reelos-mnt-rshared` is idempotent (`findmnt` / skip `--now` when fuse is live). Catch-up imports skip-existing dumps; D-state concurrency 0 unless stubbed; splash/banner idle unless actually importing. Complements #124.

### Scale to the hardware (not a fake Pi)

`reelos_hardware.py` / `hardwareProfile()` measure ram_gb, cpus, disk_kind, DirectMap vs cgroup. Tiny (≤4.5Gi **visible or un-hidden**) keeps MemoryMax 768M and no docker mem_limit. HDD folder cap stays 6/12; SSD on 4GB can use nproc. If MemTotal is actually 16GB, catch-up is 2G + Jellyfin 5G — that path is measurement, not an assumption about this HP. High ffprobe D-state → import concurrency 0 on any box. Selfheal **defers** catch-up while D-state is high instead of starting the oneshot every two minutes. Mailman logs the profile and writes the systemd drop-in. Tiny Apply does not rewrite `compose.override.yml` (would recreate *arr next to D-state). Prebuilt UI is packaging, not a RAM throttle.

### Apply vs library catch-up (the law)

Check → Apply stamps after hops and the door. Indexers, dump import, heal, hybrid 1080, ffprobe, and FUSE remount never block `ReelOS $REMOTE applied.` The phone has two clocks: **Applying 1.2.50.x** (ota.log / product swap) vs **Library catching up** (library-progress.json — folder N, skips, timeouts). Splash-lock Home only while dumps still need import. Catch-up is `reelos-library-catchup.service` (`TimeoutStartSec=infinity`, `KillMode=process`, `MemoryMax=768M`); systemd-run + nohup `9>&-` remain the fallback. Worker backs off when ffprobe D-state is high. Do not stack another `fuse.decypharr`.

### Beta sidecar (Check+beta fetches 2.0.0)

Settings → Updates **Beta channel** is a real toggle, not a stub. Off: Check reads `channel.json` / `1.2.50.42` / `main.tar.gz`. On: Check reads main `channel-beta.json` first (skips a `main.tar.gz` stub) and can fetch **2.0.0** from `cursor/beta-arena-books-5ba6.tar.gz`. Arena CSS stays off this 42 tarball. Leave Beta and Check to roll back to last stable 1.2.50.x. Folded from [#123](https://github.com/ajt1995/reelos/pull/123). Do not merge [#119](https://github.com/ajt1995/reelos/pull/119).

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
python3 scripts/check-ota.py .   # ok version=1.2.50.42
node --test scripts/stack-smoke.test.mjs scripts/apply-stamp-first-39.test.mjs scripts/apply-library-split-40.test.mjs scripts/scale-hardware-41.test.mjs scripts/fuse-no-ffprobe-42.test.mjs scripts/wizard-honesty.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-update.test.mjs scripts/reelos-repair.test.mjs scripts/update-notes.test.mjs scripts/fuse-ffprobe-36.test.mjs scripts/scale-prod-37.test.mjs scripts/jf-directplay-38.test.mjs scripts/jellyfin-seed.test.mjs scripts/sonarr-manual-import.test.mjs scripts/relink-dumps.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / → 200 with /assets/styles-*.css, not /src/styles.css
# GET /api/ready → 200
```

## Owner / house Apply

House is **1.2.50.41** live-patched (one FUSE, ffprobe stub, catch-up unmasked). **One Apply of 42 after merge** so the stub/unstack survive compose recreate. Never twice. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`. Do not `docker restart reelos-sonarr-1` while ffprobe is D-state. Jellyfin images off. Beta ON is a **second** Check/Apply of **2.0.0** only if Austin wants Arena/Books.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Merge [#119](https://github.com/ajt1995/reelos/pull/119) Arena+Books onto main (SHA-drift onto `main.tar.gz`)
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI on this 1.2.50.42 tarball
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Ship Arena CSS onto `main.tar.gz`
- Tap Apply 39 again
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Apply 42 twice, or Apply while ffprobe is D-state
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
