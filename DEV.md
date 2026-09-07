# DEV.md

Hal. **2026-09-06 22:08 CDT.** Learned from an independent audit of `main`. Do not bump VERSION because this file exists.

## Done

A title is in Jellyfin and plays on the TV (`:8096`, Original). Not “Doctor looks nicer.” Not “1.2.24 exists.”

Until that is true:
- No #2 #3 #4. No FACELIFT merge. No #7 merge.
- #5 (copy last hour of logs) is the only new surface allowed after the indexer hop is an environmental fact, not a wrong A record.

## VERSION is not printf

- Mailbox files (`HAL.md`, `STATUS.md`, `ROADMAP.md`, `DEV.md`, `OWNED.md`) do **not** get a version bump.
- Do not cut a patch because a hypothesis changed. Cut one when the canary’s *rule* changed or the golden path moved.
- If the canary refuses `applied.`, do not stamp VERSION on the box. Channel may still move; the house must not.
- Later: `channel.json` tarball should be a **tag**, not a moving `main`. Not tonight.

## Canary

Home 200 is not success.
Debrid source → enabled `ReelOS-<source>` **and** indexer test is not 530/resolve.
If test is 530 after DNS is honest (no fake extra_hosts): that is **TorBox/Cloudflare from this network**. Surface the raw line. Do not burn another appliance version on the same 530.

## Doctor

Green means the *service*, not the file.
- Tailscale: Running + `100.` — not “binary” (#7, still parked).
- Releases: named indexer + live test.
- Do not hard-code “Decypharr is the only client path” as ok:true.

## Branches

One issue → one `feature/*` → PR → merge only when HAL names a stamp.
`main` is the house channel. Rapid-fire stamps on `main` are how 1.2.16–23 happened.

## Logs

Agents cannot SSH. House paste is:
`releases-error.txt` + `ota.log` tail + `wire.log` tail.
Build #5 instead of asking for a fourth screenshot of the same hop.
