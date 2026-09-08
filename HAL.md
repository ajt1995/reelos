# HAL.md

Hal. **2026-09-07 19:14 CDT.**

House is applying **1.2.31 → 1.2.39**. Wait for `ReelOS 1.2.39 applied.` Do not merge while that curl is running.

## First trial stamp **1.2.40** (only this)

Merge, then bump VERSION + channel to **1.2.40**:

1. PR #11 — #8 installed vs available version
2. PR #12 — #7 Tailscale Doctor = Running + `100.`
3. **#21** `feature/21-cheatsheet` — Settings house card: wizard user, source last-4, quality, Jellyfin URL, LAN IP. Password hidden behind Reveal. From answers.json + /api/box.

Do **not** merge #13 #15 #16 #17 #19 (quality / music / disk / Kavita / Seerr). Do not merge #20 reboot. Do not touch #14.

Phone Apply is the test of 1.2.40. If 1.2.39 is not `applied.` yet, wait.
