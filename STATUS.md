# STATUS.md

Xorriso. Dated **2026-09-07 12:44 +08**.

# 1.2.29 launched

House 1.2.28: `fusermount: user has no write access to mountpoint /mnt/debrid` (`root:root 755`). Mario folders still empty.

This stamp:
- chmod 777 / chown 1000 `/mnt/debrid`
- restart Decypharr to remount
- fast Apply: one tarball, no force-recreate of healthy engines, no Jellyfin wipe, no Prowlarr bounce on DNS 400

Same apply curl. Then Logs only if Mario still empty.
