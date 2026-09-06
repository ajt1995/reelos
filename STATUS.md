# STATUS.md

Xorriso. Dated **2026-09-06 11:48 CDT**.

**1.2.15 is not done.** No 1.2.16. Owner out. One apply on the HP:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

Tarball is `main.tar.gz`. Updater not rewritten this pass. Table is **sandbox**. No HP curls.

## Sandbox curls (2026-09-06 16:47 UTC)

**1. Request status** (queued / grabbing / downloaded / failed — no percents)

```
curl -sS 'http://127.0.0.1:8080/api/request?tmdb=414906'
# {"status":"unknown","engine":"radarr","error":"Movies engine has no API key"}

curl -sS 'http://127.0.0.1:8080/api/request'
# {"status":"unknown","error":"Need tmdb, tvdb, or id"}
```

**2. Box red until LAN Jellyfin + libraries**

```
curl -sS http://127.0.0.1:8080/api/box
# jellyfin: {"state":"red","detail":"Jellyfin not on :8096","libraries":[]}
# ui http://172.16.0.2   watch http://172.16.0.2:8096
```

**3. Caddy :80 → ReelOS, :8096 Jellyfin**

```
curl -sS http://127.0.0.1:8080/api/ports
# {"ui":80,"shell":8080,"jellyfin":8096,"caddyHas80":true,"caddyTo8080":true}
```

This sandbox is not Caddy. The Caddyfile on disk reverse-proxies `:80` to `127.0.0.1:8080`.

**4. Box PIN**

```
curl -sS -X POST http://127.0.0.1:8080/api/password -H 'Content-Type: application/json' \
  -d '{"current":"nope","next":"abcd"}'
# {"ok":false,"error":"Current PIN does not match"}

curl -sS -X POST http://127.0.0.1:8080/api/password -H 'Content-Type: application/json' \
  -d '{"current":"reelos","next":"abcd"}'
# {"ok":true,"jellyfin":false,"boxUser":false}
```

Jellyfin/chpasswd false here (no those services). Settings has Box PIN.

**5. Doctor one-liners**

```
curl -sS http://127.0.0.1:8080/api/doctor
# Lookup hop: lookup dead (TimeoutError)
# Request hop: request dead — Radarr
# Decypharr hop: decypharr dead
# Prowlarr hop: indexers dead — Prowlarr
# Jellyfin hop: jellyfin dead
```

**6. Quality profile vs wizard**

```
curl -sS http://127.0.0.1:8080/api/quality
# {"wanted":"hybrid","profile":"Ultra-HD","radarr":null,"sonarr":null,"error":"no engine keys"}
```

Request add uses that named profile when Radarr exists.

## HP proofs

Not run. Owner is not on `192.168.1.233`.
