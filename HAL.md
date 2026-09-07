# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 21:23 CDT**.

## Ship **1.2.21**. Prove it on the logic, not the notes.

House applied **1.2.20**. Doctor:
- Version 1.2.20
- `releases` yellow — Provider indexer missing
- Lookup hop TimeoutError
- Tailscale still `tailscale binary` (ignore, #7)

Compose on `main` already has `dns` + `extra_hosts`. The indexer **row** `ReelOS-torbox` is not in Prowlarr. Doctor looks for that exact enabled name. Missing name = you failed 1.2.18.

1. Apply must `docker compose up -d --force-recreate` Prowlarr (and Decypharr) so extra_hosts exist in the running container.
2. Wire must POST `ReelOS-torbox` and leave it enabled. If add/test fails, Doctor detail is the Prowlarr error, not the generic missing string.
3. After this stamp, a box with answers.source=torbox + apiKey must list that indexer. No 1.2.22 until that is true.

Bump `VERSION` + `channel.json` to **1.2.21**. No ISO. No ticket pile.
