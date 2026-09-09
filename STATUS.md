# STATUS.md

**OTA heal stamp + doctor hops + kick/pipeline honesty.** 2026-09-09. House **1.2.50.9** after #62/#63 on main; #64 (1.2.50.10) lock/recover/ghost rebased onto that. Remaining P1 false-PASS: Apply stamped after heal red; heal then re-imported dumps; doctor TCP/Prowlarr-only hops; timer skipped unmonitored; kick always ok; pipeline hid Seerr orphans. Stamp **1.2.50.11**. Complements #62/#64. Does not duplicate TWD heal or Tron.

## Stamp

- **VERSION / channel:** `1.2.50.11`
- **Base:** #64 (`cursor/lock-enable-recover-scope-23fd` / 1.2.50.10, rebased onto main after #62/#63). Merge **#64, then this**.
- Did **not** take Tron chrome from #52
- **What it is:** Apply cannot claim success after required JF/indexer heal failures. Import does not re-ingest dumps it just healed. Doctor proves JF library paths, Radarr add/search, and Sonarr search indexers. Timer grab-prep + kick/pipeline honesty.

## Before / after (house 1.2.50.9 / .10)

| Surface | Before | After Apply 1.2.50.11 |
| --- | --- | --- |
| OTA stamp | `indexers`/`import` non-fatal; `ReelOS x applied.` anyway | `HEAL_FAIL` → `not printing applied — jellyfin/indexer heal red` |
| Apply order | Collapse dumps, then scan/refresh them back | Indexers do not collapse. Scan, then `heal_after_import` |
| Doctor JF | `:8096` listening | VirtualFolders + dump/keep paths; no token = red |
| Request hop | Radarr port + API key | Client + search indexer + movie lookup |
| Sonarr indexers | Prowlarr list only | Sonarr GET; RSS-only EZTV is red |
| stuck-downloads | Skip unmonitored; no lock/widen | remonitor + `--quick` lock + Ultra-HD→Any, then search |
| `kickArrRecover` | Always `{ ok: true }` | `ok` follows queued command / grab-path |
| `pipeline.radarrMissing` | Empty for Seerr orphans/unmonitored | Lists `tmdb-*` gaps; Requests do not invent backlog rows |

## Code changes

1. **`reelos-update.sh`** — `HEAL_FAIL` blocks VERSION stamp. Search hop stays advisory.
2. **`wire-engines` 01/08/09** — `collapse_dumps=False` on indexers hop. `kick_imports` → `heal_after_import`.
3. **`reelos-doctor` / `public_indexers`** — JF libraries, request hop, Sonarr search vs RSS.
4. **`stuck-downloads`** — `ensure_item_grab_path` before SeasonSearch/MoviesSearch.
5. **JS** — `commandPosted` / `recoverKickOk` / `pipelineMovieGaps`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/lock-download-clients.py --self-test
python3 daemon/public_indexers.py --self-test
python3 daemon/stuck-downloads.py --self-test
node --test scripts/reelos-library.test.mjs scripts/reelos-request-status.test.mjs scripts/reelos-seerr.test.mjs scripts/jellyfin-seed.test.mjs scripts/relink-dumps.test.mjs scripts/stack-smoke.test.mjs scripts/public-indexers.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

1. Merge **#64**, then this to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.11`. Expect `ReelOS 1.2.50.11 applied.`
3. Heal red must not stamp. Doctor hops must not be TCP-only green.
4. NT pipeline lists the orphan. Recover `ok` is false when search did not queue.

## Do not

- Cut **1.2.51** (Tron reserved).
- Duplicate #62 TWD year-gate / JF Series heal / `Searching — no file yet`.
- Duplicate #64 lock enable / recover scope / ghost reason.
- Wipe `/media` local-disk libraries.
- Invent a progress % on Requests.
- Merge two real-id series that only share a season-suffix name.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
