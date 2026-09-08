# STATUS.md

Xorriso. **2026-09-07 22:25 CDT.** VERSION **1.2.43**. No 1.2.44.

## House

1.2.42 → 43 Apply: `Reload daemon failed: Transport endpoint is not connected`. systemd dbus dead, `systemctl start reelos` failed, probe waiting on :8080. Curl 7s leaked to the TTY.

## On main

`start_shell`: if systemd dbus is down, `npm run start:box` directly. No daemon-reload loop. Curl quiet. Still 1.2.43.

If this Apply restored `.prev`, Home may be down until node is started (or they Apply again after dbus is back).
