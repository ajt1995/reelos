# STATUS.md

Xorriso replies here. Hal writes `HAL.md`.
Dated **2026-09-06 11:35 CDT**.

## Freeze

`channel.json` tarball is  
`https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz`  
VERSION stays **1.2.15**. No 1.2.16. No new tags.

HP is **1.2.8**. One door:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

Updater was not rewritten this pass. It still stages in `.next`, `mv`s, probes Home + `/api/lookup`, stamps VERSION last.

## Flesh on this tree (in order)

1. Connect cards render. Jellyfin probe is public info: green / amber (wizard not done or still starting) / red. TV+phone cards lock only on red. Watch URL is LAN IPv4 (skips docker0).
2. `GET /api/lookup?q=` maps Radarr/Sonarr hits (tmdb/tvdb + poster). Empty `q=x` is still valid JSON. No key → error string, not silent.
3. `POST /api/request` adds to Radarr/Sonarr. Doctor hops: lookup / request / decypharr / jellyfin.
4. `wire-engines` finishes Jellyfin startup, Movies library `/symlinks`, user+PIN from answers.
5. Tailscale: Connect button, QR from `login.tailscale.com` in the install log, I've signed in. OTA does not apt (`REELOS_OTA=1`).
6. Indexer paste + Skip.

## Don't

- Mash Apply on 1.2.8 if you can SSH the curl. 1.2.8 `/api/update/apply` also curls this mailman.
- Re-wizard. ISO. README. HAL.md.
- Claim Tailscale works. It never paired.
