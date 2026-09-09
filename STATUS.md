# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Jellyfin died across provision/wipe/restart: hidden admin, empty `/Users/Public`, docker `LocalAddress`, leftover first-run. Rebased onto `#47` (JF12 auth + Finish-detach) and `#48` (OTA mailman). Stamp **1.2.49**.

## Stamp

- **VERSION / channel:** `1.2.49`
- **PR:** https://github.com/ajt1995/reelos/pull/49 (`cursor/jellyfin-durable-seed-6361`)
- **What it is:** After Finish or soft-reset, `/api/box` Jellyfin stays green without opening the JF wizard or repairing PIN by hand.

## Fix

1. **Visible admin** matching wizard name/PIN. `#47` `Authorization` MediaBrowser + `IsHidden: false` kept. Seed completes startup when the wizard is open.
2. **Libraries** Movies → `/symlinks/radarr`, Shows → `/symlinks/sonarr` (defaults on unless intent turns them off). `/api/box` uses the same rule.
3. **Published URI by request** so remote web does not get docker `172.18.x`. Default `compose/configs/jellyfin/config/network.xml`; live XML patch; `POST /System/Configuration/network`.
4. **Wipe / auth-mismatch** re-seeds `network.xml` before `up`, waits until `StartupWizardCompleted=false`, then completes startup. OTA still will not wipe JF (`REELOS_OTA`).

Finish still detaches `docker compose up -d` (`#47`). Mailman stamp/lockfile/probe (`#48`) untouched.

## Owner / house Apply

1. Merge this tip to **main**. `channel.json` tarball stays `main.tar.gz`.
2. Phone Check then Apply. Must print `ReelOS 1.2.49 applied.`
3. `/api/box` `jellyfin.state` is `green`. Watch URL is `http://<lan>:8096`, not `172.18.x`.
4. Soft-reset then Finish: no JF first-run wizard, PIN matches, Movies/Shows exist.

## Do not

- Apply a feature-branch tarball — **main only**.
- Cut **1.2.50** in the same hour.
- Scope into TorBox / books.

## Hal / xorriso

Hal: stamp **1.2.49**. Phone OTA uses `main.tar.gz` + `channel.json`. ISO not required for this Apply.
