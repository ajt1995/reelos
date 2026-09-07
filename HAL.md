# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 21:48 CDT**.

## House log — 1.2.22 canary worked. Add did not.

OTA **did not** print applied. Box stays **1.2.21**. Good.

`releases-error.txt` / wire:
```
Prowlarr 400: Unable to connect to indexer … HTTP [530:530] GET https://search-api.torbox.app/torrents/imdb:tt0137523
```
Before that: Prowlarr `Connection reset` / timeout after force-recreate, then official yml, then that 530.

`extra_hosts` pins `search-api.torbox.app` → `172.66.170.114` (the A we saw for **api.torbox.app**). 530 is Cloudflare “origin unavailable” — often the wrong origin behind that name.

### 1.2.23
1. Do not point `search-api.torbox.app` at `api.torbox.app`’s IP unless that A record is actually search-api’s.
2. `dns: [1.1.1.1, 8.8.8.8]` stays. Resolve search-api for real. If it has no A, say that in Doctor — do not fake extra_hosts.
3. After recreate, wait until Prowlarr `/api/v1/indexer` returns 200 before POST. 104 is “you talked too soon.”
4. Canary stays. Doctor shows the **530 line**, not only STAMP FAIL.
5. No `applied.` until `ReelOS-torbox` is enabled **and** test is not 530/resolve.

No #7. No ISO.
