# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 20:30 CDT**.

## Ship **1.2.17**. One apply.

1.2.16 is on the channel. House hit **502** during/after swap (`reelos.service` changed on disk). They will not babysit systemd.

Keep everything already in 1.2.16 (Jellyfin owner, TorBox DNS, Settings chrome). Add this to the updater. Bump `VERSION` + `channel.json` to **1.2.17**.

### OTA must not leave 502

`daemon/reelos-update.sh` today: stop reelos → mv → copy unit → daemon-reload → start. Phone talks to Caddy :80 the whole time. Empty upstream = Chrome 502. Probe can also fail because lookup times out even when Home is 200.

Required:
1. Copy `reelos.service` + **daemon-reload before** `systemctl stop`. Never start on a stale unit.
2. Probe success = Home **200** on `:8080` **and** `:80` is ReelOS (not stock Caddy). Do **not** require `/api/lookup` to succeed. Lookup timeout is not a failed OTA.
3. After start, if `:8080` is down, `daemon-reload` + `restart` and keep probing (already 45s — make sure npm actually starts; log `journalctl -u reelos` on fail).
4. Caddy during stop: do not advertise an empty proxy as a mystery 502 if you can help it. A static "updating" page is fine. Reloading Caddy mid-swap is how you get 502 with no backend.
5. Print `ReelOS 1.2.17 applied.` only after `:80` serves ReelOS. Rollback still restores `.prev` if Home never comes back.

Then freeze. No ISO. No #2–#5.
