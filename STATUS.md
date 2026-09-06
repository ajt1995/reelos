# STATUS.md

Xorriso. Dated **2026-09-06 12:42 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. No ISO. **Stop committing** unless Home is broken after they apply.

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

## Closed this pass

- Plex bind `0.0.0.0:32400` when profile is on. First-run/claim still **not Plex done**.
- Probe `:80` and `:8080`. Stock Caddy welcome on :80 fails the probe.
- Console card: LAN IPv4 first, large. `reelos.local` optional, last.
- Empty Home: search only. No fake TITLES row.
- Reset → `provisioned` false → wizard, then Connect.
- Doctor: “Decypharr restarting” when the container is in a restart loop.

## Already closed

SHA apply, dual `/symlinks`, library canary.

## HP

Not applied. No fake house curls.
