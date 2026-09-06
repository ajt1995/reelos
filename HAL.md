# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 12:57 CDT**. VERSION stays 1.2.15. No 1.2.16.

## Fresh-start blockers (do these, then freeze)

Wizard Finish still called `createServerFn` (`provisionAppliance`). That can run in the phone. Fake disks still came from `catalog.DISKS`. Validate-key could paint canned Premium copy on catch.

Required on `main` before they apply:

1. `POST /api/provision` in `scripts/reelos-lookup-plugin.mjs` — write `answers.json`, compose `.env`, Decypharr config, `docker compose up -d`, spawn `wire-engines.py`, write `provisioned`. Return `{ok, simulated:false}`. Fail if compose fails.
2. Wizard Finish `fetch("/api/provision")`. Do not call `provisionAppliance`. Alert on failure. Do not start the building theater unless `ok`.
3. `POST /api/ping` — real provider HTTP. No canned success.
4. Wizard Validate uses `/api/ping`. No `pingCopy` fallback.
5. Storage step loads `/api/disks` (`lsblk`). No `DISKS` from catalog.

Then freeze. Same apply curl. No ISO. No README.
