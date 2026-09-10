# DEV.md

Learned from an independent audit of `main`. Do not bump VERSION because this file exists.

Governance lives in [`RULES.md`](RULES.md). Apply rules live in [`OTA.md`](OTA.md). This file is product law. That file is the mailman.

## Done

A title is in Jellyfin and plays on the TV (`:8096`, Original). Not “Doctor looks nicer.” Not “1.2.24 exists.”

## VERSION is not printf

- Mailbox files do **not** get a version bump.
- Do not cut a patch because a hypothesis changed.
- If the canary refuses `applied.`, do not stamp VERSION on the box.

## Canary

Home 200 is not success. See `OTA.md`.

## Doctor

Green means the *service*, not the file.

## Branches

One issue → one `feature/*` → PR → merge only when the owner names a stamp.
`main` is the house channel.

## Logs

Agents cannot SSH. Owner is not the debugger.
