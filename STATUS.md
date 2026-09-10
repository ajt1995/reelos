# STATUS.md

***1.2.50.25 is the ship.*** 2026-09-10. House is still stamped **1.2.50.22**. This Apply stacks 23–24 plus Jellyfin debrid-safe encoding: no subtitle extraction, trickplay, chapter images, or intro scans against TorBox dumps. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.25`
- **Base:** `main` at 1.2.50.22 plus 1.2.50.23 honesty and 1.2.50.24 request recover
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Jellyfin does not read TorBox dumps for previews or subtitles

Library trickplay/chapter flags were already off. Encoding still had **EnableSubtitleExtraction** (30-minute extract from the video) and **Media Segment Scan** every 12 hours (intro/credits). Those read the FUSE file and hammer TorBox. AllowEmbeddedSubtitles was **AllowAll** (PGS bitmap extract). Turning Low performance mode **off** used to re-enable trickplay during library scan.

Apply now always: trickplay/chapter/LUFS off, AllowText only, subtitle/keyframe extraction off, and clears triggers on Trickplay / Chapter Images / Keyframe / Media Segment tasks. Low-performance off does not turn them back on.

### 1.2.50.24 request recover (still in this Apply)

Recover monitors unmonitored Seerr seasons and adds a missing Sonarr series before SeasonSearch. Home's first poll sends recover=1. Requests Retry on locks.

### 1.2.50.23 honesty (still in this Apply)

Phone shows Applying while mailman is still in hops. `/api/box` no longer invents Missing library. Settings auto-update no longer 500s. Shelf strips a trailing `(Year)`. Apply `ufw allow`s 80/8080/8096.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/jellyfin-seed.test.mjs scripts/reelos-request-status.test.mjs scripts/stack-smoke.test.mjs
python3 daemon/reelos-doctor.py --self-test
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.25`.
3. Jellyfin Dashboard → Libraries: trickplay/chapter extraction off. Encoding: subtitle extraction off. Scheduled Tasks: Media Segment Scan has no interval.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media` or TorBox
