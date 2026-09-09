# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.7** (EZTV/ShowRSS actually land; doctor lists them). Does **not** take 1.2.51 (Tron reserved).

## Why 1.2.50.6 was not enough

House `/api/doctor` on 1.2.50.6: releases detail **ReelOS-tpb only**. `GET /api/request?recover=1` kicked SeasonSearch seriesId 3 and 5 (`searched=true importSpawned=true`) and they stayed `sonarr-missing@0`. Search ran; nothing grabbed.

Stacked bugs:

1. **Add skip.** `#58` POSTed EZTV/ShowRSS only when Cardigann schema hints (`eztv`, `showrss`) matched. Native `TorrentRssIndexer` does not contain those strings. House kept TPB.
2. **Doctor lie.** First live-test pass hid missing EZTV.
3. **Ultra-HD cutoff.** Wizard hybrid → Sonarr 2160p-only. EZTV 720p WEB-DL rejected. Expanse 4K packs pass.
4. **No grab client.** `reelos-lock-clients.service` FAILED (oneshot default 90s; lock+sweep can exceed it). Recover only POSTed SeasonSearch — never upserted Decypharr. Command succeeds; queue stays empty.

`/api/performance {"low": true}` is Jellyfin trickplay only. It does not change *arr search.

recover=1 now: lock Decypharr client on Sonarr, fall Ultra-HD series back to **Any** if 720p is not allowed, then SeasonSearch.

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
