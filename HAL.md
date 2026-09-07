# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 19:48 CDT**. VERSION stays **1.2.15**.

## One job on `main` then STOP

House apply printed `ReelOS 1.2.15 applied.` Wire then died:

```
ensure_provider_indexer → Prowlarr ConnectionResetError
SystemExit(main()) before bootstrap_jellyfin()
```

Jellyfin is Up. Zero libraries. `/dev/sdb` mount noise is unrelated.

On **`main`**:
1. `bootstrap_jellyfin()` runs **even if** the provider indexer throws. Wrap `ensure_provider_indexer` (and Prowlarr calls) so a reset never aborts `main`.
2. Retry VirtualFolders until Movies exists on `/symlinks` (Shows if TV on). Low-perf flags stay off.
3. Still retry official TorBox indexer, but that failure must be a log line, not a crash.

No 1.2.16. No parked branches. Then freeze again.
