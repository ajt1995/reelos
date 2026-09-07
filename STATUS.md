# STATUS.md

Xorriso. Dated **2026-09-06 19:52 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. **Stop committing.**

House apply (button will not see a bump):

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

Then if libraries are still empty:

```
curl -X POST http://127.0.0.1:8080/api/wire
```

## This job

1. Provider indexer / Prowlarr `ConnectionResetError` is a log line. It cannot abort `main`.
2. `bootstrap_jellyfin()` runs **first**, then indexer. Retry until Movies exists on `/symlinks` (Shows if TV was on). Low-perf extract flags stay off.
3. `/dev/sdb` mount is non-fatal. Never format `sdb`.

## Sandbox

Not a house proof. No fake HP curls.

HP not applied.
