# STATUS.md

***1.2.50.24 is the ship.*** 2026-09-10. House is still stamped **1.2.50.22**. This Apply stacks 23 (honest Apply bar / box probe / Settings persist) with request recover: unmonitored Seerr seasons and missing *arr rows actually search. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.24`
- **Base:** `main` at 1.2.50.22 (#79 / #80 / #81) plus 1.2.50.23 honesty
- Did **not** take Tron chrome from #52 / #70

## Changelog

Proven against the live house on Tailscale (`100.100.154.16`). Doctor hops were already green on 1.2.50.22. Requests were not.

### Recover monitors requested seasons and adds a missing series

House GET `/api/request` sat on 22 **Season unmonitored in Sonarr — search will not run** rows (later seasons of shows already on the shelf), plus **Requested — Radarr has no movie yet** and **Requested — Sonarr has no series yet**. Recover skipped unmonitored seasons, never added a missing Sonarr series, and Home never called `?recover=1`. SeasonSearch on an unmonitored season is a no-op.

Recover now monitors the requested season (or adds the series, same as Radarr already added a missing movie), then SeasonSearch. GET recover also reads Seerr media ghosts so per-season rows are in scope. Home's first poll sends `recover=1`; kicks run in the background so the list does not wait on 20 SeasonSearch commands.

### Requests Retry is visible on locks

A downloading row with "search will not run" / "has no movie yet" only offered Cancel. Retry (POST `/api/request`) is the write that monitors and searches. Retry now shows for those locks. Rows take a title from *arr or Seerr so the list is not `tmdb-tv-1402`.

### 1.2.50.23 honesty (still in this Apply)

Phone shows Applying while mailman is still in hops (`ota.lock` flock). `/api/box` no longer calls a slow VirtualFolders timeout Missing library. Settings auto-update no longer 500s. Shelf strips a trailing `(Year)` that matches ProductionYear. Apply `ufw allow`s 80/8080/8096 when Caddy is restored.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/reelos-ota-status.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-library.test.mjs scripts/reelos-request-status.test.mjs scripts/reelos-seerr.test.mjs scripts/jellyfin-seed.test.mjs
python3 daemon/reelos-doctor.py --self-test
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.24`.
3. Next Apply (phone or CLI) shows the gold bar until mailman prints `ReelOS 1.2.50.24 applied.`
4. Open Home or Requests once. Unmonitored requested seasons leave "search will not run". Settings → Updates daily toggle does not error.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media` or TorBox
