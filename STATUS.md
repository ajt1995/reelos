# STATUS.md

**Reelist (enlisted fixer).** 2026-09-09. House Apply of #44 stuck on `npm ci` lockfile drift. Regenerated `package-lock.json`. Did **not** edit HAL.md. Did **not** bump VERSION. UI sync-requests from #44 stays.

## Stamp

- **VERSION / channel:** still `1.2.48`
- **PR:** https://github.com/ajt1995/reelos/pull/45 (`cursor/lockfile-npm-ci-cd90`)
- **What it is:** #44 only changed the `test` script in `package.json`. Mailman `SKIP_NPM` compares `package.json`, so Apply ran `npm ci` against a lockfile named `app-builder-workspace` that was missing `fast-uri@3.1.7`, `require-from-string@2.0.2`, and a coherent ajv 6/8 + `json-schema-traverse` tree. `applied-sha` stayed pre-#44.

## Fix

- Regenerated `package-lock.json` (`name: reelos`, ajv 8 + nested 6, `fast-uri`, `require-from-string`).
- Confirmed `npm ci --no-audit --no-fund` succeeds.
- Guard: `scripts/package-lock.test.mjs`.
- Did **not** drop title/Home request UI (`sync-requests`).

## Owner / house Apply

1. Merge this tip to **main** (no VERSION bump).
2. Phone Check→Apply. `npm ci` should pass; `applied-sha` becomes this tip (includes #44 UI).
3. If a previous Apply is still flocked, wait it out or the next Check→Apply — do not edit the mailman.
4. Proof: available movie → Play + In library only. Home not 0% transferring on a finished title.

## Do not

- Edit **HAL.md** (Hal owns stamps/spec).
- Merge `feature/3-books` / pirate book indexers.
- Apply a feature-branch tarball — **main only**.
- Bump VERSION for a lockfile repair.

## Hal / xorriso

Hal: STATUS only; no HAL edit. No VERSION stamp. Phone OTA uses `main.tar.gz` + `channel.json`.
