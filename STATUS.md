# STATUS.md

***1.2.50.30 is the ship.*** 2026-09-10. Owner Home showed Night at the Museum (Cached), John Wick (Available now), Coyote vs. Acme (Available now) plus "25 transferring" in **Your requests** at the top — redundant with On this box. 1.2.50.29 (splash /api/ready / rsync overlay) did not change that row. This stamp hides shelf/library hits on Home and counts transferring with the same in-flight definition. Requests still lists everything. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.30`
- **Base:** `main` at 1.2.50.29
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Home Your requests is in-flight only

Hide rows already on the shelf/library: status available, engine downloaded, overlay library hit, Cached / Available now. Keep searching, grabbing, and linked waiting for import. The row disappears when nothing is in flight.

### Transferring chip uses the same definition

Do not show "25 transferring" when those 25 are mostly available. Overlay library presence first, then count downloading/waiting only. Nav Requests badge matches Home.

### Requests page unchanged

Filters still list available / downloading / waiting / failed. Honesty overlay still upgrades library hits to available there.

## Proof

```
python3 scripts/check-ota.py .
node --experimental-strip-types --test src/lib/sync-requests.test.ts
node --test scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-request-status.test.mjs scripts/jellyfin-seed.test.mjs scripts/reelos-ready.test.mjs scripts/reelos-library.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**.
2. Home top row should not repeat On this box. Idle library → "Library idle", not a fake transferring count.
3. Requests still has the full household list.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent (door was flaky; owner Applies)
