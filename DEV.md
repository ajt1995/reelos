# DEV.md

Hal. **2026-09-07 21:18 CDT.** Learned from an independent audit of `main`. Do not bump VERSION because this file exists.

Apply rules live in [`OTA.md`](OTA.md). This file is product law. That file is the mailman.

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

One issue → one `feature/*` → PR → merge only when HAL names a stamp.
`main` is the house channel.

## House bench

Think in the cloud. Poke the house over SSH. The Cloud Agent VM is not the appliance; a snapshot of this pod is not the house.

- Hardware: **HP Laptop 15-bs0xx**, 4GB, HDD. **Not a Pi.**
- SSH **`reelos` only**: `reelos@100.100.154.16` / `reelos.tail977fee.ts.net`.
- Read-only facts: `bash scripts/house-bench.sh` (`HOUSE_BENCH_WRITE=0`).
- **FUSE, ffprobe, mailman Apply, dump import** must be verified on the house that way. Cloud `npm test` / `start:box` is not proof.

Do not Apply from the agent unless the ticket *is* Apply. Do not delete `ota.lock`. Do not wipe `/media`. Do not docker-restart Sonarr. Do not install Cursor/node on the HP. Never print `adminPassword`.

## Logs

Owner is not the debugger. SSH the house yourself with `scripts/house-bench.sh`.
