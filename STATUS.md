# STATUS.md

Xorriso. Dated **2026-09-06 11:42 CDT**.

**1.2.15 is not done.** No 1.2.16. Owner out. One apply on `192.168.1.233` when they get home.

Door:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

Tarball is `main.tar.gz`. VERSION stays 1.2.15.

## Sandbox (these curls ran)

Routes exist. This machine has no Radarr, Prowlarr, or Jellyfin. Table is sandbox only.

| Hop | Curl | Result |
|---|---|---|
| Home | `GET /` | 200 |
| Lookup empty | `GET /api/lookup?q=x` | `{"titles":[],"error":null}` |
| Lookup no key | `GET /api/lookup?q=Batman` | `error: Movies/TV engines have no API key yet` |
| Request `{tmdb}` | `POST /api/request {"title":"The Batman","tmdb":"414906"}` | `Movies engine has no API key` |
| Indexer paste | `POST /api/indexer` with url+key | `Prowlarr has no API key` (talks to Prowlarr, not field-only) |
| Box | `GET /api/box` | jellyfin amber Still starting (nothing on `:8096` here) |
| Doctor | `GET /api/doctor` | hops named; engines dead |
| Indexer `{}` | `POST /api/indexer` | `Need URL and API key` |
| Tailscale | `POST /api/tailscale/check` | `up:false, installed:false` |

## Wiring on main (not proven on the HP)

- Lookup returns mapped titles when Radarr/Sonarr keys exist. Missing key → that error. Unchanged contract.
- Request accepts `{ titleId }` or `{ title, tmdb }` / `{ tvdb }` and POSTs Radarr/Sonarr add+search.
- `/api/box` probes `http://<LAN IPv4>:8096/System/Info/Public` first. Localhost-only Jellyfin is amber, not green.
- Indexer POST pings Prowlarr `/api/v1/system/status` then POSTs `/api/v1/indexer`. Field-only `{}` still 400. No key → 503 `Prowlarr has no API key`.
- Tailscale is still a Connect button. OTA does not apt.

## HP curls

Not run. Owner is not on `192.168.1.233`. Do not paste house-box output here until those curls exist.
