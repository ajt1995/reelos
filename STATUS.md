# STATUS.md

***1.2.50.21 is the ship.*** 2026-09-10. One Apply from house **1.2.50.20** / #72. Complements #72. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.21`
- **Base:** `main` at 1.2.50.20 (#72)
- **PR:** https://github.com/ajt1995/reelos/pull/73
- Did **not** take Tron chrome from #52 / #70

## Changelog (everything in this Apply)

### Movies stay one poster

Jellyfin 12 has no merge-versions plugin. 1080 and 4K next to each other used to become two posters after `Library/Refresh`. ReelOS Library hid that; Jellyfin Movies did not.

- Files are named `Title (Year) - 1080p` / `- 2160p` so Jellyfin treats them as versions of one movie.
- Extra copies of the **same** resolution park to `/mnt/symlinks/.reel-parked` (keep the largest). Never delete. Never `/media`.
- 1080 next to 4K stays. MergeVersions runs **last**, after scan, so a refresh cannot split them again.

### Hybrid keeps 1080 when 4K lands

Radarr only tracks one `movieFile`. An upgrade used to replace the 1080.

- Recycle at `/mnt/symlinks/.reel-recycle` (cleanup days 0). Restore puts the 1080 back next to 4K.
- Cutoff `MoviesSearch` hunts 4K after 1080.
- Interactive `/release` grab fills a 1080 next to titles that already only have 4K (`MoviesSearch` will not search down). Cap 3, cooldown.

### Apply heals what is already on the box

Existing 4K-only dumps and extra 4Ks are not left for later. Apply parks extras, names versions, and grabs a 1080 companion when one exists. Same rules as new requests.

### Phone paints first

Home no longer waits on `GET /api/box` (Tailscale + VirtualFolders) before first paint. Library can show a stale shelf. Posters go through a same-origin thumbnail.

### Settings Fix

Settings is House → **Fix** → This house → Box → More.

Named **Run** scripts with a short description each:

| When | Run |
|---|---|
| Library looks wrong | One poster per movie · Grab a 1080 next to 4K · Import what’s already downloaded |
| A request sits | Unstick grabs · Fix search indexers · Rewire engines |
| Files vanished | Remount debrid files |
| Read-only | Check hops (does not guess green until you run doctor) |

Allowlist only. No free-form shell. Not during an update. Overlap is a wait, not a second spawn. Fast success says **Finished**; a crash shows the log — not a fake Started. A stale `/opt` engine that cannot `merge-movies` is skipped so “one poster” cannot silently run full wire `main()`. Factory reset asks a second time.

### Quality copy

Hybrid knob says it grabs 1080 and 4K and **does not replace** the 1080.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/lock-download-clients.py --self-test
python3 daemon/stuck-downloads.py --self-test
node --test scripts/jellyfin-seed.test.mjs scripts/stack-smoke.test.mjs scripts/reelos-library.test.mjs scripts/relink-dumps.test.mjs scripts/stuck-downloads.test.mjs scripts/reelos-repair.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**, or CLI mailman from `main`.
2. `cat /opt/reelos/VERSION` → `1.2.50.21`.
3. Jellyfin Movies is one Interstellar with a 1080p/4K version picker, not two posters. Extra 4Ks are in `/mnt/symlinks/.reel-parked`. Hybrid keeps 1080+4K (including titles that already had only 4K, if a 1080 exists to grab).
4. Phone Home paints chrome before doctor/Tailscale finish.
5. Settings → Fix has named Run buttons. Check hops starts at “Not checked yet.”

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
- Wipe `/media`
