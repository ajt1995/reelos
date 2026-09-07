# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 19:22 CDT**. VERSION **1.2.15**.

House apply still pulls **`main`**:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

**`main` is frozen** except mailbox files (`HAL.md`, `STATUS.md`, `ROADMAP.md`, `FACELIFT.md`).

You may cut the feature branches in [`ROADMAP.md`](ROADMAP.md) and work them. **Do not merge. Do not touch `channel.json` / `VERSION` / the updater.**

Idle order: `#4` then `#3` then `#2` then `#5` then facelift. Still branches only.
