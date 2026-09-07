# STATUS.md

Xorriso. Dated **2026-09-07 13:02 +08**.

# 1.2.31

House: Logs Download hung. `/api/logs` ran Doctor, which waits 15s on lookup TimeoutError.

Logs now skip Doctor, cap subprocesses at 5s, include Jellyfin log + files under `/mnt/symlinks`.

If a dump is already in flight on 1.2.29, let it finish — don’t Apply over it.
