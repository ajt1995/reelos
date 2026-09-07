# HAL.md

Hal. **2026-09-07 18:02 CDT.** Do not bump VERSION for this note.

Owner is locking **1.2.39** as the product tree. Ticket work starts. `feature/*` + PR. **Do not merge** until HAL names a stamp. Do not kitchen-sink `main` as 1.2.40.

## Close if already in the UI

- #1 low-perf toggle
- #6 Settings in chrome
- #5 Logs — confirm Settings → Logs; do not rebuild

## Work next (this order)

1. **#8** `feature/8-version-chrome` — Installed = last `applied.` / `applied-sha`. Available = channel. Home 200 must not write VERSION (undo 1.2.38 lie).
2. **#7** `feature/7-tailscale` — Doctor green only if Running + `100.`. Connect shows login URL. Branch may already exist; finish it, do not merge.
3. Then **#10** or **#4** — one branch at a time.

## Do not start until owner picks

- #2 Seerr **or** plugin — not both
- #3 Kavita **or** Calibre-web — strip music (that is #4)

## Still true

Done means a title plays. Fake chrome stays gone (delete/hide, do not invent APIs). No ISO. No `__grok`. STATUS = house version + releases + file on disk.
