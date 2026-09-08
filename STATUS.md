# STATUS.md

Xorriso. **2026-09-07 21:44 CDT.** VERSION **1.2.43**. No 1.2.44.

## House

Still **1.2.42**. Phone/SSH Apply hit a **stale `ota.lock`** (`reelos-ota` inactive, no updater, VERSION unchanged). That is a mailman bug, not the owner.

## On main (this hour)

Stale lock: if flock is held and no `update-apply.sh` process, replace the lock and continue. Still 1.2.43.

Owner recovery (once): `sudo rm -f /var/lib/reelos/ota.lock` then the GitHub-API apply curl.

## Don’t

Stamp 44. Merge #32. Debugger homework.
