# STATUS.md

**Reelist (TV season import).** 2026-09-09. Patch the grab→symlink→Sonarr import path so a season request can finish. Separate from Tron #52. Stamp **1.2.50.1** (does not take 1.2.51).

## Stamp

- **VERSION / channel:** `1.2.50.1`
- **Base:** latest `main` `0e9704d` (1.2.50)
- **What it is:** Sonarr no longer scans `/mnt/symlinks` (Museum bleed). `_ep_tag` accepts `S01.E01` / `1x01`. Season-pack fallback + queue hint. `retry_import` posts Sonarr ManualImport (not only a dump scan). Duplicate same-season Seerr/queue rows are reused or failed-as-duplicate.

## Root cause (house, verified in code)

1. `#50` retried **Radarr** ManualImport on `importPending`. Sonarr only got `DownloadedEpisodesScan` on a dump folder — that is not a series library.
2. `sonarr_manual_import` and `kick_imports` listed **`/mnt/symlinks`** (parent of radarr+sonarr). Night at the Museum appeared in Sonarr unmatched samples.
3. Scene names `The.Walking.Dead.S01.E01.…` did not parse (`\s*` between Sxx and Exx misses a dot). Season-pack folders without per-file tags never mapped.
4. Duplicate Seerr POSTs (`seerr-3` + `seerr-4`) created a second grab that sat at honest 0% (we do not invent progress).

Museum imported because Radarr retry had `movieId`. TWD never became playable.

## Owner / house Apply

1. Merge to **main**. Phone Check→Apply (or `/opt/reelos/bin/reelos-update.sh apply`). Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.1`.
3. One TWD S01 request. Wait for `sonarr manualimport matched=` and `files=` > 0. Play on the TV.
4. If two rows remain from before Apply, Cancel the newer 0% row. Do not request S01 a second time.

## Do not

- Cut **1.2.51** (Tron reserved).
- Invent a progress % on Requests.
- Change season-by-season TV UX.
- SSH from the agent. Scope into Tron / books / TorBox wipe.
