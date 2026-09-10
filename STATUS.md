# STATUS.md

***1.2.50.28 is the ship.*** 2026-09-10. Phone UI was unusable: `/api/box` waited ~8s on a Jellyfin PIN probe, `/api/request` waited ~13s on a Seerr-per-title fan-out plus recover-before-list. Home could not paint. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.28`
- **Base:** `main` at 1.2.50.27
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Phone APIs return first; probes run in the background

`/api/box` returns `provisioned` immediately and refreshes Jellyfin in the background. AuthenticateByName / VirtualFolders time out at 1.5s, not 8s.

GET `/api/request` lists from one Seerr call + *arr facts (2.5s cap). It does not fan out `/tv/{id}` per row. `?recover=1` starts kicks without delaying the list.

Client `/api/box` fetch aborts at 4s so splash cannot stick.

This is not a rewrite off Vite. It is the first-paint path.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-request-status.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**. Apply will pause the UI for a minute; 27 already restores the door.
2. Home should appear without an 8s Begin setup stall. Requests should return in a few seconds.
3. Radarr/Sonarr still need to be up for imports. That is separate from this paint fix.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
