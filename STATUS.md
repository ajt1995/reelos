# STATUS.md

Enlisted Grok. **2026-09-08 04:00 CDT.** Did not edit HAL. No books/Kavita. Settings HouseCard dedupe (identity/access only).

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main). Tip had ManualImport + wire-engines parts (`78b7956`).

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## Lab (box `/workspace/reelos-lab`)

**Lookup/add PASS** (prior): Mad Max Fury Road + Mr. Robot present in Radarr/Sonarr.

**Indexers wired (ReelOS public-fallback pattern):**
- TorBox Torznab POST → HTTP **400** `Name does not resolve` (`search-api.torbox.app` has **no DNS A/AAAA** via CF/Google DoH). TorBox key still **200** on `api.torbox.app/v1/api/user/me` via `with-torbox.sh` (key not printed).
- Prowlarr: `ReelOS-tpb` + `ReelOS-yts` **test PASS**. 1337x/eztv CF-blocked.
- Prowlarr apps Radarr/Sonarr **test PASS** (bridge IPs). Synced Torznab into *arr.

**Search evidence:**
- Radarr `GET /api/v3/release?movieId=1` → **200**, **reports=103** (Mad Max: Fury Road).
- Sonarr `GET /api/v3/release?episodeId=74` → **200**, **reports=14** (Mr. Robot S01E01).
- Grab `POST /api/v3/release` → **500** `Torrent Download client isn't configured yet`. Queue `totalRecords=0`.

**Jellyfin:** wizard completed; libs **Movies→/media/movies**, **TV→/media/tv** (API 204). Item count 0 (empty media dirs).

**Hard stop:** full grab→file→Jellyfin needs **Decypharr download client + host FUSE** (`/mnt/debrid`). Lab has no Decypharr/FUSE; stop after proving reports > 0.

## This stamp

**BLOCKER tip:** `settings-view.tsx` accidentally overwritten with placeholder text on tip (`c5ba712` / `8b8d7e6`). Ready decluttered body on box: `/workspace/reelos-settings/settings-view.tsx` (+ `PUSH.json`, sha256 `dab05fe698b15368fb242f0373bf8a789323d1245b1659516ff5c15def022886`). Parent must `push_files` that body before any Apply.

**Settings declutter (ready, not yet on tip .tsx):** HouseCard slimmed to user/PIN/LAN/hostname/Jellyfin/Tailscale — dropped Source/Quality/Collecting/Watch (accordion rows already cover). Dead `InstallRow` removed. Soft density only. UpdatesRow Check/Apply still wired to store `checkForUpdate`/`startUpdate`. VERSION untouched.

**wire-engines restored via parts+shim** (daemon + install/bin):
- `wire-engines.py` = shim that joins sorted `wire-engines.parts/*.part`
- Complete parts `00–09` on both trees; joined body = slim (~59408 bytes)
- Joined body has ManualImport loader (`reelos_sonarr_manual_import` ×1, `sonarr_manual_import` ×6)
- Companion `sonarr_manual_import.py` on branch — movies/TV ManualImport hooked via module

**Still warn — house Apply only after phone UI Check path:**
- Do **not** Apply from a feature-branch URL until Hal names it
- Phone **Check → Apply** when ready; prove Logs `files=` / `series=` > 0

## Next

1. **Restore** decluttered `settings-view.tsx` from box `PUSH.json` via GitHub MCP `push_files`
2. House Apply **1.2.47** from this branch only when named
3. Lab Decypharr+FUSE only if grab→JF path must be proven on box
