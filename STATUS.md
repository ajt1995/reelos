# STATUS.md

**Lock honesty + recover scope.** 2026-09-09. House **1.2.50.9** after #62/#63 on main. Remaining: Download lock green while Decypharr was disabled; recover kicked the whole *arr backlog; ghost/GET-by-id/Retry stayed silent. Stamp **1.2.50.10**. Complements merged #62. Does not duplicate TWD heal.

## Stamp

- **VERSION / channel:** `1.2.50.10`
- **Base:** latest `main` (merged #62 = 1.2.50.9, plus #63 test hygiene)
- Did **not** take Tron chrome from #52
- **What it is:** A disabled Decypharr client is re-enabled and is not a green lock. `?recover=1` only kicks Seerr-requested titles. Ghost AVAILABLE and GET-by-id keep a reason. Retry re-POSTs.

## Before / after (house 1.2.50.9)

| Surface | Before | After Apply 1.2.50.10 |
| --- | --- | --- |
| Download lock | Host+port match = green, even `enable: false`. Empty probes = “Decypharr is the only client path” | PUT enable. Doctor red on disabled / unprobeable |
| `GET /api/request?recover=1` | MoviesSearch every monitored 0-file *arr title | Only Seerr-requested (NT orphan / stuck). Interstellar/Wick left alone |
| Requests extras | Invent grabbing rows for the *arr backlog when Seerr has rows | Seerr rows only; empty Seerr still shows unfinished TV |
| Ghost / title page / Retry | Silent grabbing@0; Retry is local-only | Reason on the row; GET-by-id returns it; Retry POSTs |

## Code changes

1. **`lock-download-clients`** — `client_enabled` / PUT `enable: true`.
2. **`reelos-doctor`** — `_decypharr_client_ok` requires enable; empty probe fails closed.
3. **`reelos-request-status`** — `seerrRecoverScope` gates `listMissingRecoverTargets`. Disabled client = missing.
4. **`reelos-seerr`** — `demoteGhost` keeps a reason; `mergeUnfinishedRows` drops backlog extras when Seerr is present.
5. **GET-by-id / poll / Retry** — `reason` on the title page; store retry POSTs `/api/request`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/lock-download-clients.py --self-test
node --test scripts/reelos-library.test.mjs scripts/reelos-request-status.test.mjs scripts/reelos-seerr.test.mjs scripts/jellyfin-seed.test.mjs scripts/relink-dumps.test.mjs scripts/stack-smoke.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply. Tarball `main.tar.gz`. Then **#65**.
2. `cat /opt/reelos/VERSION` → `1.2.50.10`. Expect `ReelOS 1.2.50.10 applied.`
3. Doctor Download lock must not be green on a disabled client.
4. Recover National Treasure only. Do not re-search the catalog.

## Do not

- Cut **1.2.51** (Tron reserved).
- Duplicate #62 TWD year-gate / JF Series heal / `Searching — no file yet`.
- Wipe `/media` local-disk libraries.
- Invent a progress % on Requests.
- Merge two real-id series that only share a season-suffix name.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
