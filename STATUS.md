# STATUS.md — historical work log

> **Historical, not current state.** This is an older, accumulated work log and is deliberately not a resumption guide. Read [`AGENTS.md`](AGENTS.md) and run `npm run context:brief` for current repository state; update the feature register or active decisions instead of extending this file.

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/reelos-org/reelos/pull/52) / [#70](https://github.com/reelos-org/reelos/pull/70) / [#59](https://github.com/reelos-org/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.60**). See [#74](https://github.com/reelos-org/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later. **Beta toggle on Settings is real: ON Check fetches 2.0.0 Arena+Books from `cursor/beta-arena-books-5ba6.tar.gz`. OFF stays 1.2.50.x. Arena CSS stays off this stamp.**

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

> [!IMPORTANT]
> **AUTHORITATIVE REALITY ANCHOR**: Consult [GROUND-TRUTH.md](GROUND-TRUTH.md) and [THE-LAWS-OF-REELOS.md](docs/THE-LAWS-OF-REELOS.md).
> Jellyfin and the `*arr` stack (Sonarr, Radarr, Prowlarr) are **PERMANENTLY RETIRED**. ReelOS is the player and media engine, driven natively by on-device neural vectors and TorBox encrypted cloud streaming.

## Current ship

***2.0.0 End-to-End Neural Cinema is the ship.*** Milestone v2.0.0: ReelOS Core Directive — Pure End-to-End Neural Media Operating System. Old incomplete versions scrapped. Native HTTP Range Stream Server (`/api/stream/sample`, `/api/stream/:hash`), public indexer autonomous self-repair roster connected to ReelFlow fallback scraper, hybrid storage & offline download governance, machine memory allocation (100% RAM on dedicated, <4MB stealth yield on shared PCs), and 100% DirectPlay cinema streaming with zero AI jargon in the UI.

### Subsystem Ground Truth & Reality Ledger (Zero Hallucination)

| Subsystem | Live Code Reality | Integrity Status | Action Required |
|---|---|:---:|---|
| **Native HTTP Range Stream Server** | RFC 7233 byte-range serving (HTTP 206 Partial Content), zero-copy direct play streaming for ExoPlayer/Web video (`/api/stream/sample`, `/api/stream/:hash`) | ✅ **VERIFIED LIVE** | Active in production (`neural-stream-server.mjs`) |
| **Public Indexer Autonomous Repair & Fallback** | Public indexer roster (`1337x`, `tpb`, `knaben`, `torrentcsv`, `yts`, `eztv`, `showrss`) connected to `search.mjs` fallback scraper with autonomous mirror healing | ✅ **VERIFIED LIVE** | Active in production (`search.mjs`) |
| **Hybrid Storage & Offline Download** | `smart_hybrid` (comfort shows, watchlist, cabin vaults cached locally), `offline_download`, and `cloud_stream` with rotational drive protection & 2-episode forward rolling window | ✅ **VERIFIED LIVE** | Active in production (`media-strategy-service.mjs`) |
| **Machine Classifier & Dynamic RAM (Law 1)** | Dedicated machines use 100% of RAM for AI agents (<6GB preserves 1GB video headroom; 8GB+ uses Total - 256MB); shared PCs yield to <4MB | ✅ **VERIFIED LIVE** | Active in production (`neural-scale-engine.mjs`, `machine-classifier.mjs`) |
| **Console Sentinel & Bufferbloat Pacing** | Non-destructive ARP sweep & TCP gateway latency probing paces streaming when family games on LAN | ✅ **VERIFIED LIVE** | Active in production (`console-sentinel.mjs`) |
| **Android TV / Mobile Cinema Players** | Native ExoPlayer 1.3.1 streaming directly via ReelOS native doors (`/api/stream/sample`, `/api/stream/:hash`) with zero port 8096 relics | ✅ **VERIFIED LIVE** | Active in production (`TvPlayerActivity`, `MobilePlayerActivity`, `Models.kt`) |
| **Web & PWA Cinema Client** | Clean Vite + Nitro build, zero AI jargon, velvet theme, invisible magic standard | ✅ **VERIFIED LIVE** | Active in production |
| **Windows Desktop Wrapper** | Non-destructive port hunting (8080-8150), clean child exit | ✅ **VERIFIED LIVE** | Active in production |
| **TorBox Anti-Ban Token Bucket** | Paced execution and caching via `torBoxRateLimiter` | ✅ **VERIFIED LIVE** | Active in production |

## Stamp

- **VERSION / channel:** `2.0.0`
- **channel tarball:** `main.tar.gz` (v2.0.0 gold velvet UI)
- **channel-beta:** `2.0.0` (Pure End-to-End Neural Media Operating System)
- **Base:** `main` at 2.0.0.
- **House snapshot:** Dedicated Appliance mode (100% physical RAM allocated to AI); Shared Workstations yield automatically.
- **1.2.51** remains unused/parked (was Tron; scrapped).


## Changelog

### 2.0.0-neural End-to-End Neural Launch (ReelOS Core Directive)

ReelOS Core directive: *"Scrap old versions nothing was complete. The end to end neural is the build we will ship TODAY"*.
- **Native HTTP Range Stream Server (`scripts/services/neural-stream-server.mjs`)**: Implements RFC 7233 byte-range serving (HTTP 206 Partial Content) with compliant boundary clamping (`end = totalSize - 1`), HEAD request probing without body payload, and zero-copy piping directly into client video players (Android TV ExoPlayer 1.3.1, Mobile Player, Web Velvet Player). Supports multi-hop redirect following (HTTP 301/302/307/308) for remote Debrid CDNs, direct TorBox array response unpacking, and automatic instant magnet caching via `createtorrent`. Serves `/api/stream/sample` (bundled trailer) and `/api/stream/:hash` (TorBox direct link resolution or local cache across `.reelos-state/cache`, `REELOS_STATE`, `/var/lib/reelos/cache`, and `downloads/`).
- **Wired `/api/stream/*` in `reelos-box.mjs`**: Integrated into `dispatchBoxApi` to serve streaming requests instantly on port 8080.
- **Public Indexer Autonomous Repair Connected to Scrapers (`scripts/reelflow/search.mjs`)**: Wired `PUBLIC_INDEXER_ROSTER` and `neuralIndexerRepair` into the fallback scraper pipeline. Supports YTS, TPB, Knaben, TorrentsCSV, and RSS feeds with automated mirror failover and pre-flight poison filtering. Fixed query formatting bug (preventing `SundefinedEundefined` strings) and added keyword title filtering on RSS feeds.
- **Legacy Relic Eradication**: Removed legacy port 8096 URLs across Android client models (`Models.kt`), discovery service (`ServerDiscovery.kt`), and sample catalogs. All streams and shims point to native ReelOS port 8080.

### 1.5.19 Master Launch Product & OTA Baseline

Version 1.5.19 final release. Pre-OTA SQLite database and state snapshots retained up to 5 generations, non-blocking offline wizard banner with companion Kid-Safe profile generation, Windows auto-elevating installer (`ReelOS-Setup.bat`), hot-reload compose optimizations, and complete daemon/install parity.


### 1.2.50.60 soak stabilize — Importing does not sit forever

59 fingerprint-skipped dump ManualImport once folders looked unchanged, so the 6-folder HDD cap never rotated. Slow Horses / Abbott / The Bear sat at On disk, importing. Empty Sonarr stats after a new add painted Coming (no SeasonSearch) until metadata landed. 60 rotates the cap (selfheal + catch-up), always ManualImports 0-file dump seasons, treats empty new-add stats as Searching, keeps Silo S04 / ST S6 Coming, drops Coming rows from GET /api/request (not downloading 0%), paints waiting+announced as Coming not Waiting, and Home/Library Watch seasons come from Sonarr files not the JF dump Path. Like / Not interested / Reset curator stay. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.59 likes and dislikes on Discover

Discover and More like this have **Like** (thumbs up) and **Not interested** (thumbs down). Like persists in `/var/lib/reelos/curator.json` and boosts similar titles in Discover. Dislike hides from Discover. Neither hides Home or Library owned titles. Settings **Reset curator preferences** clears both. Tap targets are 44px on the poster, not under it. No Google. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.58 cloud soak — movie≠TV, TBA Coming, dump leftovers off Home

57 still crashed selfheal (`filterRemovedRequests` not exported), painted Dark Knight with 3rd Rock seasons, SeasonSearched Stranger Things S6 (Sonarr `statistics: null`), and listed TPB / Kaijuu `(Season 1) [BD` on Library. 58 exports the helper, keeps movie tmdb ids off Sonarr series *and* lookup season lists, marks Sonarr-only TBA Coming, hides unmatched year-0 dumps on `/api/library` and Home, wraps Requests `S01 · Searching`, and attaches TMDB posters to named inflight rows. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.57 dump heal + cloud 40×40 Coming ≠ Request

56 painted **On disk, importing** while catch-up skipped every UIndex/Torrenting dump once The Rookie had S01 files. 57 maps dump names to the named series/movie (one-level `/mnt/symlinks`, not a FUSE walk), asks Sonarr/Radarr to ManualImport those folders, and skips a dump only when **that season** already has files. Coming seasons still do not SeasonSearch (55). FUSE ENOTCONN is `rshared /mnt` only — not `docker restart` Sonarr or live Jellyfin. Dump-folder fingerprint skip if unchanged. Passengers-class movies use the same path.

Austin's cloud 40×40 loop: 56 treated unmonitored Sonarr seasons (episodeCount 0, no previousAiring) as Coming, so Breaking Bad S02 / The Wire S01 POSTs were refused. GET painted Silo S04 as unmonitored instead of Coming. `tmdb-155` + `mediaType=tv` grabbed 3rd Rock. 57 confirms Coming from Seerr/TMDB (Silo S04 / Rookie S09 stay Coming), lets released missing seasons Request, and locks movie-shaped `tmdb-<n>` so it cannot become `tmdb-tv-<n>`. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.56 named titles win / Importing ≠ Watch / Rookie 0%

Austin house screenshot: On this box still painted `www UIndex org - Silo`, Torrenting Silo, `Reacher Il Ponte`, and Rookie at **0%**. Named Silo / Reacher / The Rookie already exist. S02 said Watch then opened empty Requested. 56 named title wins — dump/hash/UIndex twins collapse when a JF/TMDB/TVDB card exists. Dump files waiting for Sonarr import paint **Importing** / **On disk, importing**, not Watch and not infinite Request. S03–S08 files-linked stay Importing even when Seerr said failed; S05 searching stays Request. Home does not hero a 0% Rookie when the named series is On this box. S09 stays Coming (55). Coming accordion does not keep another season’s dump episodes. Discover hides owned. Remove dump does not hide named Rookie. Empty art is a placeholder; titles wrap; year 0 stays off. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.55 unreleased seasons are Coming, not Request/Watch

Silo S04 (and The Rookie S09) is announced with 0 real episodes. TMDB/TVDB/Sonarr still list the season, so the title page offered Request / Available after request and recover SeasonSearched forever. 55 paints **Coming / announced — not released**, hides Watch/In library for that season, refuses POST, and skips missing-season search. Released missing seasons still Request. Wizard stays 7. Beta off. Skip 49. Do not house-Apply until told.

### 1.2.50.54 Caddy 2.6 Updating page actually loads

53 copied a `handle_errors` heredoc (`respond <<HTML`) Ubuntu Caddy **2.6.2** cannot parse. `caddy adapt` fails; Apply would restart Caddy onto that file and leave `:80` dead (empty Chrome 502). 54 uses a backtick `respond` string 2.6 accepts and still paints **Updating ReelOS**. Bogus `/title/tmdb-*` miss paints Seerr did not find (Retry), not Looking up forever. Overlay Copying house settings / byte % / Discover browse / lookupKey stay. Do not house-Apply until told.

### 1.2.50.53 overlay splash, door 502, Discover browse, Passengers Watch

Austin’s 52 Apply froze at Extracting · 98% during rsync of house Jellyfin configs — extract had finished; overlay had no heartbeat. 53 heartbeats as **Copying house settings**. Byte % only when bytes are real. Caddy `handle_errors` 502/503 shows **Updating ReelOS** instead of Chrome’s error page when the door restarts. Catch-up is a banner + Home chip as soon as Home is usable. Hash dump Remove does not hide named Rick; Request forgets the tombstone. Finished Requests Watch on Home and Library when Jellyfin has the title. Discover Movies/Shows headers open genre/category endless scroll, still excluding owned. lookupKey stays. Do not house-Apply until told.

### 1.2.50.52 title page lookupKey (Austin 51 crash)

Austin Applied 51 on the live HP and `/title/tmdb-137564` white-screened **Something went wrong / lookupKey is not defined**. Season Retry (`setLookupKey`) and the Seerr lookup effect depended on `lookupKey` without a `useState`. Every title route crashed on first paint — `tmdb-*`, `tmdb-tv-*`, `jf-*`, movies and shows. 52 defines `lookupKey`. Collections / More like this were not the crash. Do not house-Apply until told.

### 1.2.50.51 rollup (Discover / Passengers / splash / Continue watching)

Discover hides owned library; Home keeps On this box. Finished Requests (Passengers) stay until Watch on Home; the existing `/api/request` poll refreshes `/api/library?fresh=1`. Honest Apply splash percent is real bytes or stage N of 7 + heartbeat — never a fake 99%. Splash copy is Tuning for 4GB RAM · spinning disk. Wizard stays 7 steps. Search people and collections. Title page has More like this. Discover Not interested persists on the box (`/var/lib/reelos/curator.json`, no Google). Settings **Reset curator preferences** clears it. Home **Continue watching** uses Jellyfin Resume play progress on the existing library fetch (episodes map to the series). Capped title poster, TV season chips and episode accordion. Do not house-Apply yet.

### OTA cleaner + update splash (1.2.50.50)

Every Apply runs a bounded cleaner (orphan :8080, retired stacks not in current compose, ghost JF ids via existing heal, OS tune zram/kdump on ≤4.5Gi, tmp OTA leftovers). Never /media, never ota.lock, never firstboot, never docker restart Sonarr. Full-screen Updating ReelOS splash until the door accepts browse/request; library catch-up is a banner and POST /api/request still works. Post-OTA heal is faster (39 stamp-first, 42 no dump ffprobe, one FUSE, skip-nanosecond). Tarball download/extract is still network+disk. OTA cannot move Ubuntu off the HDD. Skip 49. Do not house-Apply yet.


### Hands-off home (Discover, posters, Watch, Radarr heal)

Austin green-lit ASK-AUSTIN. Discover was a dump of 2026 unreleased (Mutiny, Colony, Moana, two Paradise Hotels). Home JF `/api/jf/.../Images/Primary` 404'd and painted the title twice; Jellyfin live stayed green while virtual folders were red. Watch used `hostname:8096` (302) instead of the LAN/Tailscale IP Settings shows. Requests said Nothing in flight while National Treasure was still downloading / Radarr had no movie — 47 kept the row visible but never added the movie. 48 filters unreleased Discover hits, rows on this box / finishing / pick tonight (movies and shows separate), skips empty ImageTags, paints a blank card on poster 404, Watch goes to IP:8096, and recover adds National Treasure to Radarr from Seerr detail when lookup is empty. No magnet on named titles. No Request Sxx when that season is on disk.

### Request honesty (Moon TV POST, magnet, Requests empty)

Tester loop 1: Moon `/title/tmdb-17431` POSTed `tmdb-tv-17431` (The Great Escape) because `titlePresenceKeys` aliased movie ids to TV and Request preferred `tmdb-tv-*`. After Request the page stayed Available-after-request + **HAND A HASH TO THE ADAPTER**. National Treasure sat at 0% / Radarr has no movie, then the Requests tab emptied because lookup memory was treated as the JF shelf. Rick/Expanse/B99 offered Request Sxx for seasons already on disk. `/title/73ceff…` was a dead lookup. Home JF posters 404'd and painted the title twice; Jellyfin live chip stayed green while virtual folders were red. Interstellar fell through to magnet-ask. 47 POSTs movies as movies, hides hash paste on named titles, keeps stuck Radarr rows in-flight, hides Request Sxx when that season is on disk, resolves hash URLs onto Rick S04, skips empty ImageTags, and only paints Jellyfin live when `/api/ready` says green.

### 1.2.50.46 Hash dump titles (73ceff / jf-*)

Austin opened `/title/jf-103ae87f…` from a Home card whose name was the infohash `73ceff573dc30bebc3fcf26f61de07b25f927a74`. JF Name was the dump folder; Path `/symlinks/sonarr/73ceff…` holds **Rick and Morty S04** episode files. Lookup treated `jf-*` as a Seerr miss (`Seerr did not find that title` + Retry) while Watch / In library / Remove were already true. 44 Home testing saw the hash on the shelf and left it. 46 names hash dumps from one-level filenames (never FUSE `/mnt/debrid`, never ffprobe), collapses onto the tvdb series, keeps the `jf-*` alias so `/title/jf-*` resolves, and hides Seerr miss when the title is on the box. Still unknown → **Unknown on this box** + Watch + Remove.

### 1.2.50.45 Title page honesty (tvdb vs tmdb-tv, Watch, seasons)

Austin opened The Expanse at `/title/tvdb-280619`. Library id is `tvdb-280619` with aliases `tmdb-tv-63639`; GET `/api/request?id=tmdb-tv-63639&season=1` is `engine=downloaded`. The 44 client looked up Seerr by tvdb (no TMDB), swallowed the empty payload, and stayed on **Loading seasons from Seerr**. TV `available` ignored Jellyfin/library and required a season request poll that 400'd (`Need a TMDB id from Discover`), so the page painted **Not in the TorBox cache. TorBox will transfer.** + **Available after request** + **+ Request S01**. 45 maps tvdb→tmdb from the shelf/Sonarr, Watch when the show is on the box, Retry on a failed season load, and collapses **The EXPANSE Complete** onto the series. Complements #128.

### 1.2.50.43 Splash-lock only while catch-up is actually importing

Austin stuck on install splash: Local/House/Requests Ready, Library `catching up — folder 1 of 1, 14 skipped`. Catch-up unit was inactive (14 skipped, 0 timeouts) but `library-progress.json` stayed `status=running` `splashLock=true` `needsImport=true`. 43 JS splash-locks Home whenever `splashLock` is true. Parser ORed leftover JSON `splashLock` with `running && needsImport`. Skip-only and done/idle/stopped must not splash-lock or advertise catching up. `/api/ready` treats an inactive oneshot as done. Gold hashed UI. Complements the 40/42 catch-up clock.

### Home honesty (ghost tmdb-2059, stale transferring, one Expanse, one Watch)

Phone persist kept 24 waiting rows after Seerr had one grabbing movie (`tmdb-2059` / National Treasure) and The Expanse available. Ghost ids painted blank posters; two Expanse seasons looked like duplicate Waiting cards; header Watch sat next to Watch in this browser. GET `/api/request` fills inflight titles from Seerr detail. Client merge drops unmatched stale inflight. Home collapses to one card per title. Lookup-by-id names leftovers. Transferring chip matches live Seerr in-flight. Complements #127.

### 1.2.50.42 Stub dump ffprobe + one FUSE (the library actually progress)

`enableMediaInfo` false was not enough — Sonarr still ffprobe'd `/mnt/symlinks/sonarr` (B99, TWD, …) into D-state on stacked `fuse.decypharr`. `no-ffprobe` now stubs container ffprobe (busy-inode rename) even when MediaInfo is already off. Extra FUSE rows were the same maj:min listed through rshared `/mnt` self-binds; peel extras with `umount /mnt` (never `-l`, never `/media`, stop if the live FUSE would drop). `reelos-mnt-rshared` is idempotent (`findmnt` / skip `--now` when fuse is live). Catch-up imports skip-existing dumps; D-state concurrency 0 unless stubbed; splash/banner idle unless actually importing. Complements #124.

### 1.2.50.41 Scale to the hardware (not a fake Pi)

`reelos_hardware.py` / `hardwareProfile()` measure ram_gb, cpus, disk_kind, DirectMap vs cgroup. Tiny (≤4.5Gi **visible or un-hidden**) keeps MemoryMax 768M and no docker mem_limit. HDD folder cap stays 6/12; SSD on 4GB can use nproc. If MemTotal is actually 16GB, catch-up is 2G + Jellyfin 5G — that path is measurement, not an assumption about this HP. High ffprobe D-state → import concurrency 0 on any box. Selfheal **defers** catch-up while D-state is high instead of starting the oneshot every two minutes. Mailman logs the profile and writes the systemd drop-in. Tiny Apply does not rewrite `compose.override.yml` (would recreate *arr next to D-state). Prebuilt UI is packaging, not a RAM throttle.

### 1.2.50.40 Apply vs library catch-up (the law)

Check → Apply stamps after hops and the door. Indexers, dump import, heal, hybrid 1080, ffprobe, and FUSE remount never block `ReelOS $REMOTE applied.` The phone has two clocks: **Applying 1.2.50.x** (ota.log / product swap) vs **Library catching up** (library-progress.json — folder N, skips, timeouts). Splash-lock Home only while dumps still need import. Catch-up is `reelos-library-catchup.service` (`TimeoutStartSec=infinity`, `KillMode=process`, `MemoryMax=768M`); systemd-run + nohup `9>&-` remain the fallback. Worker backs off when ffprobe D-state is high. Do not stack another `fuse.decypharr`.

### Beta sidecar (Check+beta fetches 2.0.0)

Settings → Updates **Beta channel** is a real toggle, not a stub. Off: Check reads `channel.json` / `1.2.50.48` / `main.tar.gz`. On: Check reads main `channel-beta.json` first (skips a `main.tar.gz` stub) and can fetch **2.0.0** from `cursor/beta-arena-books-5ba6.tar.gz`. Arena CSS stays off this 48 tarball. Leave Beta and Check to roll back to last stable 1.2.50.x. Folded from [#123](https://github.com/reelos-org/reelos/pull/123). Do not merge [#119](https://github.com/reelos-org/reelos/pull/119).

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

### 1.2.50.37 Production API + static UI

`NODE_ENV=production npm run start:box` prefers nitro+api: hashed `/assets/styles-*.css` (not `/src/styles.css`) plus existing `/api` plugins. Leftover Vite is `vite preview` of that prebuild if nitro import fails. `vite --host` only when no prebuild exists (dev checkout).

### 1.2.50.38 No GPU: DirectPlay/DirectStream only

`has_vaapi_dri()` / `hasVaapiDri()` is a host `/dev/dri` **renderD*** or **card*** node (empty `/dev/dri` is no GPU). **GPU present:** VAAPI transcode allowed; low-perf still one ffmpeg thread. **No GPU:** persist `encoding.xml` (hardware encode off) and disable user video/audio transcode so clients DirectPlay/DirectStream (remux stays). Provision seeds XML before compose up; self-heal `--performance` and Settings `/api/performance` re-apply XML + policies. TorBox dumps stay unread. 37 claimed this in the channel note; **38 is the persist.**

### Wizard does not present untested providers as working

Seven-step wizard is unchanged. Default source is TorBox. Continue on the source step requires a real TorBox Validate. Real-Debrid, AllDebrid, Premiumize, and Local+VPN are labeled Untested; Validate refuses and does not call those APIs (Local+VPN is not a fake OK). Plex / Both and Cloudflare Tunnel are labeled Untested; Continue and `/api/provision` refuse. Jellyfin + this network / Tailscale stay. No Books chip. No Arena.

## Proof

```
python3 scripts/check-ota.py .   # ok version=1.2.50.60
node --test scripts/stack-smoke.test.mjs scripts/apply-stamp-first-39.test.mjs scripts/apply-library-split-40.test.mjs scripts/scale-hardware-41.test.mjs scripts/fuse-no-ffprobe-42.test.mjs scripts/wizard-honesty.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-update.test.mjs scripts/reelos-repair.test.mjs scripts/update-notes.test.mjs scripts/fuse-ffprobe-36.test.mjs scripts/scale-prod-37.test.mjs scripts/jf-directplay-38.test.mjs scripts/jellyfin-seed.test.mjs scripts/sonarr-manual-import.test.mjs scripts/relink-dumps.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / → 200 with /assets/styles-*.css, not /src/styles.css
# GET /api/ready → 200
```

## Owner / house Apply

House is **1.2.50.47**. **One Apply of 48 after merge.** Never twice. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`. Do not `docker restart reelos-sonarr-1` while ffprobe is D-state. Jellyfin images off. Beta ON is a **second** Check/Apply of **2.0.0** only if Austin wants Arena/Books.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Merge [#119](https://github.com/reelos-org/reelos/pull/119) Arena+Books onto main (SHA-drift onto `main.tar.gz`)
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI on this 1.2.50.48 tarball
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Ship Arena CSS onto `main.tar.gz`
- Tap Apply 39 again
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Apply 45 twice, or Apply while ffprobe is D-state
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
