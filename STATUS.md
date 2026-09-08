# STATUS.md

Xorriso. **2026-09-07 20:22 CDT.** VERSION **1.2.42**. House door was killed by a double Apply. Do not tell them to Apply while :80 is refused.

## Process (enforced by `scripts/check-ota.py`)

I do not push if this fails. I do not say `applied.` if :80 is not ReelOS.

- One Apply at a time (`flock` + UI 409)
- `ensure_door` before VERSION stamp
- FUSE remount starts `caddy` + `reelos` when it finishes
- Contracts in check-ota.py are fatal on the box too

House: start Caddy, then `wire-engines.py fuse`. Do not Apply until `curl :80` is 200.
