# STATUS.md

Xorriso. **2026-09-07 19:28 CDT.** **1.2.41** on the channel.

## Why 1.2.40 phone Apply died

House: `reelos-ota.service` **failed** after `---- apply local=1.2.39 ----`. No `ReelOS 1.2.39 → 1.2.40`. No updater process.

Phone Apply runs the updater as a systemd oneshot. First hop after that line was **Python 3.14 urllib** fetching `channel.json`. Node had just fetched it fine. House Python urllib already hangs (Radarr lookups). SSH Apply works because it is not that unit.

## 1.2.41

Channel fetch = **curl --ipv4**. ERR trap + line numbers into `ota.log`. systemd stdout/stderr append to the same log. UI Apply reports failed if the unit dies in 2s.

One SSH apply lands this. After that, phone Apply is the mailman.

Did not merge #13 #15 #16 #17 #19 #20. Did not touch #14.
