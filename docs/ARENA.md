# Arena

**1.2.50.38-beta.1 paints this. Not 1.2.51. Not `main.tar.gz`.**

Austin 2026-09-11. Black floor, cyan circuit, neon kept. Gold is three verbs: **Watch / Download / Begin**. Phone chrome is dense. Motion is splash stages, Apply bar, request state — not idle rainbow.

Do not merge this onto the 1.2.50.x repair line as chrome. Stable Check stays **1.2.50.38** on `main.tar.gz`. Do not house Apply it. Do not reuse **1.2.51** (parked; was Tron; scrapped).

Scrapped night-city chrome (#52 / #70 / #59) is not this. Stills in `docs/arena/` remain the bar; density may still tighten.

## Floor

| Token | Use |
| --- | --- |
| **Black** `#000000` | Floor. Not charcoal gold-OS, not navy. |
| **Cyan circuit** `#3EE7F0` / `#5CF6FF` | Lanes, nodes, live pips, selected nav, in-flight bars, warming ring. Keep neon. |
| **Gold** `#D4A017` | **Watch**, **Download**, **Begin** only. |
| **White / muted** | Type. Wordmark is white, not gold. |
| **Danger** | Remove / Confirm remove. Never gold. |

Not gold: selected tabs, chips, Check, Apply, Finish, Continue, Retry, Cached, transferring, progress, the reel mark, “ReelOS”.

Download is the Books/file primary later. These stills do not invent a Books app. When Ready is a book, the gold button is Download.

## Still — not motion

Stills are parking, not a kit. Product copy wins if a still lies.

| Room | File | What it must show |
| --- | --- | --- |
| Home | [arena/arena-home.png](arena/arena-home.png) | Watch gold. Your requests = in-flight only. On this box + Remove. DirectPlay / TorBox live chips. Transferring count on Requests, not Discover. |
| Requests | [arena/arena-requests.png](arena/arena-requests.png) | In flight — searching, grabbing, waiting to import. Playable titles are in Library. Cyan All / progress. Watch gold. TorBox in the grab line. |
| Library | [arena/arena-library.png](arena/arena-library.png) | What Jellyfin has. Kind chips cyan when on. Remove. One card in Confirm remove? / Keep. Watch gold. |
| Settings → Updates | [arena/arena-settings-updates.png](arena/arena-settings-updates.png) | Installed **1.2.50.38**. Check cyan, not gold. No Apply while current. Beta off: Arena chrome and Books are not in the stable stamp. Advanced collapsed. DirectPlay · no GPU. Self-heal copy. Watch gold. |
| Splash | [arena/arena-splash.png](arena/arena-splash.png) | Provisioned warming: Local state / This house / Library / Requests. No Begin on this frame. Circuit floor. Wordmark white. |

First-run Begin (gold) is motion-only below. Do not paint it on the warming still.

Phone chrome is Home / Discover / Requests / Library / Settings. Selected is cyan, never gold. Watch stays in the header.

## Motion

Tasteful means the floor moves when the box is doing something, and holds still when it is not. Meaningful means each motion is a state the OS already has. `prefers-reduced-motion: reduce` kills travel, spin, and pulse; pips and bars jump to the end state.

**Timing.** Chrome 140–180ms ease-out. Page enter fade + 8px. Press 0.98 / 120ms on gold verbs only. No ken-burns on posters. No idle rainbow.

**Circuit.** Lanes are painted, not a screensaver. A single cyan packet (≤4s) runs the nearest lane only while:

- splash has a step **Working**
- a request is **searching** or **grabbing**
- Check is in flight

Library idle → floor still. Packet never celebrates Remove or Apply.

**Splash (warming).** Cyan dash ring on the mark rotates while any step is Working (one turn / ~2.4s). Ready pip fills 120ms. Working pip breathes 1.6s (opacity 1 → 0.45). Waiting pip stays faint. When `/api/ready` is honest, ring stops, 180ms fade to Home. Do not flash Begin setup on a provisioned house.

**Splash (first-run).** No step list. **Begin** is the only gold on that floor. Press, then traces draw once from the mark into the wizard. Continue / Finish in the wizard are not gold.

**Home.** Watch is static gold until press. Transferring chip is cyan; the packet aims at the Requests tab and the badge ticks. Grabbing bar is cyan fill. Searching pip breathes. Waiting is still. Your requests never holds Available / Cached / library hits.

**Requests.** Filter fill 140ms cyan. Grab bar is the in-flight meaning. Retry: one 180ms circuit tick, cyan ghost. Cancel: no motion.

**Library Remove.** Remove is danger type. Confirm remove? / Keep — Keep is the quiet path. On confirm the card fades 180ms and the grid reflows 200ms. Copy stays: unmonitor *arr, never `/media`, Decypharr is not wiped. Circuit does not cheer.

**Settings.** Check is cyan outline. Apply (when a target is pending) is a host verb — **not gold**. Advanced chevron 140ms; Heal stays behind it. Self-heal has no theater. DirectPlay pip is static (no GPU is a fact). Production UI is hashed `/assets/styles-*.css`. Beta toggle off by default.

**Wizard / TorBox.** Selected source card = cyan hairline. TorBox ping is a named User-Agent; the card does not gold-pulse. Continue is not Begin. Books chip off by default.

## Do not

- Stamp **1.2.51** or bump stable past 1.2.50.38
- Gold the nav, Check, Apply, or the wordmark
- Idle-animate the floor
- Merge #52 / #70 / #59
- Merge this tree onto `main` (Arena would leak through SHA-drift)
- House Apply from the agent
