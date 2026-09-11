# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.30**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later.

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.30+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.30 is the ship.*** 2026-09-10. Owner Home showed Night at the Museum (Cached), John Wick (Available now), Coyote vs. Acme (Available now) plus "25 transferring" in **Your requests** at the top — redundant with On this box. 1.2.50.29 (splash /api/ready / rsync overlay) did not change that row. This stamp hides shelf/library hits on Home and counts transferring with the same in-flight definition. Requests still lists everything. Does not take Tron (#52 / #70 / #59). Tron chrome is scrapped (see standing orders).

## Stamp

- **VERSION / channel:** `1.2.50.30`
- **Base:** `main` at 1.2.50.29
- Did **not** take Tron chrome from #52 / #70 / #59
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Home Your requests is in-flight only

Hide rows already on the shelf/library: status available, engine downloaded, overlay library hit, Cached / Available now. Keep searching, grabbing, and linked waiting for import. The row disappears when nothing is in flight.

### Transferring chip uses the same definition

Do not show "25 transferring" when those 25 are mostly available. Overlay library presence first, then count downloading/waiting only. Nav Requests badge matches Home.

### Requests page unchanged

Filters still list available / downloading / waiting / failed. Honesty overlay still upgrades library hits to available there.

## Proof

```
python3 scripts/check-ota.py .
node --experimental-strip-types --test src/lib/sync-requests.test.ts
node --test scripts/stack-smoke.test.mjs scripts/reelos-seerr.test.mjs scripts/reelos-settings.test.mjs scripts/reelos-request-status.test.mjs scripts/jellyfin-seed.test.mjs scripts/reelos-ready.test.mjs scripts/reelos-library.test.mjs
```

## Owner / house Apply

**This STATUS update is not a stamp. Do not house Apply for this PR.**

1.2.50.30 is already on **main** (#86). If the house is still on an older 1.2.50.x: phone **Check → Apply once**. Home top row should not repeat On this box. Idle library → "Library idle". Requests still has the full household list.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent (door was flaky; owner Applies)
