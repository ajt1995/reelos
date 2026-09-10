# STATUS.md

***1.2.50.26 is the ship.*** 2026-09-10. House is still stamped **1.2.50.22**. This Apply stacks 23–25 plus low-performance mode that actually caps a 4GB box. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.26`
- **Base:** `main` at 1.2.50.22 plus 23 honesty, 24 request recover, 25 debrid-safe extraction
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Low performance mode now does something for 4GB RAM

The toggle was on. It did not help RAM. GPU node `/dev/dri` was present and passed into the container, but Jellyfin encoding was **HardwareAccelerationType: none**, **EncodingThreadCount: -1** (every CPU thread), no throttle, no segment deletion, hardware decode codecs **h264+vc1 only** (no HEVC). A 4K remux software-decoded on 4GB.

Low mode now: VAAPI + HEVC decode when `/dev/dri` exists, **one** ffmpeg thread, throttle, delete transcode segments after 60s, `veryfast` preset. Turning it off restores unlimited threads but **keeps VAAPI** and still does not turn scene-preview extraction back on.

### 1.2.50.25 Jellyfin vs TorBox (still in this Apply)

No subtitle extraction, trickplay, chapter images, or intro scans against FUSE dumps.

### 1.2.50.24 request recover (still in this Apply)

Recover monitors unmonitored Seerr seasons and adds a missing Sonarr series.

### 1.2.50.23 honesty (still in this Apply)

Phone shows Applying while mailman is still in hops. Settings persist. Shelf year strip. `ufw allow` 80/8080/8096.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs
python3 daemon/reelos-doctor.py --self-test
```

## Owner / house Apply

1. Merge this to **main**. Phone **Check → Apply once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.26`.
3. Jellyfin Dashboard → Playback: hardware acceleration VAAPI, encoding threads 1 while low mode is on.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media` or TorBox
