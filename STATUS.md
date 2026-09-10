# STATUS.md

***1.2.50.23 is the ship.*** 2026-09-10. House already stamped **1.2.50.22**. This Apply is honesty: the phone tells the truth during CLI Apply, Settings does not 500, `/api/box` does not call Jellyfin red when VirtualFolders is slow. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.23`
- **Base:** `main` at 1.2.50.22 (#79 / #80 / #81)
- Did **not** take Tron chrome from #52 / #70

## Changelog

Proven against the live house on Tailscale (`100.100.154.16`). Doctor hops were already green on 1.2.50.22. The phone still lied.

### Phone shows Applying while mailman is still in hops

`/api/update/status` only asked `systemctl is-active reelos-ota`. SSH `curl | bash -s apply` is not that unit, so `running` was false while hops/heal still ran. Home looked finished. Status now uses the **held** `ota.lock` flock (a leftover lock file is not running). Never delete `ota.lock`. Gold bar on every page. Caddy door no longer promises “a minute.”

### `/api/box` no longer invents missing Movies/Shows

Jellyfin VirtualFolders on this HP often takes longer than 2.5s. The box probe aborted, treated `[]` as “no libraries,” and painted Jellyfin red while Doctor and `/api/library` were green. The probe now waits 8s, retries with `?api_key=`, and says **Cannot read virtual folders** when the read fails — **Missing library** only when the read succeeded and the folder is actually absent.

### Settings auto-update no longer 500s

Toggling daily Apply wrote `/etc/systemd/system/reelos-autoupdate.service` as the Vite user and threw `EACCES`. Settings JSON is written first; the systemd unit is best-effort (`sudo -n tee`). The toggle persists even when the unit cannot be installed.

### Shelf titles do not double the year

Unmatched Jellyfin movies keep the folder name `John Wick (2014)` plus `ProductionYear` 2014. The shelf now strips a trailing `(Year)` that matches the year field.

### Caddy :80 stays reachable after Apply

Apply now `ufw allow` 80/8080/8096 when Caddy is restored, so the Tailscale door is not a black hole after a firewall reload.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/reelos-ota-status.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-library.test.mjs scripts/jellyfin-seed.test.mjs
python3 daemon/reelos-doctor.py --self-test
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.23`.
3. Next Apply (phone or CLI) shows the gold bar until mailman prints `ReelOS 1.2.50.23 applied.`
4. Settings → Updates daily toggle does not error. Home / Settings do not say Movies/Shows are missing while the library shelf has titles.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media` or TorBox
