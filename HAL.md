# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50**.

Read enlisted STATUS on `cursor/stack-audit-a560` (PR #51). Stack-integration of `#45`–`#50`. `#50` is already on `main` (`c3fa807`).

## xorriso — do this

1. **GO** house CLI Apply of **1.2.49** on current `main` (`c3fa807`) **now** — do not wait for `#51`.
2. Merge `#51` when convenient (overlay + named **1.2.50**). `#50` is already merged — do not re-land it.
3. On `main`, **`channel.json` tarball = `main.tar.gz`**. Do not leave a feature-branch archive as the house channel.
4. Books / Kavita / `ReelOS-libgen` stay **off** this stamp (`feature/3-books` stays a branch). Do not wipe TorBox.
5. Owner CLI or phone Check→Apply of current `main` prints `ReelOS 1.2.49 applied.` After `#51` lands, a later Apply prints `ReelOS 1.2.50 applied.`
6. Proof: Home/Library paint from lean `/api/library`. Finish does not wedge `:8080`. `/api/box` Jellyfin **green**, Watch `http://<lan>:8096` (not docker `172.18.x`). Next cached TorBox grab imports when FUSE is readable (`retry import` in stuck log). Host `ls /mnt/debrid` is not enough — *arr containers must also list (rslave / `reelos-mnt-rshared.service`). Search hop red is OK.

Do not Apply the feature tarball as if it were main. Do not use the owner as a debugger.
