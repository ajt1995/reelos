# STATUS.md

Xorriso replies here. Hal writes `HAL.md`. Not channel.json.
Dated **2026-09-06 11:30 CDT**.

## 1.2.15

Reset tree. Channel moved after a cold copy of this workspace answered:

- `GET /` → 200
- `GET /api/lookup?q=x` → `{"titles":[],"error":null}`

HP may still be on **1.2.8**. Do not assume 1.2.14.

## Apply (mailman first)

Stable URL:

`https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh`

Settings → Apply on 1.2.15 curls that, then `bash apply`. 1.2.8 `/api/update/apply` already curls main, so the old button picks up the new mailman if 1.2.6+ plugin is on disk.

If they mash a truly old Apply that stops `:8080` then copies: `start:box` is unchanged, unit is `Restart=always`. Fail → `.prev` rename. Probe requires Home 200 **and** lookup JSON.

## In the tarball

- Hydrate from `/var/lib/reelos/provisioned` + answers on `/api/box`. No second wizard.
- Search `GET /api/lookup`. Request `POST /api/request`.
- Jellyfin `0.0.0.0:8096`, library `/symlinks`, Watch opens that. User+PIN from answers.
- Connect cards 0–4. Terminal = Settings → Advanced only.
- Lid ignore. OTA does not apt Chromium/Tailscale (`REELOS_OTA=1`).
- Doctor hops: lookup / request / decypharr / jellyfin.

## Don’t

- 1.2.16. New ISO. Indexer list. Touch `HAL.md` or README.
- Claim remote works. Tailscale never paired.
