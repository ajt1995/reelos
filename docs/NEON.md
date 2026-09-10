# Arena — design decision

**2026-09-10.** Austin. Phone-first. Not a stamp. Not an OTA.

## Verdict

**EVOLVE Tron-night into Arena.** Do not keep PR #70 as-is. Do not replace it with a new world. Do not merge it.

Reference world: **Tron Legacy arena** — black floor, cyan circuit, gold identity disc. Not Blade Runner 2049 (haze, muted amber — that is the parked FACELIFT “one gold, no neon” pass you no longer want). Not an arcade cabinet (every button a different neon). One electric. One commit. Posters are the players; chrome is the floor.

Tron-night was the right mood board and the wrong stamp. The Vite captures on `cursor/tron-night-books-aea2` show why. (OCR “Homee / Discoverer” is letter-spacing in the capture, not the copy.)

## Why — the actual paint

**Home.** Cyan section heads and the gold grab bar on Station Line are the energy we want. Then the row is swamp-green bricks — Night Harbor, Station Line — with no art. “On this box” repeats the dead tiles. The grid sits under them like a screensaver. A house Home cannot look like a demo cartridge.

**Books on Home and Library.** Frankenstein is the only object that feels held. It is also a magenta island: pink stroke, pink letter, pink section, pink Books tab. That is a second app glued into the nav. Kind is a label. It is not a theme.

**Discover.** Filter chips are the best chrome in the set — idle rings, Seerr lit cyan. Search stays quiet. Then the same green bricks. Grid plus empty posters is two backgrounds fighting the thing people came to see.

**Wizard chips.** Cleanest screen in the set. Movies / TV / Anime / 4K / Kids share one cyan language. Books goes pink the moment it is on. Music goes dead-gray. One selected kind should not change the physics of the chip.

**Settings.** Grid under a wall of text. Pink URLs in the Books paragraph. The gold Low-performance toggle is the only honest control. Paint cannot save a novel. Collapse the copy later; do not neon it.

**Requests.** Closest to shippable. Grabbing chip glows. Gold bar. “searching · 62%” reads as a real *arr number, not a fake. The tiny green thumb is still a lie if there is no poster.

## Tokens

Bright means **1–2px neon and small glows**, not fills. Full-punch cyan on a ring or an icon. Cyan at ~25% for glow. Never a wash behind art. Real posters are the light.

| Token | Hex | Role |
| --- | --- | --- |
| void | `#05080f` | Page floor. A hair above #70’s `#03060c` so cards can lift. |
| raised | `#0a0f18` | Header, sheets, nav well. |
| card | `#0d1420` | Rows and tiles. Blue-black. Never green-tinted. |
| electric | `#00e5ff` | Selection, live, nav-on, chip ring, focus, gear. **Edges only.** |
| gold | `#e8c547` | Wordmark + commit fills: Watch, Download, Continue, Search, Apply, Begin. Not selection. |
| gold-ink | `#1a1406` | Type on gold. |
| live | electric | Grabbing / on-box pulse. Same cyan, not a third hue. |
| kind | label only | Word (“Book”) or a 6px pip on the row. No tab color. No section color. |
| magenta `#ff3cae` | off chrome | Not a Books theme. A pip is the most it may be. |
| type | Inter + Outfit | Body and titles. Mono only for IPv4 and paths. |

Today’s 1.2.50.21 live cyan `#3ec6d8` is too timid for Arena. `#00e5ff` is the electric. Do not go hotter (`#00ffff` washes out). Do not go back to gold-only.

## Keep / drop from #70

| Keep | Drop |
| --- | --- |
| Cyan as the one electric | Grid wallpaper on every page |
| Gold locked to wordmark + commit | Magenta Books tab, chips, cards, section heads |
| FilterChip active glow (Discover Seerr, Requests Grabbing) | Share Tech Mono as the face |
| Settings gear in the phone header | Empty green poster bricks |
| Home honesty — only what is on the box | Card-glow on every tile |
| Books primary = Download file to the phone (this is product, not paint) | Field-glow on every input |
| Darker void than today’s `#0b0d10` | Three electrics at once (cyan + gold + magenta) |
| 1px glow-line under the header, if it stays quiet | Coupling Books + Tron in one merge |

Grid may live on Splash, faintly. Nowhere that a poster or a paragraph has to win.

## Ship plan — Books does not wait

Books product lands on **current 1.2.50.21 chrome**: void charcoal, gold commit, live cyan. Same chips as Movies. Download is already gold — keep it. If a book row needs a mark, use the word “Book” or a 6px pip. Not a theme. Not a new font.

**Never merge #70 as 1.2.51.** That stamp couples Tron chrome and Books product. Chrome and Books stay separable. Arena is its own later paint job. You name the version. Not this PR.

FACELIFT.md’s “no neon” line is dead. Its “kind is a label, not a new theme” line is not.

Redesign is tokens + chrome. No new rooms. Settings Fix, one-poster movies, and hybrid 1080+4K stay as they shipped.

## First five screens (when you name a version)

Phone 390. Desktop after.

1. **Splash** — gold wordmark, one cyan breath, gold Begin. No grid carpet.
2. **Home** — one real poster if the box has one. Empty is type on void, not green bricks. A live grab may glow.
3. **Discover** — chips + search as in #70. Results are real posters or nothing.
4. **Requests** — keep the Grabbing chip and the gold bar. No fake thumbs.
5. **Wizard “What are you collecting?”** — every on-chip is electric cyan, including Books.

Settings keep the hairline and the gold toggle. Do not rewrite the essay in the paint pass.

### Motion

140–180ms ease-out. Chip and nav-on snap with a short glow. Live pulse only on an active grab. `prefers-reduced-motion`: no pulse, no grid shimmer, no kenburns, state is instant.

## What would break this

- Merging #70 as the redesign, or any stamp that ships Books and Arena together
- A second full theme, or a theme picker
- Per-kind palettes (pink Books, purple Anime, green Kids)
- Grid under posters or under Settings copy
- Neon fills behind artwork
- Invented catalog tiles sitting on a house shelf (Night Harbor as if it were on the box)
- Fake percent
- Making Books wait for Arena
- Share Tech Mono on body copy
- A muted gold-only “Light” pass
