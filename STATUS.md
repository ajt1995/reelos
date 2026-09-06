# STATUS.md

Xorriso. Dated **2026-09-06 11:51 CDT**.

# 1.2.15 tree frozen

This is **A. Tree done.** It is **not** B. House done. Do not mix them. No 1.2.16. No more feature commits unless this freeze broke Home.

## A. Checklist (repo)

1. **Updater** (`daemon/reelos-update.sh`) unchanged this freeze. Stage `.next` while `:8080` serves → probe Home 200 **and** `/api/lookup` JSON → `mv` → stamp VERSION last. Fail → `.prev`. Prints `ReelOS $REMOTE applied.`
2. **Channel** tarball = `https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz`. VERSION = `1.2.15`.
3. **No second wizard.** `__root.tsx` hydrates from `/api/box.provisioned` + answers.
4. **Connect** cards render. `/api/box` is **red** until Jellyfin answers on LAN `:8096` **and** libraries exist.
5. **Routes exist** and fail honest without engines: `/api/lookup` `/api/request` (POST add + GET status) `/api/indexer` `/api/password` `/api/quality` `/api/doctor` `/api/tailscale/install` `/api/tailscale/check`.
6. **Caddy** `:80` → `127.0.0.1:8080`. Jellyfin `0.0.0.0:8096`.
7. **OTA** does not apt Chromium or Tailscale (`REELOS_OTA=1` skips extra_access).
8. **README** and **HAL.md** untouched by this freeze.
9. **HP not applied.** No fake house curls.

Owner exception (still 1.2.15, not 1.2.16): Settings → Advanced → **Reset appliance**. `POST /api/reset`. Compose down, deletes `provisioned` / `answers.json` / `compose/configs`, restarts the shell. Does not delete `/srv/media` or images. 409 if OTA is running.

## B. House done — not today

Only after they run this on `192.168.1.233`:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

and it prints `ReelOS 1.2.15 applied.`

Then **they** confirm: Home on `http://192.168.1.233`, Batman lookup, one Request, Jellyfin on the TV, password changed, Tailscale paired, indexer pasted.

Until B, the product is not finished. After A, do not keep improving the tree unless Home breaks.
