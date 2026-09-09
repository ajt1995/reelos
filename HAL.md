# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.7** (EZTV/ShowRSS actually land; doctor lists them). Does **not** take 1.2.51 (Tron reserved).

## Why 1.2.50.6 was not enough

House `/api/doctor` on 1.2.50.6: releases detail **ReelOS-tpb only**. SeasonSearch `searched=true`, B99/TWD still 0 files.

Two stacked bugs:

1. **Add skip.** `#58` POSTed EZTV/ShowRSS only when Cardigann schema hints (`eztv`, `showrss`) matched. Prowlarr's always-on native fallback is `TorrentRssIndexer` ("Torrent RSS Feed") — those strings are not in the blob. House 1.2.24 got native TPB. EZTV/ShowRSS logged `no schema` and Apply still succeeded.
2. **Doctor lie.** `releases_hop` live-tested indexers and returned the **first** pass. TPB passing hid whether EZTV existed.

Hybrid `Ultra-HD` is 2160p-only, so even after EZTV lands, 720p WEB-DL sitcom packs can be rejected. Expanse 4K packs pass; B99 EZTV 720p does not.

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.7 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.7`.
2. Doctor **releases** detail includes **ReelOS-eztv** and **ReelOS-showrss** (comma list). TPB-only is a **red** hop: `ReelOS-tpb (missing ReelOS-eztv,ReelOS-showrss)`.
3. Prowlarr has those two (TorrentRss RSS if Cardigann YAML was missing). Sonarr indexers include them after `fullSync`.
4. Next hop SeasonSearchs B99 S01 / TWD S01 **immediately** (indexer-sync clears the 15min cooldown). Hybrid Sonarr allows 720p/1080p/2160p.
5. Interstellar / John Wick / Expanse already Available stay Available.

Do not Apply the Tron feature tarball as if it were main.
