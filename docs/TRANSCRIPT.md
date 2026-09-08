# ReelOS — chat transcript for the other Grok

Owner: Austin. Distro: **ReelOS**. Builder here: **xorriso**. Spec writer: **Hal** (`HAL.md`). Mailbox: xorriso writes `STATUS.md`, Hal writes `HAL.md`. Do not edit HAL. Do not bump VERSION unless the owner names a stamp.

Repo: https://github.com/ajt1995/reelos  
Channel tarball: `https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz`  
House box: leftover HP laptop, Ubuntu, headless. LAN was `192.168.1.233` then Ethernet in the basement → **`192.168.1.234`**. SSH user `reelos`. Jellyfin `:8096`. ReelOS UI `:80` (Caddy) and `:8080` (vite).

**Done** = a title plays on the TV. Not a green Doctor card. Not `VERSION` stamped.

Do not: new ISO, indexer roster, Seerr/Kavita/music merges, fake `TITLES` catalog, apt Chromium/Tailscale in OTA, second wizard, README/HAL edits.

---

## What this is

Linux appliance on top of Ubuntu. Wizard once: debrid key (TorBox), Jellyfin, movies/TV. Request from the phone → Radarr/Sonarr → Decypharr → FUSE `/mnt/debrid/__all__` → symlinks `/mnt/symlinks` → Jellyfin on the TV.

Not a piracy distro. No tracker list in the tree. Public Prowlarr indexers (TPB/YTS) were an emergency because `search-api.torbox.app` 530/DNS died on this network. Connect paste + Skip stay valid.

Gemini’s take (owner pasted): you cannot legally ship a pre-built automated media OS; a **bespoke** compose + wire for *this* house is the point. That is ReelOS. A chat operator on the APIs is later, not now.

---

## How we work

1. Hal names a stamp in `HAL.md` (time + VERSION).
2. xorriso builds on `main` (channel = `main.tar.gz`). Feature work was supposed to be `feature/*` + PR, no merge until named. In practice the house fire kept landing on `main`.
3. Owner Applies: phone Settings → Check → Apply, **or** (the mailman that actually works):

```bash
curl -fsSL -H "Accept: application/vnd.github.raw" -H "User-Agent: ReelOS-update" \
  "https://api.github.com/repos/ajt1995/reelos/contents/daemon/reelos-update.sh?ref=main" \
  | sudo bash -s apply
```

4. Proof is a house **Logs** dump (`reelos-house.txt`), not a screenshot of a card. Settings → Logs.

OTA rules that bit us (and are now in the updater):

- Stage in `.next`, keep `:8080` up, probe Home 200, `mv`, stamp VERSION **last**. Rollback is `.prev`.
- Check = SHA drift, not VERSION string (same 1.2.42 applied twice when main moved).
- Caddy `admin off` → **reload is a no-op**. Restart, or the “ReelOS is updating” page sticks forever.
- Flock + stale lock. Dual Apply still doubles the log.
- Fail-closed hops (1.2.44): FUSE `__all__`, Jellyfin `:8096/System/Info/Public`, `/api/lookup?q=Batman` returns titles.
- OTA must not apt Chromium or Tailscale.
- Phone Apply must run the same mailman as SSH (GitHub API, re-exec first). Python urllib on `channel.json` 404’d.

---

## Chronology (compressed)

**ISO / first boot.** Live USB. No Wi‑Fi on the box; Ethernet later. First-boot stopped short: `npm` missing, no `node_modules`, stock Caddy on :80, docker0 down. Wizard/gate white screen (`return null`). Fake catalog. Jellyfin/Decypharr restart loops. Lid sleep. `/dev/sdb` unformatted furniture — never auto-format.

**1.2.1–1.2.14.** Rescue stamps. OTA stopped `:8080` then copied → 1.2.9–13 vanished; house stuck on 1.2.8. Hal ordered **1.2.15 reset**: one complete tree, mailman first.

**1.2.15–1.2.24.** Jellyfin libraries, TorBox indexer, DNS/`extra_hosts`, public indexers after 530, Settings in chrome, low-perf (trickplay off). Canary fail-closed on ReelOS-torbox blocked Apply while search-api was dead. Owner: “how am I supposed to request a movie if you have given up?” → public TPB/YTS so Request could grab.

**Request actually worked.** Decypharr submitted TorBox hashes (Jurassic World Rebirth, Super Mario Galaxy, National Treasure, Guardians, Barbie). Empty symlink dirs because FUSE wasn’t on the host — bind `/mnt` was burying `/mnt/debrid`. Volume split + privileged + rshared.

**1.2.25–1.2.39.** Logger (#5), lid ignore, quality/collections/activity toggles on the box, UI-only OTA skip compose. Movies played on the TV (choppy on Wi‑Fi, better on Ethernet). Show search flaky. Settings freeze on Doctor. Caddy 502 / systemd timeout. Phone Apply spin. Terminal missing then SSH from the second laptop.

**1.2.40–1.2.43.** Version chrome (#8), Tailscale card (#7), cheat sheet. Canary too strict on Tailscale copy. VERSION vs tarball mismatch. Phone Apply: `already running` (stale lock). systemd dbus **Transport endpoint is not connected** after daemon-reload during FUSE. Owner force-rebooted, `start:box` by hand. Door came back 8080/80 200 on **1.2.42**.

**1.2.44.** Fail-closed hops + TTY progress bar. Caddy **restart** not reload. Auto bug files in `/var/lib/reelos/bugs/`. Optional GitHub PAT in Settings → Logs (never in the public tarball). House dump: movies=3 (National Treasure, Barbie, Guardians). **Rick and Morty folders empty, files=0, series=0.**

**1.2.45.** Relink empty dump dirs from `/mnt/debrid/__all__`. Jellyfin token cached as Austin. House dump after Apply: **mkvs are on disk** (S01/S02/S04 episodes listed). Sonarr still `files=0`. Jellyfin `movies=12 series=0`. Relink 33 links. `jellyfin auth as Austin` + library refresh. Dump folders are not a series library.

**1.2.46 (on main, Apply pending or in flight).** `sonarr_manual_import`: match those mkvs to the Rick and Morty series, **copy** into the series folder, refresh Jellyfin. Proof: Logs `files=` > 0 and `series=` > 0, then play on the TV.

---

## House last dump (1.2.45, sha `28f3cf5`)

- FUSE on host. `__all__` has TorBox titles.
- `/mnt/symlinks/sonarr/Rick and Morty - S0{1,2,4} - 2160p HDR Ai Upscale…/*.mkv` exist.
- Sonarr: `Rick and Morty files=0 pct=0`.
- Jellyfin: movies=12 series=0. Auth Austin. Watching `/symlinks`. Removed radarr dump folders as library items.
- Dual Apply (everything in ota.log twice).
- `docker ps` / decypharr logs ETIMEDOUT in the logger (spawn timeout), not necessarily dead.
- wire.log: relink S01/S02/S04 + Jurassic + Mario; radarr/sonarr import scan; jellyfin refresh after import.

---

## Important paths

| Path | What |
|---|---|
| `/opt/reelos` | App + bin + compose |
| `/var/lib/reelos/answers.json` | Wizard (source torbox, frontend jellyfin, apiKey, adminName Austin) |
| `/var/lib/reelos/ota.log` `wire.log` `bugs/` | Logs |
| `/mnt/debrid` | Decypharr FUSE |
| `/mnt/symlinks` | *arr dumps + imported library |
| `daemon/reelos-update.sh` | Mailman |
| `daemon/wire-engines.py` | Indexers, roots, Jellyfin libs, FUSE, import |
| `scripts/reelos-lookup-plugin.mjs` | `/api/lookup` `/api/request` `/api/logs` `/api/doctor` |

SSH:

```
ssh reelos@192.168.1.234
```

(Password is the box password from the wizard; default was `reelos`/`reelos` then they changed it.)

---

## Tickets (do not merge unless named)

Parked: #2 Seerr, #3 Kavita, #4 music, #9 extra disk for music/books never auto-format, #14, PWA, GPU transcode. #1 low-perf and #5 logs shipped. #32 Jellyfin token was the “next wave”; 1.2.45 cached it.

---

## How the other Grok should help

Read `HAL.md`, `STATUS.md`, this file, and the latest `reelos-house.txt`. Patch the hop that’s actually red. Ship one stamp. Wait for a Logs dump. Do not use the owner as a debugger. Do not invent curls they have to type unless Apply is dead.

Current job after 1.2.46 Applies: **Rick and Morty in Jellyfin, playable on the TV.** If `files=0` after 46, the manualimport match failed — fix matching, don’t add a new app.
