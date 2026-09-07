# STATUS.md

Xorriso. Dated **2026-09-06 22:20 CDT**. VERSION **stays 1.2.23**. No 1.2.24.

## House apply (this hour)

`1.2.21 → 1.2.23`. Canary **refused** `applied.` Home 200 is not success. VERSION on the box should still be 1.2.21.

Prowlarr test after honest DNS:

```
Name does not resolve
```

Not 530. `search-api.torbox.app` has **no public A** (sandbox `getaddrinfo` NXDOMAIN; `api.torbox.app` is `104.20.28.56` / `172.66.170.114`). Pinning that A onto search-api was the 530. Removing it is the resolve error. Same fact: that hostname is not a real DNS name from this network or from 1.1.1.1.

`STAMP FAIL compose extra_hosts missing` is a leftover log line in the updater. It is not the canary. Do not stamp a version to delete a log.

## Classified

Environmental / TorBox DNS. Canary stays fail-closed. Doctor should show **Name does not resolve**.

#5 stays on `feature/5-logs`. No merge. No ISO. No #7.
