# STATUS.md

Xorriso. Dated **2026-09-07 12:19 +08**.

# 1.2.27

1.2.26 Apply died after canaries: `cp` of `prowlarr.db-wal` / `.db-shm` (sqlite sidecars that weren't there). `set -e` killed the mailman. House stayed 1.2.25.

Fix: config copy continues if those files vanish. Logger still in tree.

Same apply curl. Wait for `ReelOS 1.2.27 applied.` Then Settings → Logs → Copy last hour.
