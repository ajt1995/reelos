# OTA.md

Do not bump VERSION because this file exists.

The updater is the only pipe onto the house box. Treat it like a product, not a debug REPL.

## Done for an Apply

The HP printed `ReelOS X.Y.Z applied.` **and** `:80` serves ReelOS **and** the owner can open Home from the phone. Not “channel.json moved.” Not “Home 200 for one probe after 30 seconds of 000.”

## Do not edit the mailman unless the ticket *is* the mailman

`daemon/reelos-update.sh` stays frozen across feature PRs (#2 #3 #4 #9 #10 #14 #20 #21).
If a feature needs a compose change, the updater may *run* compose. It must not grow new canary sentences, new Python, or a new fetch URL in the same stamp.

## One Apply

- Flock. Second Apply is refused, not queued on a dead Caddy.
- Owner is not the debugger. No “run these three curls.”
- Do not start a stamp while another curl is on the HP.

## Fetch

- Prefer GitHub API. Tarball version wins over a stale CDN `channel.json`.
- Mailman re-execs from the tarball **before** the version compare.
- Settings Check: if `main` SHA ≠ `applied-sha`, it is not “up to date” (#27).

## Stamp last

1. Stage `.next` while `:8080` still serves
2. FUSE / mounts (do not bind-mount `/mnt` over Decypharr)
3. Caddy **systemd unit** started — not nohup. `:80` is ReelOS
4. `ensure_door`
5. Print `applied.` **once**
6. Then VERSION / `applied-sha`

Canaries: missing **files** abort. Copy-string / Doctor sentences **warn**.

Phone Apply (`reelos-ota.service`) and SSH Apply run the **same** script. No Python 3.14 urllib fetch of channel.json.

## Next stamp only (1.2.43 when this is true)

House is `applied-sha` **f7ab5f0**, channel **1.2.42**, `main` ahead. Do not cut 43 until these are on `main` **and** real (not scaffold):

1. **#23 / PR #31** — Caddy unit installed, `enable --now`, survives reboot. Kill the nohup fallback as the success path.
2. **#27 / PR #35** — Check uses SHA drift. VERSION match is not “up to date.”
3. **#30 / PR #38** — Probe is not “000 × N then 200.” Door must hold.
4. Phone Apply = same mailman as SSH (GitHub API, re-exec first).

Leave **scaffold** PRs #33 #34 #36 #37 off `main`. Leave #32 (Jellyfin token) for the next wave — not this mailman stamp.

Do not merge #2 #3 #4 #9 #10 #13 #15 #16 #17 #19 #20. Do not seed indexers. Do not apt Tailscale/Chromium.

**1.2.43** is allowed only when Check on the phone offers 43, Apply prints `ReelOS 1.2.43 applied.`, Home stays up, and a reboot still serves `:80`. If phone Apply dies, 43 is a fail. Fix the door. Do not stack 1.2.44 the same hour.
