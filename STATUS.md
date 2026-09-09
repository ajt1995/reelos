# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. Audited house Apply path. Mailman was not trustworthy: search hop fail-closed after a live swap, SKIP_NPM ignored lockfile drift, home probe was 45s, compose pull ran before stamp. Lean mailman fixes rebased onto #46 (lean `/api/library` shelf) and #47 (JF12 + non-blocking Finish). Did **not** edit HAL.md. Did **not** bump VERSION.

## Stamp

- **VERSION / channel:** still `1.2.48`
- **PR:** https://github.com/ajt1995/reelos/pull/48 (`cursor/ota-apply-audit-c3a3`)
- **Writeup:** `docs/OTA-APPLY-AUDIT.md`
- **What it is:** Phone Check→Apply can land a new tree and still refuse `applied-sha` (Seerr Batman hop, short probe, broken `npm ci`). Check then keeps offering the same update.

## Fix (mailman only)

- `SKIP_NPM` compares `package.json` **and** `package-lock.json`. Lock present → `npm ci` only (no `npm install` fallback).
- Refuse swap if staging is missing `package.json` / lockfile. `restore` moves a broken tree aside instead of `rm -rf` live app first.
- Search hop is advisory (#47’s 4× retry kept; red does not set `HOP_FAIL`). FUSE/Jellyfin fail-close only when compose yml changed.
- Home probe 90s. `docker compose pull` after `applied.`, 10 min cap.
- Guard: `scripts/reelos-update.test.mjs` + `check-ota.py` contracts. Existing `package-lock.test.mjs` stays.
- Already on main, kept: #46 lean cached shelf; #47 JF12 auth + Finish no longer `spawnSync` pull inside Vite.

## Owner / house Apply

See the checklist at the bottom of `docs/OTA-APPLY-AUDIT.md`. Short form:

1. Merge this tip to **main** (no VERSION bump).
2. If `reelos-ota` is stuck `activating`, wait or reset-failed after the process is gone.
3. Phone Check→Apply. Must print `ReelOS 1.2.48 applied.` Search hop red is OK.
4. `applied-sha` is this tip. Second Check is up to date. Home on `:80`.
5. `/opt/reelos/app/package.json` still exists.
6. Home/Library still paint from lean cached `/api/library` (#46). Finish must not wedge `:8080` (#47).

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Bump VERSION for a mailman repair.
- Apply a feature-branch tarball — **main only**.
- Scope into TorBox.

## Hal / xorriso

Hal: STATUS only; no HAL edit. No VERSION stamp. Phone OTA uses `main.tar.gz` + `channel.json`.
