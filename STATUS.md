# STATUS.md

**Reelist (enlisted fixer).** 2026-09-08 ~16:55 CDT. Seerr Discover/Request stamped **1.2.48** and merging to `main`. Did **not** edit HAL.md. Books/Kavita **out**.

## Stamp

- **VERSION / channel:** `1.2.48`
- **PR:** https://github.com/ajt1995/reelos/pull/39 (`cursor/seerr-discover-request-6427` @ includes review fixes `d09c384` + this bump)
- **What it is:** Phone Discover search + title Request go through **Jellyseerr (service `seerr`)** APIs, not custom Radarr+Sonarr `/api/lookup`. ReelOS phone shell stays. TV seasons come from Seerr/TMDB (no uncapped `+ Season`). Requests page hydrates from Seerr so Apply does not wipe the queue.
- **Compose:** `seerr` on profiles `jellyfin` + `seerr`, host `:5055`, Caddy `/seerr*` best-effort — **use LAN `:5055` for admin**.
- **Wire:** `wire-engines.parts/09.part` bootstraps Seerr→Jellyfin + Radarr/Sonarr (with `activeProfileName` / tags). Seeds JF library paths Movies→`/symlinks/radarr`, Shows→`/symlinks/sonarr` (add-only; existing parent `/symlinks` may need one-time remove).
- **Sandbox proof (house, production untouched):** `sandbox-seerr` `:15055` — search Tangled + Resident Alien PASS; POST movie + TV S1 → *arr PASS; seasons `[1,2,3,4]` no specials. Report: agent `pr39-sandbox-lab.md`.

## Channel

`channel.json` tarball = `https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz`.

## Owner / house Apply

1. Merge this tip to **main** (Reelist doing now).
2. House: `reelos-update.sh apply` (or phone Check→Apply). Local was `1.2.47`; remote becomes `1.2.48`.
3. Confirm `reelos` compose starts `seerr` (`docker ps | grep seerr`). Open `http://<box>:5055`.
4. If Seerr first-run still shows: sign in with Jellyfin (same wizard user/PIN). Radarr host `radarr:7878`, Sonarr `sonarr:8989`, roots `/symlinks/radarr` and `/symlinks/sonarr`.
5. **House one-time:** If Movies/Shows still include parent `/symlinks`, remove that path so dump folders are not scanned as series. Optional `/opt/reelos/bin/dump-hygiene.sh`.
6. Proof: phone Discover → Request a movie + a real TV season; Requests still listed after next Apply; title plays / library path works.

## Known gaps (do not block Apply)

- Cancel/Retry on Requests UI are still local-only; Seerr poll restores rows.
- Hash/magnet paste is a no-op on Seerr path.
- Caddy `/seerr` subdirectory hosting is unreliable — prefer `:5055`.
- Heal does not refresh `wire-engines.parts/` (OTA Apply copies daemon tree — OK).
- Old `tvdb-*` title ids cannot Request — search again.

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Merge `feature/3-books` / pirate book indexers.
- Apply a feature-branch tarball — **main only**.
- Hot-patch `/opt/reelos` instead of GitHub→Apply when avoidable.
- Claim green from ports alone — need file/play proof.

## Hal / xorriso

Hal: STATUS only; no HAL edit. xorriso: if you cut ISOs off VERSION, pick up **1.2.48** from main after merge. Phone OTA uses `main.tar.gz` + `channel.json` version compare — ISO not required for house Apply.
