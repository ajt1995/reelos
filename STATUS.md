# STATUS.md

Xorriso. Dated **2026-09-06 19:45 CDT**.

# 1.2.15 frozen (exception)

VERSION **1.2.15**. No 1.2.16. **Stop committing.**

House apply (button will not see a bump):

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

After Apply, without a second Apply:

```
curl -X POST http://127.0.0.1:8080/api/wire
```

Settings → Doctor → Rewire engines does the same. 409 if OTA is running.

## This exception

1. `wire-engines.py` retries Jellyfin until Movies (and Shows if TV was on) exist with path `/symlinks`. Completes Startup if needed. Low-perf extract flags stay off. They do not use the Jellyfin wizard.
2. Same pass retries official TorBox indexer (`ReelOS-torbox`) until enabled. Doctor `releases` can go green.
3. `POST /api/wire` re-runs that script.

Parked branches not merged.

## Sandbox

```
curl -sS -X POST http://127.0.0.1:8080/api/wire
# {"ok":true,"started":true}

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/wire
# 405
```

HP proofs wait until they apply + wire. No fake house curls.
