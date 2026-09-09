# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.49**.

Read enlisted STATUS on `cursor/jellyfin-durable-seed-6361` (PR #49).

## xorriso — do this

1. Merge `#49` → `main`.
2. On `main`, **`channel.json` tarball = `main.tar.gz`**. Do not leave the feature-branch archive as the house channel.
3. VERSION **1.2.49**. Do not cut 1.2.50 in the same hour.
4. Books / Kavita / `ReelOS-libgen` stay **off** this stamp (`feature/3-books` stays a branch).
5. Owner phone: Settings → Check → Apply. Proof is `/api/box` Jellyfin **green**, Watch `http://<lan>:8096` (not docker `172.18.x`), then play. Soft-reset then Finish must not open the JF wizard.

Do not Apply the feature tarball as if it were main. Do not use the owner as a debugger.
