# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.31**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later.

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.31 is the ship.*** 2026-09-11. House firstboot hit NRestarts 1722: wizard wrote `provisioned` but never `stack-installed`; `install.sh` died on GNU `cp` same-file when HERE==ROOT; unit `Restart=on-failure` every 30s. 1.2.50.30 mailman does **not** `systemctl enable reelos-firstboot`, so Apply of 30 would not re-enable a disabled unit — but a re-enabled unit would still loop, and the ISO/install path is still broken. This stamp latches `stack-installed` (wizard, Apply, Vite, provisioned install.sh), skips self-`cp`, and does not enable firstboot on a provisioned box. Does not take Tron (#52 / #70 / #59). 1.2.51 parked.

## Stamp

- **VERSION / channel:** `1.2.50.31`
- **Base:** `main` at 1.2.50.30
- Did **not** take Tron chrome from #52 / #70 / #59
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Firstboot is a no-op on a provisioned box

`/var/lib/reelos/stack-installed` is the unit latch (`ConditionPathExists=!…/stack-installed`). Wizard Finish and Apply write it when `provisioned` already exists. Vite latches it on start. `install.sh` stamps it and exits 0 before apt if provisioned.

### install.sh does not `cp` onto itself

Firstboot ExecStart is `/opt/reelos/install.sh` (HERE==ROOT). App/compose/bin/VERSION copies only run when HERE≠ROOT. GNU `cp` same-file was exit 1.

### Apply does not enable firstboot

Mailman never `systemctl enable reelos-firstboot`. It refreshes `/opt/reelos/install.sh` from the tarball so a later enable is still a no-op on a provisioned box.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/firstboot-install.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
```

## Owner / house Apply

**Do not Apply from the agent.** House is still **1.2.50.27**. Channel will offer 1.2.50.31 after merge. Owner phone **Check → Apply once**. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`.

SSH latch of `/var/lib/reelos/stack-installed` (if `provisioned` is already there) is the house protection until 31 is Applied.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
