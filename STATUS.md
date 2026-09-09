# STATUS.md

***Live *arr v4 enable=null.*** 2026-09-09. Test stack: Docker DNS works; Prowlarr YTS search hits Interstellar; Radarr MoviesSearch queued 3 YTS releases. Heal still said **no search indexer** because linuxserver Radarr/Sonarr return `enable: null` with search flags on. Stamp **1.2.50.16**. Complements #69 DNS + mailman. Does not take Tron.

## Stamp

- **VERSION / channel:** `1.2.50.16`
- **Base:** this PR’s 1.2.50.14 DNS + 1.2.50.15 mailman
- Did **not** take Tron chrome from #52
- **What it is:** Treat `enable: null` + `enableAutomaticSearch: true` as an enabled *arr indexer. Keep DNS-free compose and pre-swap compose cmp.

## Live test (this agent VM)

| Surface | Result |
| --- | --- |
| `radarr`/`prowlarr` Docker DNS | resolves |
| Prowlarr YTS `Interstellar` | 5 hits |
| Radarr MoviesSearch Interstellar | 3 YTS releases, queue 1 |
| Sonarr SeasonSearch B99 S01 | 0 (EZTV/ShowRSS are TorrentRss; Cardigann EZTV CF-blocked) |
| Heal before fix | `Radarr has no search indexer` with YTS already attached |
| Heal after fix | YTS counts |

TorBox grab not run — `TORBOX_API_KEY` secret not in this VM yet. Do not Apply until that secret is in and/or this is on **main**.

## Proof

```
python3 scripts/check-ota.py .
python3 daemon/reelos-doctor.py --self-test
python3 daemon/public_indexers.py --self-test
node --test scripts/reelos-update.test.mjs scripts/stack-smoke.test.mjs
```

## Owner / house Apply

1. Merge this to **main**. Phone Check→Apply **once**. Tarball `main.tar.gz`.
2. `cat /opt/reelos/VERSION` → `1.2.50.16`. Expect stack recreate (dns drop) then `ReelOS 1.2.50.16 applied.`
3. Doctor Request hop must see a Radarr search indexer.

## Do not

- Cut **1.2.51** (Tron reserved).
- Merge this PR from the agent until the owner says so.
- Tap Apply twice.
- Wipe `/media` local-disk libraries.
