# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.5** (Discover→Request honesty on shipped 1.2.50.4). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.5 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.5`.
2. Discover search: two random movies + two random TV shows from **2012–2016**. Real Seerr/TMDB hits — not empty shelves, not a silent AbortError, **no Cached glow** on live ids.
3. `POST /api/request` each movie. Each TV show **one season** (Seerr body `seasons: [n]`, never `all`).
4. Requests / title: AVAILABLE / Grabbing / Waiting. Grabbing stays **0%** until files land. No 42%. Discover has no In progress.
5. Unit gate locks Interstellar + The Martian + Brooklyn Nine-Nine S01 + Mr. Robot S02.
6. `GET /api/request?recover=1` still works for empty TV seasons from 1.2.50.4.

Do not Apply the Tron feature tarball as if it were main.
