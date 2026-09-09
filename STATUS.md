# STATUS.md

**Reelist (public TV indexers on OTA).** 2026-09-09. House 1.2.50.5: Interstellar / John Wick / Expanse S01 **Available@100 via Decypharr**. B99 S01 + TWD S01 still `sonarr-missing@0`. Austin: thin indexers, not another symlink bug. Separate from Tron #52. Stamp **1.2.50.6**.

## Stamp

- **VERSION / channel:** `1.2.50.6`
- **Base:** latest `main` (merged #57 = 1.2.50.5)
- Did **not** take Tron chrome from #52
- **What it is:** OTA Apply adds missing **public** Prowlarr defs (EZTV, ShowRSS, 1337x, TPB; YTS stays movies-only) and **fullSyncs** them to Sonarr. No private tracker credentials.

## Verdict (indexer gap vs code vs slow)

| Title | House now | Why |
| --- | --- | --- |
| Interstellar, John Wick | Available@100 | YTS + TorBox + grab path work. Not a symlink bug. |
| Expanse S01 | Available@100 | SeasonSearch **does fire**. Some TV indexer (TorBox/TPB/1337x) had a pack. |
| B99 S01, TWD S01 | sonarr-missing@0 | Search likely ran and found nothing useful. YTS has **no TV**. EZTV was in git but **OTA skipped adding it**. Prowlarr→Sonarr was `addOnly`. |

Not “just slow.” Movies and Expanse already finished. Residual after this stamp: publics still thin for some sitcom **Ultra-HD** season packs — then it stays missing (catalog), not a FUSE dump bug.

## What ReelOS provisions

1. **TorBox** official yml / `search-api.torbox.app` torznab (`ReelOS-torbox`).
2. **Public first-party Prowlarr defs (no keys):** 1337x, TPB, YTS (movies), EZTV (TV), ShowRSS (TV).
3. **Not shipped:** private trackers, passkeys, user-added Torznab from Settings (Connect paste still valid).

1.2.24 added TPB/YTS so Request could grab while TorBox DNS was dead. Later commits listed EZTV in `PUBLIC_INDEXERS`, but `ensure_public_indexers` **returned immediately on `REELOS_OTA=1`**, and UI-only Apply never ran that hop. House that first-booted on YTS/TPB never got EZTV on Sonarr.

## Code changes

1. **`public_indexers.py`** — roster + roles. Unit: YTS ⊄ TV; house-with-only-YTS still needs EZTV/ShowRSS.
2. **`ensure_public_indexers`** — OTA **adds** missing defs; only live `indexer/test` is skipped.
3. **`ensure_prowlarr_app`** — `fullSync`; PUT existing `addOnly` apps. `ApplicationIndexerSync`.
4. **`wire-engines.py indexers`** — mailman runs this on **every** provisioned Apply (not only compose-changed).
5. Kept from the first audit: MoviesSearch on movie POST, `?recover=1` includes movies, Seerr `preventSearch=false` PUT. Complementary; not why Expanse already landed.

## Residual (no code change)

- Ultra-HD (`hybrid`) can reject EZTV’s typical 720p WEB-DL. Expanse 4K packs pass; B99 4K remuxes are rare on publics.
- If Prowlarr has no EZTV/ShowRSS **schema**, we log `no schema` and skip — first-party Cardigann only.
- TorBox rate limit / empty cache is house. Doctor hop / `releases-error.txt`.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/public_indexers.py --self-test
python3 daemon/stuck-downloads.py --self-test
node --test scripts/public-indexers.test.mjs scripts/reelos-request-status.test.mjs scripts/stack-smoke.test.mjs scripts/wire-provision.test.mjs scripts/stuck-downloads.test.mjs
```

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.6`. Expect `ReelOS 1.2.50.6 applied.`
3. Prowlarr: ReelOS-eztv / ReelOS-showrss present if schema exists. Sonarr indexers include them.
4. B99 S01 / TWD S01: next lock-clients tick SeasonSearchs. Available if a public/TorBox pack matches the profile. Still 0% + `sonarr-missing` means the publics have no matching release — add your own indexer in Settings if you have one. Do not expect us to invent a private key.

## Do not

- Cut **1.2.51** (Tron reserved).
- Commit private tracker credentials.
- Invent a progress % on Requests.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
