# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.49** (already on `main` via #49 Jellyfin seed).

PR **#50** is the rest of this stamp: Decypharr→FUSE→*arr `importPending` retry. Do **not** cut 1.2.50.

## xorriso — do this

1. Merge `#50` (`cursor/fuse-arr-import-0b46`) → **main**. Keep `#49` Jellyfin seed.
2. On `main`, **`channel.json` tarball = `main.tar.gz`**. VERSION stays **1.2.49**.
3. Books / Kavita / `ReelOS-libgen` stay **off** (`feature/3-books` stays a branch).
4. Owner phone: Settings → Check → Apply (SHA drift if 1.2.49 is already local). Search hop red is OK (#48).
5. Proof:
   - `/api/box` Jellyfin **green**; Watch `http://<lan>:8096` (not docker `172.18.x`); no JF wizard after soft-reset (#49).
   - Next cached TorBox grab leaves Radarr/Sonarr `hasFile=true` without a manual import. Logs: `retry import … FUSE readable` (#50).

Do not Apply a feature-branch tarball. Do not wipe TorBox. Mailman from #48 stays fail-open on search.
