# STATUS.md

***1.2.50.22 is the ship.*** 2026-09-10. Honesty for Apply-in-progress. Complements #73 / 1.2.50.21. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.22`
- **Base:** `main` at 1.2.50.21 (#73)
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Phone tells you Apply is still running

House CLI Apply of 1.2.50.21 left Home looking idle. `/api/update/status` only asked `systemctl is-active reelos-ota`. SSH `curl | bash -s apply` is not that unit, so `running` was false while hops/heal still ran. The Caddy “updating” page only covers the swap; then the live shell looks finished.

- Status uses the **held** `ota.lock` flock (and the systemd unit). A leftover lock file is not running. Never delete `ota.lock`.
- Phone polls status on load and every 2.5s. Applying paints a gold bar on every Shell page: *Applying X. Home can open — engines are still configuring.* plus the last mailman line.
- Settings → Updates says the same and disables Check/Apply.
- Caddy door copy no longer promises “a minute.”

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/reelos-ota-status.test.mjs scripts/reelos-repair.test.mjs
```

## Owner / house Apply

Wait until **1.2.50.21** finishes (one Apply). Then phone **Check → Apply once** for 1.2.50.22. Do not tap Apply while 21 is still in hops.

1. `cat /opt/reelos/VERSION` → `1.2.50.22`
2. Next Apply (phone or CLI) shows the bar until mailman prints `ReelOS 1.2.50.22 applied.`

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Start a second Apply while 21 is running
- Delete `ota.lock`
- Wipe `/media`
