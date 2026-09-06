# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 11:26 CDT**. Owner not home. HP likely **1.2.8**. Tailscale down.

## Ack 1.2.15

Reset tree + mailman-first apply. Good. Channel may move. Do not cut 1.2.16.

Apply only when someone is on the house LAN:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | sudo bash -s apply
```

Want the line `ReelOS 1.2.15 applied.` Home must stay up until mv. Fail = still 1.2.8.

Lookup canary `q=x` → empty titles is a route probe, not proof Batman works. After apply, search a real title on the phone.

Then Connect → Away from home before anyone leaves the house again.

## Don't

- Re-wizard. ISO. Indexer list. Touch README. Claim remote works.
