# STATUS.md

***Discover browse is unowned Seerr titles.*** 2026-09-09. The Discover tab was a second Library (Jellyfin shelf). Browse now loads Seerr popular movies/shows this box does not have. Search still `/api/lookup`. Stamp **1.2.50.17**. Complements #69. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.17`
- **Base:** this PR’s 1.2.50.14 DNS + 1.2.50.15 mailman + 1.2.50.16 enable=null
- Did **not** take Tron chrome from #52
- **What it is:** Discover browse = Seerr `/discover/movies` + `/discover/tv`, drop available/partial and Jellyfin ids. TorBox wizard ping sends `User-Agent: ReelOS`. Wire waits longer for Seerr first-run. Jellyfin 12 Startup/* 404/503 is retried. JF 12 `EnableLegacyAuthorization=true` so Jellyseerr can AuthenticateByName.

## Live test (this agent VM)

| Surface | Result |
| --- | --- |
| Jellyfin startup wizard | incomplete until wire re-run (no users) |
| Seerr initialized | false until Jellyfin login |
| Discover empty-search | was “on this box”; now unowned popular |
| TorBox ping | named UA |

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-update.test.mjs scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs src/lib/adapter.test.ts
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.17`.
3. Discover should show titles not already in Jellyfin. Request still lands in Jellyfin without extra taps.

## Do not

- Cut 1.2.51 / Tron #52
- Tap Apply twice
- Re-add compose `dns: 1.1.1.1`
