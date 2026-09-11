# STATUS.md

**Copy this block onto every later STATUS. Austin 2026-09-11. Canonical.**

## Standing orders — Tron scrap / Arena later / Books live

- **Tron chrome is scrapped.** Cyan/gold Tron-night phone redesign is not shipping. They were going for **Arena** instead. Arena is a later **named** pass. Do not implement Arena UI on this line. Do not merge [#52](https://github.com/ajt1995/reelos/pull/52) / [#70](https://github.com/ajt1995/reelos/pull/70) / [#59](https://github.com/ajt1995/reelos/pull/59) onto the 1.2.50.x repair line. Do not house Apply those tarballs.
- **1.2.51 stays parked / unused.** It was reserved for Tron. Tron chrome is **not shipping**. Do **not** silently reassign 1.2.51 to Arena, Books, or a drive-by stamp. Leave the number unused until the owner names a stamp. Future 1.2.50.x channel notes: `1.2.51 parked (was Tron chrome; scrapped — do not reuse).` Do not write `Not 1.2.51 (Tron)` as if Tron were still the next ship.
- **Books / Kavita still wanted.** Must not die with Tron. Do not glue Books to #70 as 1.2.51. Product lands on **current 1.2.50.x gold chrome** (now **1.2.50.34**). See [#74](https://github.com/ajt1995/reelos/pull/74). Salvage Books from #70 / #52 / #42 / #40 / #17 **without** Tron tokens, CSS, or magenta. Arena chrome is a separate named stamp later. **Beta channel is wired in this stamp; Arena+Books are not shipped here.**

### Books path (write it; do not code Kavita on a STATUS pass)

Land on 1.2.50.x gold. Kind is a word or a 6px pip. Download stays gold. No magenta Books app. No wait for Arena.

- Wizard **Books** chip, same pattern as Music, **off by default**. Settings intent toggle.
- Legal catalog search only (Gutenberg / Standard Ebooks / Internet Archive). Allowlist in grab/download code. No pirate indexers.
- Phone primary: download the file; the device reader opens it. No in-app EPUB player. Ready for a book is **Download**.
- Kavita (`lscr.io/linuxserver/kavita`, compose profile `books`, `/srv/media/books`, `:5000`) is the **box library**, a secondary “Library on the box” link. Caddy `/kavita*` only — do not steal `/books*`.
- Home/Library Books row only when `intent.books` **and** real files exist.
- Rebase onto current `main` (1.2.50.31+). Do not merge Tron+Books as one 1.2.51 stamp.

## Current ship

***1.2.50.34 is the ship.*** 2026-09-11. Background self-heal (door / hung Vite, compose/*arr/Seerr up if provisioned, JF token/probe, request recover, unstick searching-if-file-on-disk). Settings is Check/Apply + changelog + low-perf — Heal/Hops/Doctor behind **Advanced**. Production `start:box` serves a built UI when `dist` exists, else vite. Beta channel stub for later Arena+Books. Does not take Tron (#52 / #70 / #59). 1.2.51 parked.

## Stamp

- **VERSION / channel:** `1.2.50.34`
- **channel tarball:** `main.tar.gz`
- **Base:** `main` at 1.2.50.33 ([#95](https://github.com/ajt1995/reelos/pull/95) Requests in-flight, library remove, changelog)
- **self-heal:** background timer; Austin does not tap Heal
- **Settings:** not a repair bench
- **beta later Arena+Books** (infrastructure only; no Arena chrome, no Books in this stamp)
- **1.2.51** remains unused/parked (was Tron; not reassigned to Arena)

## Changelog

### Background diagnose + self-heal

A two-minute timer plus the box process: restore `:8080` / `:80` (restart hung Vite, not a no-op start), `docker compose up -d --no-recreate` when provisioned, probe the Jellyfin token, recover in-flight requests, import when a searching row already has a file on disk. Does not talk to TorBox. Does not re-enable firstboot. Does not walk FUSE.

### Settings is not a repair bench

Check / Apply and the changelog stay on Box. Low performance mode stays. Heal, hops, doctor, named Fix, terminal, repair wizard, and factory reset sit behind one **Advanced** disclosure.

### Production start

`npm run start:box` → `scripts/reelos-box.mjs`. If a client `dist` (or `.output/public`) exists, a small Node server serves it and the existing `/api` plugins. Otherwise the door is still `vite --host :8080`. 4GB Apply still skips `npm ci` unless package.json changed. Not a Go rewrite.

### Mental model

Requests stays in-flight. Library stays the shelf with Remove. Play uses Jellyfin; on LAN the official app is `http://<lan>:8096` without Tailscale. No secrets in that copy.

### Beta channel (infrastructure)

Settings toggle, off by default. Check reads `channel-beta.json` (or a stub). Arena chrome and Books are **not** in this stamp.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs scripts/reelos-selfheal.test.mjs scripts/reelos-repair.test.mjs scripts/reelos-request-status.test.mjs scripts/update-notes.test.mjs
node --experimental-strip-types --test src/lib/sync-requests.test.ts
NODE_ENV=production npm run start:box
# GET / and GET /api/ready → 200
```

## Owner / house Apply

**Do not Apply from the agent.** House stays **1.2.50.31**. Austin should still not update until this stamp is on **main AND booted**. Then Check → Apply **once**. Do not re-enable `reelos-firstboot`. Do not delete `ota.lock`. Do not wipe `/media`.

## Do not

- Merge #52 / #70 / #59 onto the 1.2.50.x repair line
- Stamp **1.2.51** (parked; was Tron; chrome scrapped; not Arena)
- Implement Arena UI until the owner names that pass
- Glue Books/Kavita to Tron chrome or burn it as 1.2.51
- Ship Arena chrome or Books in this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
- Post house Apply from the agent
- Re-enable `reelos-firstboot` or re-run house `/opt/reelos/install.sh`
