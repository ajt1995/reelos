# STATUS.md

***1.2.50.29 is the ship.*** 2026-09-10. Apply of 28 starved the 4GB box copying FUSE dumps (`decypharr/cache/dfs`) so Vite never bound; the phone saw Begin setup on a provisioned house. This stamp skips those dumps, restarts hung Vite at 15s, and boots through one `/api/ready` fan-in with an honest warming splash. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.29`
- **Base:** `main` at 1.2.50.28
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Apply does not copy FUSE dumps

`rsync` overlays `compose/configs` excluding `decypharr/cache/`, `**/cache/dfs/`, Jellyfin cache/transcodes, MediaCover, logs, and sqlite sidecars. If `rsync` is missing, copy only top-level app dirs without cache/dfs.

### probe_home restarts hung Vite at 15s

`systemctl start` is a no-op on a hung unit. After ~15s without :8080 200, `systemctl restart reelos` once. `daemon-reload` first if the unit changed.

### GET `/api/ready` — one fan-in

Parallel, short timeouts: provisioned + answers (handleBox sync slice, no await Jellyfin), update status, library shelf (limit 24, prefer cache), request list (progress-plugin assembler, no per-title Seerr fan-out). `start_fuse_readers` equivalent docker-starts *arr in the background and does not block the response. Omits `adminPassword`.

### Warming splash

When persist or the box says provisioned, splash spins the cyan ring and shows Local state / This house / Library / Requests. After `/api/ready` or a 4s abort, Home opens even if library/requests are still filling. Marketing Begin setup only when not provisioned.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-request-status.test.mjs scripts/jellyfin-seed.test.mjs scripts/reelos-ready.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**. 27/28 already restore the door; 29 should not 502 from a FUSE config copy.
2. Splash should show warming steps, then Home — not Begin setup.
3. Radarr/Sonarr should come back from `/api/ready` without SSH.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
