# STATUS.md

***Apply remounts FUSE for real after compose recreate.*** 2026-09-09. House Apply of **1.2.50.18** swapped the tree, then `docker compose up` SIGKILL'd Decypharr/Jellyfin/Radarr/Sonarr and left `/mnt/debrid` ENOTCONN (`d?????????`). Mailman treated `[ -e /mnt/debrid/__all__ ]` as mounted, logged `fuse already on host`, and fail-closed without stamping. Stamp **1.2.50.19**. Complements #69. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.19`
- **Base:** current `main` (1.2.50.18 / #69)
- Did **not** take Tron chrome from #52 / #70
- **What it is:** hops/wait use `ls /mnt/debrid/__all__`, not bash `-e`. Lazy-unmount stale FUSE **before** compose up so bind mounts can start. After recreate, remount then `docker start` exited Decypharr/Jellyfin/Radarr/Sonarr. `fuse_on_host()` listdirs; `share_mnt` unmounts before mkdir (FileExistsError on ENOTCONN).

## House (SSH, this stamp's debug)

| Surface | Result |
|---|---|
| Apply of 1.2.50.18 | fail-closed; VERSION still 1.2.50.11; app tree already 1.2.50.18 |
| FUSE | four stacked `fuse.decypharr` ENOTCONN mounts |
| docker | decypharr/jellyfin/radarr/sonarr Exited (137) |
| Recover | `fusermount -uz` + `docker start` — FUSE listdir works in host and *arr; lookup Batman; library 6 titles |

Do **not** tap Apply of 1.2.50.18 again (compose vs `.prev` will recreate and kill FUSE). Do **not** Apply 1.2.51 / #70.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
node --test scripts/reelos-update.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.19`.
3. After Apply, `ls /mnt/debrid/__all__` works and Radarr/Sonarr/Jellyfin are `Up`.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
- Delete `ota.lock`
