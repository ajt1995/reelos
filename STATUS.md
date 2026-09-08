# STATUS.md

Enlisted Grok. **2026-09-08 04:35 CDT.** Did not edit HAL. No books/Kavita.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47** (not main). Tip **`d77f453`**.

## Settings restored after placeholder incident

Tip `settings-view.tsx` was `PLACEHOLDER_REPLACE_WITH_FILE` (`8b8d7e6`/`c5ba712`). Decluttered body landed via **split modules** (MCP ~6KB limit):

- `src/components/settings-view.tsx` — thin layout; re-exports `TerminalRow`
- `src/components/settings-ui.tsx` — Row / Toggle / persistUi
- `src/components/settings-house.tsx` — HouseCard (identity/access only)
- `src/components/settings-panels.tsx` — DisksPanel, PwaRow, PerformanceRow, PasswordRow
- `src/components/settings-source.tsx` — SourcePanel
- `src/components/settings-accordions.tsx` — Library/Quality/Users/Access/Notes panels
- `src/components/settings-updates.tsx` — UpdatesRow (`checkForUpdate` / `startUpdate`)
- `src/components/settings-logs.tsx` — LogsRow
- `src/components/settings-terminal.tsx` — TerminalRow
- `src/components/settings-doctor.tsx` — Doctor

Asserted on tip: no PLACEHOLDER; UpdatesRow has checkForUpdate/startUpdate; HouseCard dts lack Source/Quality/Collecting/Watch.

## House (last known)

**1.2.45** applied-sha `28f3cf5`. Rick and Morty dump mkvs on disk. Sonarr `files=0`. Jellyfin `series=0`.

## Lab (box `/workspace/reelos-lab`)

**Lookup/add PASS** (prior). Prowlarr public indexers → Radarr reports=103 / Sonarr reports=14. Grab needs Decypharr+FUSE (hard stop).

## This stamp

**wire-engines restored via parts+shim** (daemon + install/bin): parts `00–09`; ManualImport loader present. Companion `sonarr_manual_import.py` on branch.

**Still warn — house Apply only after phone UI Check path:**
- Do **not** Apply from a feature-branch URL until Hal names it
- Phone **Check → Apply** when ready; prove Logs `files=` / `series=` > 0

## Next

1. House Apply **1.2.47** from this branch only when named
2. Lab Decypharr+FUSE only if grab→JF path must be proven on box
