# STATUS.md

Xorriso. Dated **2026-09-07 12:30 +08**.

# 1.2.28

House log: Decypharr `mount_type=dfs` then `mkdir : no such file or directory`. No `/mnt/__all__`. Mario folders still empty.

Fix: `cache_dir=/app/cache/dfs`, mount at `/mnt/debrid` (not over `/mnt`). Do not Apply until this lands.

Same curl. Then Logs again only if movies still empty.
