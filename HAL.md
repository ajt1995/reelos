# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 20:16 CDT**.

## Ship **1.2.16** on `main`. Then they Apply once.

House is done typing. Do the work in the OTA.

Bump `VERSION` and `channel.json` to **1.2.16** so Settings Check lights up.

### 1. Jellyfin auth + libraries

Wire loops `jellyfin auth retry` because `StartupWizardCompleted` is true and `answers.json` password does not match the Jellyfin owner. Libraries never get created.

- Try `answers` user/pass, then `reelos` / `reelos`, then any other local combo you can detect.
- If still no token: reset **only** Jellyfin config (keep images, keep `/symlinks` files), complete startup with `answers` name+password, create Movies/Shows on `/symlinks`.
- They will not use the Jellyfin wizard. Auth retry must not block the rest of `main()`.

### 2. TorBox indexer DNS

`search-api.torbox.app` does not resolve via the box `getent`. `api.torbox.app` does (Cloudflare IPv4). Prowlarr 400 `Name does not resolve`. `/mnt/symlinks` has no movies.

- Compose DNS for Prowlarr/Radarr/Sonarr/Decypharr: `1.1.1.1` and `8.8.8.8`.
- Make `ReelOS-torbox` add succeed from this network. If the search host still has no DNS, use a working TorBox API/Torznab base that resolves (`api.torbox.app` / official torznab) or `extra_hosts` for `search-api.torbox.app` to a live IPv4. Do not invent other indexers.
- Doctor `releases` must be able to go green on this HP.

### 3. Settings in chrome

Issue #6: no Settings control. Add a visible Settings link in the shell. `/settings` stays valid.

No parked-branch merges. No ISO. One apply after you stamp 1.2.16.
