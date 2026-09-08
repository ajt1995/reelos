# STATUS.md

**Reelist (enlisted fixer).** 2026-09-08. Stuck TorBox/Decypharr 0% + re-add guard. Did **not** edit HAL.md. Did **not** bump VERSION (behavior + tests only). Books/Kavita **out**.

## Stamp

- **VERSION / channel:** still `1.2.48` (no stamp this PR)
- **PR:** `cursor/stuck-download-purge-2e0a` — durable *arr queue watch, not a mailman change
- **What it is:** House was sitting at Radarr/Sonarr 0% (`sizeleft==size`, tracked still ok/downloading) after Decypharr submitted a cached TorBox hash and `Action=symlink` never created `/mnt/symlinks/{radarr|sonarr}/…`. Automation then re-added the same hash → duplicate TorBox rows → Pro 2h rate limit. ReelOS had no stuck-queue purge.

## Layer (why this, not Decypharr fork / mailman)

- **Watch job** `install/bin/stuck-downloads.py` (mirrored `daemon/stuck-downloads.py`) piggybacks on existing `reelos-lock-clients.timer` (every minute). OTA already overlays `daemon/` → `/opt/reelos/bin`, so Apply delivers the script **without** touching `reelos-update.sh`.
- Decision functions are pure + `--self-test`. `npm test` runs `scripts/stuck-downloads.test.mjs`.
- Decypharr template + `patch_decypharr` set `default_download_action: symlink` (safe extra JSON key).
- *arr `autoRedownloadFailed` / interactive variant seeded **off** so a fail+blocklist+`skipRedownload` does not silently re-grab the same release.

## Behavior

1. **No duplicate re-add:** if Decypharr already has the hash queued/active/cached, do not treat a second *arr queue row as a new TorBox submit. Newer same-hash queue rows are removed with `removeFromClient=false`, `blocklist=true`, `skipRedownload=true`.
2. **Stuck 0%:** no progress for `REELOS_STUCK_DOWNLOAD_SEC` (default **900s**) → DELETE queue `removeFromClient=true&blocklist=true&skipRedownload=true`. One fail, no loop.
3. **Cached but no path:** Decypharr 100%/cached/`uploading` and `outputPath` missing → one `wire-engines.py import` (relink + *arr scan). Still missing after `REELOS_STUCK_SYMLINK_SEC` (default **180s**) → fail as above.
4. **Requests / logs:** `/var/lib/reelos/stuck-notes.json` overlays Seerr grabbing rows as **failed** + reason. Activity tails `stuck-downloads.log`.
5. **FUSE ENOTCONN:** listdir `/mnt/debrid` “Socket not connected” → restart `decypharr` + jellyfin/radarr/sonarr (same idea as `restart_fuse_readers`). Backoff 5 min. Does **not** edit the mailman. `a10b8d8` already lazy-unmounts stale FUSE before OTA `mkdir`.

## Hypotheses (checked)

- **Retry loop = *arr failed-download handling + Decypharr never completing the qbit “download”.** Kept. `autoRedownloadFailed=false` + `skipRedownload` on purge.
- **Colon in “Spider-Man: …” breaking symlink.** Possible on some FUSE mkdirs. Recover uses existing relink; `safe_folder_name` also checks `:` → ` -` when deciding if a path appeared. We do **not** rewrite Decypharr’s namer.
- **FUSE race after remount.** Already `restart_fuse_readers` in wire-engines; watch job heals ENOTCONN without a mailman edit.

## Quality / TorBox slots (docs only)

Wizard `hybrid`/`4k` still maps to **Ultra-HD**. Remux grabs hold TorBox slots longer and amplify re-add damage. House can set wizard quality to `1080p` (HD-1080p) if slot pressure is the issue. **This PR does not change the default profile.**

## Owner / house Apply

1. Merge this tip to **main** (no VERSION bump required).
2. House: `reelos-update.sh apply` (or phone Check→Apply). Gets `stuck-downloads.py` via daemon overlay; existing lock-clients timer starts sweeping.
3. Confirm: `python3 /opt/reelos/bin/stuck-downloads.py --self-test` ; journal/Activity shows `stuck-downloads` lines after a request.
4. If a title is already looping on TorBox: one sweep should fail+blocklist the 0% *arr row and stop new adds. Old duplicate TorBox web-UI rows may still exist until they expire — we do **not** delete-by-hash (would drop the live add).
5. After any FUSE remount: if Radarr logs “Socket not connected” on `/mnt/debrid`, wait one timer tick or `docker restart reelos-radarr-1 reelos-sonarr-1`.

## Known gaps (do not block Apply)

- Cancel/Retry on Requests UI are still local-only; Seerr poll restores rows. Stuck-notes overlay failed until Seerr marks available.
- Hash/magnet paste is still a no-op on Seerr path.
- New systemd unit not required; if someone deletes `stuck-downloads.py` the lock timer still locks clients.
- Heal does not refresh `wire-engines.parts/` (OTA Apply copies daemon tree — OK).

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Merge `feature/3-books` / pirate book indexers.
- Apply a feature-branch tarball — **main only**.
- Edit `daemon/reelos-update.sh` for this ticket (mailman stays frozen; FUSE mkdir fix is already `a10b8d8` on main).
- Force Ultra-HD → 1080p without a wizard/answers change.

## Hal / xorriso

Hal: STATUS only; no HAL edit. No VERSION stamp. Phone OTA uses `main.tar.gz` + `channel.json` — ISO not required for house Apply.
