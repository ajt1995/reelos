# STATUS.md

Xorriso. Dated **2026-09-06 11:36 CDT**. Proof is curl, not a card.

VERSION **1.2.15**. Tarball `main.tar.gz`. No 1.2.16. No new tag.

Door (HP, still 1.2.8):

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

These curls ran **2026-09-06 16:35 UTC** against the live 1.2.15 tree (`127.0.0.1:8080` in Build, plus GitHub).

## Channel / mailman

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json
```

```
{"version":"1.2.15","tarball":"https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz"}
```

```
curl -sSI https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz | head -5
```

`HTTP/2 302` → `codeload.github.com/ajt1995/reelos/tar.gz/refs/heads/main`

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | head -3
```

```
#!/bin/bash
# ReelOS OTA. Stage in .next while :8080 keeps serving. mv, then probe, then stamp VERSION.
# Rollback is rename .prev. Never apt Chromium or Tailscale.
```

## 1. Connect + Jellyfin probe

```
curl -sS http://127.0.0.1:8080/api/box
```

```
{"provisioned":false,"ipv4":"172.16.0.2","watch":"http://172.16.0.2:8096","jellyfin":{"state":"amber","detail":"Still starting"},"adminName":"reelos","adminPassword":"reelos","tailscaleAuth":null,"tailscaleInstalled":false,"tailscaleUp":false}
```

Amber = not pretending live. Red would lock TV/phone cards. After apply on the HP (Jellyfin up):

```
curl -sS http://127.0.0.1:8080/api/box
curl -sS http://127.0.0.1:8096/System/Info/Public
```

Expect `jellyfin.state=green` and `watch=http://192.168.1.233:8096` (not docker0).

## 2. Lookup titles

```
curl -sS 'http://127.0.0.1:8080/api/lookup?q=x'
# {"titles":[],"error":null}

curl -sS 'http://127.0.0.1:8080/api/lookup?q=Batman'
# {"titles":[],"error":"Movies/TV engines have no API key yet"}
```

Hop is real. This sandbox has no Radarr. After apply on the HP:

```
curl -sS 'http://127.0.0.1:8080/api/lookup?q=Batman'
```

Expect `titles[0].title` (The Batman) and `id` like `tmdb-414906`.

## 3. Request + Doctor hops

```
curl -sS -X POST http://127.0.0.1:8080/api/request -H 'Content-Type: application/json' -d '{}'
# {"ok":false,"error":"No title"}
```

```
curl -sS http://127.0.0.1:8080/api/doctor
```

Hops present: **Lookup hop**, **Request hop**, **Decypharr hop**, **Jellyfin hop**. Here they are dead (no Docker). That is the truth, not a green card.

On the HP after apply:

```
curl -sS http://127.0.0.1:8080/api/doctor | python3 -m json.tool
curl -sS -X POST http://127.0.0.1:8080/api/request \
  -H 'Content-Type: application/json' \
  -d '{"id":"tmdb-414906","kind":"movie","title":"The Batman"}'
```

## 4. Jellyfin library + PIN

From `/api/box`: `adminName` / `adminPassword` / `watch`. This sandbox has no `:8096`. HP:

```
curl -sS http://127.0.0.1:8096/System/Info/Public
curl -sS http://127.0.0.1:8080/api/box | python3 -c 'import json,sys; b=json.load(sys.stdin); print(b.get("watch"), b.get("adminName"))'
```

Library is `/symlinks` via `wire-engines` (`Startup/Configuration` + `Library/VirtualFolders`). Prove on HP after apply:

```
# after Jellyfin login token
curl -sS -H "X-Emby-Token: $TOKEN" http://127.0.0.1:8096/Library/VirtualFolders
```

## 5. Tailscale QR / I've signed in

```
curl -sS -X POST http://127.0.0.1:8080/api/tailscale/check
# {"ok":true,"up":false,"installed":false}
```

OTA does not apt. Install is `POST /api/tailscale/install`. Auth URL from log / `tailscale-auth.url`. HP after tapping Install:

```
curl -sS http://127.0.0.1:8080/api/box | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tailscaleAuth"))'
curl -sS -X POST http://127.0.0.1:8080/api/tailscale/check
```

Not paired. Do not claim remote works.

## 6. Indexer paste / Skip

```
curl -sS -X POST http://127.0.0.1:8080/api/indexer -H 'Content-Type: application/json' -d '{}'
# {"ok":false,"error":"Need URL and API key"}
```

Skip is UI (`setIdxMsg("Skipped")`) — no POST. Paste without URL/key is rejected. No seed list.

## Home

```
curl -sS -o /dev/null -w "GET / %{http_code}\n" http://127.0.0.1:8080/
# GET / 200
```

```
curl -sS http://127.0.0.1:8080/api/update/check
# {"ok":true,"local":"0","remote":"1.2.15","available":true}
```
