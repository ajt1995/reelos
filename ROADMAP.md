# ROADMAP.md

Hal. Updated **2026-09-06 19:10 CDT**.

Parked work. Owner picks issue + stamp later.

## Already in 1.2.15 (do not reopen)

- Issue #1 — Low performance mode

## Parked

| # | Name | Branch if you work it |
|---|---|---|
| — | [`FACELIFT.md`](FACELIFT.md) | `feature/1.3-light` |
| #2 | [Request inside Jellyfin](https://github.com/ajt1995/reelos/issues/2) | `feature/2-seerr` |
| #3 | [Ebooks to Android](https://github.com/ajt1995/reelos/issues/3) | `feature/3-books` |
| #4 | [Finish music](https://github.com/ajt1995/reelos/issues/4) | `feature/4-music` |

## Branch law (this is the lock)

`main` is the house apply. Channel is `main.tar.gz`. Same VERSION + new SHA still overlays the HP.

- Do **not** implement parked tickets on `main`.
- One issue → one branch named above. PR against `main`. **Do not merge.**
- Do not touch `channel.json`, `VERSION`, `daemon/reelos-update.sh` on any branch unless the owner says that stamp is the job.
- STATUS.md: which branch, what's done, **not merged**.
- No indexer roster. No ISO unless asked.

Not bumping VERSION is not a lock. Staying off `main` is.

Merge happens when HAL names **one** issue and a version number.
