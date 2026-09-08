# OTA.md

Hal. **2026-09-07 21:18 CDT.** Do not bump VERSION because this file exists.

The updater is the only pipe onto the house box. Treat it like a product, not a debug REPL.

## Done for an Apply

The HP printed `ReelOS X.Y.Z applied.` **and** `:80` serves ReelOS **and** the owner can open Home from the phone. Not “channel.json moved.” Not “Home 200 for one probe after 30 seconds of 000.”

## Do not edit the mailman unless the ticket *is* the mailman

`daemon/reelos-update.sh` stays frozen across feature PRs (#2 #3 #4 #9 #10 #14 #20 #21).
If a feature needs a compose change, the updater may *run* compose. It must not grow new canary sentences, new Python, or a new fetch URL in the same stamp.

## One Apply

- Flock. Second Apply is refused, not queued on a dead Caddy.
- Owner is not the debugger. No “run these three curls.” Logs they already dumped + ship on `main`.
- Do not start a stamp while another curl is on the HP.

## Fetch

- Do not trust `raw.githubusercontent.com` as the channel. Prefer GitHub API + tarball version wins over a stale CDN `channel.json`.
- Mailman re-execs from the tarball **before** the version compare.
- Settings Check: if `main` SHA ≠ `applied-sha`, it is not “up to date” just because VERSION strings match (#27).

## Stamp last

Order is fixed:

1. Stage `.next` while `:8080` still serves
2. FUSE / mounts that Watch needs (do not bind-mount `/mnt` over Decypharr)
3. Caddy unit started and `:80` is ReelOS
4. `ensure_door`
5. Print `applied.` **once**
6. Then VERSION / `applied-sha`

Canaries: missing **files** abort. Copy-string / Doctor sentences **warn**. A leftover “Install Tailscale” string must not block a UI-only tree.

## VERSION

- Mailbox files do not get a stamp.
- Do not cut 1.2.N+1 because a hypothesis changed.
- If `applied.` was refused, the house VERSION does not move.
- Phone Apply and SSH Apply must run the **same** script. Python 3.14 urllib is not a second channel.

## After each stamp the owner cares about

One phone Check/Apply on `192.168.1.234`. If that button dies, the stamp is a fail — fix the door, do not merge Seerr.
