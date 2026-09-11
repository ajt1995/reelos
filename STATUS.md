# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.32**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later.

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.32 is the ship.*** 2026-09-11. One stamp: Requests is in-flight only; search→request→play honesty; Remove from this box (unmonitor/*arr delete, never /media); in-app changelog on Settings → Updates. Absorbs sibling 32/34/35 work so the house Checks and Applies **once**. Does not take Tron (#52 / #70 / #59). 1.2.51 parked.

## Stamp

- **VERSION / channel:** `1.2.50.32`
- **Base:** `main` at 1.2.50.31
- Cooked sibling request-play / Requests in-flight / library-remove / changelog into **this one number**
- [#91](https://github.com/ajt1995/reelos/pull/91) is **DO NOT APPLY** — changelog UI lives here, not as 1.2.50.34
- Did **not** take Tron chrome from #52 / #70 / #59
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Requests is in-flight only

Requests overlays the JF shelf then keeps searching / grabbing / linked waiting for import. Available, Cached, and Play leave the page — they live on Library / On this box. Cancel (and Retry on locks) stay. Home already did this on 1.2.50.30.

### Search → request → play honesty

GET `/api/request?recover=1` on every poll (server cooldown still applies). Overlay uses the JF shelf, not leftover available TMDB ids. Home cards resolve `r.title` when catalog is empty. GET-by-id kicks `wire-engines import` once when a title is available. FUSE dump listing uses timed `ls`. Connect JF chip is gold while probing; loopback-up is green.

### Remove from this box

Phone title / Library / On this box: confirm, then unmonitor and DELETE the Radarr/Sonarr row. `deleteFiles` only for a title dump folder, never `/media` or FUSE roots. Seerr request/media rows go with it. Overlay hides the poster until you request it again.

### Settings Updates shows a changelog

Settings → Box → Updates always lists **This install**. After Check, **This update** is the pending target only — owner English, not a git log. Settings stays a repair panel (Heal/Doctor untouched).

### House facts (not a stamp — from #88 / #89)

House is still **1.2.50.27**. `ota.lock` exists; flock not held — do not delete. Firstboot is disabled/idle; `stack-installed` latched. Door `:80`/`:8080`/`:8096` were 200 at the last SSH scan. Do not fight those STATUS PRs; they are docs, not Applies.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/update-notes.test.mjs scripts/reelos-library-remove.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-library.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

**Do not Apply from the agent.** House is still **1.2.50.27**. Channel will offer **1.2.50.32** after merge. Owner phone **Check → Apply once** after VM boot of this stamp. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`.

SSH 2026-09-11: wrote `/var/lib/reelos/stack-installed` (`provisioned` present, 8 compose containers live). `systemctl start` (not enable) **skipped** — `ConditionPathExists=!/var/lib/reelos/stack-installed`. Unit left **disabled**. Old loop journal: `cp: '/opt/reelos/bin/.' and '/opt/reelos/bin/.' are the same file`.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- House Apply 34 then 35 then 32 — this stamp is the one Apply
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
