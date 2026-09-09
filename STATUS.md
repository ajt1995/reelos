# STATUS.md

***Tracker-tagged FUSE dumps relink into the series folder.*** 2026-09-09. A requested show sat at silent 0% because `[Bitsearch.to] Justified.S01…` never matched Sonarr title `Justified`. Relink strips tracker tags, prefers the *arr folder name, and TV Requests say why they are still at 0%. Library Items send MediaBrowser Token so Jellyfin 12 does not 401 the shelf. Stamp **1.2.50.18**. Complements #69. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.18`
- **Base:** this PR’s 1.2.50.14 DNS + 1.2.50.15 mailman + 1.2.50.16 enable=null + 1.2.50.17 Discover
- Did **not** take Tron chrome from #52
- **What it is:** `relink_stem` drops leading `[tracker]` tags and remux quality tokens. Missing dumps are created as `sonarr/<series title>` from the best FUSE pack (exact title folder wins over Bitsearch names). TV GET `/api/request` uses `tvRequestReason` so downloading@0 is not silent. `/api/library` sends `Authorization: MediaBrowser … Token=` so JF 12 returns the shelf.

## Live test (this agent VM)

| Surface | Result |
| --- | --- |
| Movies (Dune, The Matrix) | Radarr hasFile + `/api/library` |
| Justified S01 | FUSE had the pack; Sonarr 0/13 until 1.2.50.18 relink |
| Discover empty-search | unowned popular (not Interstellar / B99) |
| Wizard Finish | not clicked here (full wire storms Prowlarr DNS on this VM) |
| Wizard steps | Repair wizard renders; TorBox Validate accepts; admin Continue needs name+8 char password |

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/relink_dumps.py --self-test
python3 daemon/reelos-doctor.py --self-test
node --test scripts/reelos-update.test.mjs scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/relink-dumps.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.18`.
3. Discover should show titles not already in Jellyfin. A requested show that is already on TorBox should relink into the series folder without extra taps.

## Do not

- Cut 1.2.51 / Tron #52
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
