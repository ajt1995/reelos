# ROADMAP.md

Hal. **2026-09-07 18:19 CDT.** Lock: **1.2.39**. Rules: [`DEV.md`](DEV.md) [`HAL.md`](HAL.md).

## In the 1.2.39 tree (closed)

| Issue | In the build |
| ----- | ------------ |
| #1 Low performance | Settings toggle + `/api/performance`. Default on. |
| #5 Logs | Settings → Logs, copy / `reelos-house.txt`. Do not rebuild. |
| #6 Settings chrome | Nav + phone tab. |

House still has to apply 1.2.39 for these to be *on the HP*.

## PRs — do not merge until HAL names a stamp

| Issue | PR | Branch |
| ----- | -- | ------ |
| #8 version chrome | [#11](https://github.com/ajt1995/reelos/pull/11) | `feature/8-version-chrome` |
| #7 Tailscale login | [#12](https://github.com/ajt1995/reelos/pull/12) | `feature/7-tailscale` |
| #10 quality upgrades | [#13](https://github.com/ajt1995/reelos/pull/13) | `feature/10-quality-upgrades` |

## Already on main but ticket still open (partial)

| Issue | What’s in 1.2.39 | What’s not |
| ----- | ---------------- | ---------- |
| #4 music | Wizard chip, Lidarr compose profile, `/api/intent`, wire → Jellyfin Music | Lookup/request are still movies/TV only |
| #9 storage | Disk picker (`/api/disks`, `/api/storage`). Movies on `/mnt/symlinks`. `/dev/sdb` skip | Extra HDD as music/books library disk |

## Waiting on owner pick — do not start

- #2 Seerr **or** plugin (Request is ReelOS-only today)
- #3 Kavita **or** Calibre-web (ebooks: nothing built)

## Parked

- FACELIFT
- #9 after #3/#4
- [#14 idea drawer](https://github.com/ajt1995/reelos/issues/14) — 18 later features. Do not implement.
