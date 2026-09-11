# How this repo is laid out

The GitHub front page is the product pitch. This file is the map.

## If you already have a box

Current OTA is whatever `VERSION` / `channel.json` say (today **1.2.3**).

On the phone: Settings → Updates → Check → Apply.

If Check is stale, from SSH:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/v1.2.3/daemon/reelos-update.sh | sudo bash -s apply
```

Pin a commit SHA if the tag CDN is old. Wait for `ReelOS x.y.z applied.`

Do not re-run the wizard. Do not stamp `VERSION` by hand.

## Folders

| Path | What it is |
|---|---|
| `src/` | ReelOS web UI. This is what boots on `:8080`. |
| `scripts/` | Vite plugins (`/api/lookup`, `/api/box`). `house-bench.sh` is the read-only SSH probe of the house HP. |
| `daemon/` | OTA updater, engine wiring, doctor. Copied to `/opt/reelos/bin`. |
| `install/` | Disc payload: compose stack, systemd, installer. |
| `iso/` | Bake a USB. Output is **not** committed. |
| `compose/` | Working copy of the stack file. Canonical for the disc is `install/compose/`. |
| `firstboot/` | Live-USB helpers (wifi, console). |
| `ui/` | Pointer. Not a second app. Real UI is `src/`. |
| `channel.json` + `VERSION` | OTA. Tarball is the git tag `vX.Y.Z`. |
| `HAL.md` | Hal → xorriso. Do not edit. |
| `STATUS.md` | xorriso → Hal. |
| `docs/OTA-APPLY-AUDIT.md` | Whether Phone Check→Apply is trustworthy. House verify checklist. |
| `docs/STACK-RISK.md` | Stacked `#45`–`#51` go/no-go + merge order for house Apply. |

## House bench (agents)

The integration bench is the house HP over Tailscale SSH (`reelos@100.100.154.16`), not this cloud checkout and not a Cloud Agent snapshot. Hardware is HP 15-bs0xx, 4GB, HDD — not a Pi.

```
bash scripts/house-bench.sh
```

FUSE, ffprobe, mailman Apply, and dump import are proven there. Cloud `npm test` / `start:box` is not that proof. The script is read-only (`HOUSE_BENCH_WRITE=0`). It will not Apply.

## Rules that belong here, not in README

- Request in ReelOS. Watch in Jellyfin or Plex (`http://<ipv4>:8096` on the LAN).
- No indexer list in the tree. Paste your own.
- No API keys. No ISO files.
- Default login `reelos` / `reelos` — change it.
- TVs do not use `.local`.

## Cutting a disc

```
node iso/pack-appliance.mjs
bash iso/remaster-iso.sh
```

Only when the installer itself is dead. Point updates are OTA.
