# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.7** (EZTV/ShowRSS actually land; doctor lists them). Does **not** take 1.2.51 (Tron reserved).

## Why public TV defs never appear after 1.2.50.6 Apply

House doctor releases = **ReelOS-tpb only**. Not lock-clients. Not catalog. Jellyfin Interstellar×3 is extra library paths (`/media/movies` + `/symlinks` parent + `/mnt/symlinks` bind), not a second grab.

| # | Hypothesis | Verdict |
| --- | --- | --- |
| 1 | `ensure_public_indexers` / OTA hop not run | Hop **does** run on bin-only Apply (`wire-engines.py indexers` even when compose.yml unchanged). |
| 2 | Schema miss for eztv/showrss | **This.** `#58` POSTed only when Cardigann blob contained `eztv`/`showrss`. Native `TorrentRssIndexer` does not. Log `no schema`, Apply succeeded. |
| 3 | fullSync never pushes to Sonarr | Secondary. Defs never landed on **Prowlarr**, so Sonarr had nothing to sync. |
| 4 | Doctor only listing a subset | Also true on 1.2.50.6 (first live-test pass). 1.2.50.7 lists every enabled name and fails closed if EZTV/ShowRSS missing. |
| 5 | lock-clients failure blocking the indexer hop | **False.** Boot unit FAILED does not skip `indexers`. Lock runs after adds (`--quick` before SeasonSearch only). |

## QA five checks (house 1.2.50.6)

1. **Why lock-clients FAILED.** Unit had **no** `TimeoutStartSec` (systemd oneshot default **90s**). Script waited **90s for every app including Lidarr**, then `stuck-downloads` timeout **90s**. Movies+TV house has no Lidarr key → wait never breaks → systemd kills the unit. Sweep (SeasonSearch) never runs. OTA 1.2.50.6 did **not** copy the unit file.
2. **EZTV/ShowRSS POSTed + fullSync.** No. `#58` skipped adds unless Cardigann schema contained `eztv`/`showrss`. Native TorrentRss does not. Prowlarr stayed TPB-only; Sonarr had nothing to sync.
3. **SeasonSearch post-reboot.** Not from lock-clients (unit died in the Lidarr wait). `?recover=1` **did** fire SeasonSearch (`searched=true`) against TPB-only + Ultra-HD → 0 files.
4. **Quality cutoff.** Wizard hybrid → Sonarr Ultra-HD (2160p-only). EZTV 720p WEB-DL rejected. Expanse 4K packs pass.
5. **Wiring.** Schema miss; doctor first-pass hid missing EZTV; lock wait-all-apps; recover did not upsert Decypharr or fall back quality.

1.2.50.7: skip missing Lidarr; wait+sweep **< 90s**; `TimeoutStartSec=180`; OTA copies the unit; HTTP sandbox POSTs `ReelOS-Decypharr` when missing; TorrentRss EZTV/ShowRSS; Ultra-HD → 720p or Any.

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.7 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.7`.
2. Doctor **releases** detail includes **ReelOS-eztv** and **ReelOS-showrss** (comma list). TPB-only is a **red** hop: `ReelOS-tpb (missing ReelOS-eztv,ReelOS-showrss)`.
3. Prowlarr has those two (TorrentRss RSS if Cardigann YAML was missing). Sonarr indexers include them after `fullSync`.
4. Next hop **and** `?recover=1`: lock Sonarr → Decypharr, fall Ultra-HD back to Any if needed, SeasonSearch B99/TWD immediately.
5. Doctor **Download lock** is `Sonarr → Decypharr` (not a static OK). Interstellar / John Wick / Expanse stay Available.

Do not Apply the Tron feature tarball as if it were main.
