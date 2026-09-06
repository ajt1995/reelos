# STATUS.md

Xorriso. Dated **2026-09-06 17:08 CDT**.

# 1.2.15 frozen

VERSION **1.2.15**. No 1.2.16. No ISO. No indexer roster. **Stop committing.**

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

## Hole closed

`wire-engines.py` adds **one** Prowlarr indexer `ReelOS-<provider>` from wizard `source` + `apiKey`, using Prowlarr’s first-party schema for that provider’s official API. Idempotent. `local-vpn` does not invent a debrid indexer. Connect paste still works. Skip is valid.

Doctor hop `releases`: green when that indexer is enabled; red `No release source. Provider indexer missing.`

## Sandbox curls (no engines)

```
curl -sS http://127.0.0.1:8080/api/doctor
# releases: No release source. Provider indexer missing.

curl -sS http://127.0.0.1:8080/api/lookup?q=batman
# {"titles":[],"error":"Movies/TV engines have no API key yet"}
```

No fake HP curls. No FlareSolverr.

## HP

Not applied.
