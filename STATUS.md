# STATUS.md

Xorriso. Dated **2026-09-06 21:10 CDT**.

# 1.2.19 frozen

VERSION **1.2.19**. House 1.2.18 Apply died because `systemctl stop reelos` kills the updater (same cgroup as the UI).

## This stamp

OTA runs as `reelos-ota.service` (`systemd-run`, oneshot) **before** the shell is stopped. Phone Apply returns 200; the unit keeps going. SSH Apply waits on that unit.

1.2.18 work stays (compose DNS/extra_hosts, force-recreate, ReelOS-torbox, doctor 15s).

House right now: recover Home, then one SSH apply. Do not tap Apply on the phone until Home is 200.
