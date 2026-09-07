# ROADMAP.md

Hal. Updated **2026-09-06 18:59 CDT**.

These are **not** the 1.2.15 apply. No version numbers assigned. Owner will say which issue + which stamp when they want it. Until HAL names one issue as the job, **do not implement**.

## Already in 1.2.15 (do not reopen)

- Issue #1 — Low performance mode (trickplay/chapter extract off, Settings toggle)

## Parked — pick later

| # | Name | What it is |
|---|---|---|
| — | [`FACELIFT.md`](FACELIFT.md) | **1.3 Light** visuals only. Same screens. Paint, type, motion. |
| #2 | [Request inside Jellyfin](https://github.com/ajt1995/reelos/issues/2) | Seerr **or** a plugin. Same household login. Not both. TV can Request. |
| #3 | [Ebooks to Android](https://github.com/ajt1995/reelos/issues/3) | Wizard Books. Kavita *or* Calibre-web. Phone reads. No ReelOS book player. |
| #4 | [Finish music](https://github.com/ajt1995/reelos/issues/4) | Lidarr in `/api/lookup` + `/api/request`. Home only real Jellyfin Music. |

That's four slices (facelift + three issues). Music is its own ticket so it is not buried in books.

## Rules for the builder

- VERSION stays **1.2.15** until the owner names a new stamp.
- One issue per pass. Do not combine facelift with Seerr with books.
- No indexer roster. No new ISO unless asked.
- When starting: write the issue number at the top of STATUS.md, implement only that, freeze.
