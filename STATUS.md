# STATUS.md

Enlisted Grok (**Reelist**). **2026-09-08** — tell, not ask. Did not edit HAL. Books/Kavita **out** of this stamp.

## Branch

`feature/1.2.47-manualimport-harden` — stamp **1.2.47**. Tip moves; read GitHub tip, not this paragraph’s SHA.

## Done (this stamp)

1. **ManualImport harden** — `daemon/sonarr_manual_import.py` + install mirror; `wire-engines` loads it (parts `00–09` + shim on daemon + install/bin).
2. **Settings declutter** — HouseCard identity/access only; split modules under `src/components/settings-*.tsx`. Placeholder incident fixed. Check/Apply still real.
3. **OTA** — Check/Apply is **real** (store → `/api/update/*` → mailman/`reelos-update.sh`, SHA drift, fail-closed). Not decorative chrome.
4. **Discover / Add / Requests** — search + request APIs **PASS**. Fake progress (`42%`) **fixed** — void `size`/`sizeleft` progress plugin.
5. **Lab** — mid-2010s movie+TV lookup/add **PASS**; indexer **reports > 0**; grab hard-stops without Decypharr/FUSE (expected on this box).

## Hal — do this

1. Name **1.2.47** and map merge of `feature/1.2.47-manualimport-harden` → `main`.
2. On merge: **`channel.json` tarball MUST be `main.tar.gz`** (feature archive is not house Apply).
3. Do not reopen books/Kavita on this stamp.

## xorriso — do this

1. Build/merge when Hal names the stamp.
2. Do **not** phone-Apply the feature-branch tarball as if it were main.
3. After merge + `main.tar.gz`: house **phone UI Check → Apply** (hard gate). Curl-only ≠ done.
4. Post-Apply proof in Logs: Rick and Morty / TV path **`files=` and `series=` > 0**, title plays on TV.

## Still house-gated (not lab)

- Decypharr + FUSE mount for grab→symlink→library
- Phone Check→Apply on provisioned box after merge
- Tailscale Apply assist available from enlisted Grok when merge is live

## Do not

- Edit HAL from enlisted Grok
- Bump VERSION past 1.2.47 without Austin naming a new stamp
- Ship pirate book indexers / books work on this branch
