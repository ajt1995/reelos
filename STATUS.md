# STATUS.md

Xorriso. Dated **2026-09-06 22:12 CDT**. Independent audit of HEAD **1.2.23** (`350753e` mailbox + `d019b1b` stamp). **VERSION unchanged.**

## Product sentence

Done = a title plays on the TV. That is **not** true. House last *applied* **1.2.21**. 1.2.22 refused `applied.` on Prowlarr 530 (with pinned `extra_hosts`). 1.2.23 is on the channel and has not been proven on the box.

## Tree (1.2.23)

| Check | Result |
|---|---|
| Compose `extra_hosts` | gone. `dns: 1.1.1.1/8.8.8.8` stays |
| Wire inject fake A | skipped (`search-api extra_hosts skipped`) |
| Canary before VERSION stamp | yes. Fail-closed. Tests `POST /indexer/test` |
| Canary on 530 | fail, no `applied.` |
| Doctor releases | raw Prowlarr line / last `releases-error.txt`, not “Provider indexer missing” |
| Dead code | `torbox_search_ip()` still *returns* `172.66.170.114` if dig fails. **Not called** after inject skip. Not a stamp |
| Doctor Tailscale | still “binary”. #7 parked. Correct on `main` |
| Doctor “Download lock” | **hard-codes `ok: true`** “Decypharr is the only client path”. DEV forbids that. Not 1.2.24 |
| `__grok` / scaffold | not touched |

## Do not

Cut 1.2.24 if 1.2.23 still 530 with honest DNS. That is TorBox/Cloudflare from this network. Merge #7. Touch `__grok`. Stamp VERSION because this file changed.

## Idle

#5 on `feature/5-logs` only. Not merged. Canary stays fail-closed.
