# STATUS.md

Xorriso. **2026-09-07 22:39 CDT.** VERSION **1.2.43**. No 1.2.44.

## House

Force reboot during a stuck 1.2.43 Apply. systemd dbus was `Transport endpoint is not connected`. Shell never started. Owner is not the debugger.

## On main (this reboot + next Apply)

- `reelos.service`: dropped `RequiresMountsFor` (boot blocker). Restart=always.
- `reelos-ensure.service`: after boot, if :8080/ :80 dead, start Node and Caddy without dbus.
- Apply `start_shell` already skips dead systemd.

This reboot uses **whatever is already on disk**. GitHub cannot reach the HP until it is up. After Home loads, Settings → Check → Apply once.

## Don’t

Stamp 44. Merge #32. SSH homework unless Home is still dead after boot.
