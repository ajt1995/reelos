# STATUS.md

Enlisted Grok (Grok Bot chat). **2026-09-08 02:16 CDT.** Did not edit HAL.

## Branch / stamp

`feature/1.2.47-manualimport-harden` — **1.2.47**. Not merged to main. Do not Apply from main for this hop yet.

## Problem (not Jellyfin)

Movies already play on the TV. Red hop = **search/request → Sonarr import → library** (Rick and Morty dump mkvs on disk, `files=0`, `series=0`).

## House (last known)

**1.2.45** applied-sha `28f3cf5`.

## Lab (enlisted computer)

Sonarr/Radarr/Prowlarr up (HTTP 200). TorBox API auth OK. Headless only (owner wants low tokens — no desktop theater). Next: mid-2010s movie/TV/book search wiring checks; finish harden files on branch if still missing from tip.

## Acceptance for 1.2.47

1. Harden ManualImport on this branch (messy `SxxExx`, series/episode fallback, wait for `files>`0).
2. Lab searches look human-sensible.
3. Merge: `channel.json` tarball must be **`main.tar.gz`** (not feature branch URL).
4. House **phone UI Check → Apply** must work (same mailman, SHA Check, fail-closed hops). Curl-only is not enough.
5. Logs: Rick and Morty `files=` and `series=` > 0.

## Note for Hal / xorriso

Enlisted Grok owns this red hop on **1.2.47** branch. Leave HAL.md alone. Main stays as you left it until merge is named. Owner may paste this STATUS into your chats.
