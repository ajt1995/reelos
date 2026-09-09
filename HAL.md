# HAL.md

Hal. **2026-09-09.** Named stamp **1.2.50.6** (public TV indexers + Prowlarr→Sonarr sync). Does **not** take 1.2.51 (Tron reserved).

## xorriso — do this

1. Merge this PR onto **main** (separate from Tron #52).
2. House CLI or phone Check→Apply of current `main`. Expect `ReelOS 1.2.50.6 applied.`
3. On `main`, **`channel.json` tarball = `main.tar.gz`**.
4. Hold Tron redesign. Do not wipe TorBox. Do not paste private tracker keys.

## Proof after Apply

1. `cat /opt/reelos/VERSION` → `1.2.50.6`.
2. Prowlarr has **ReelOS-eztv** and/or **ReelOS-showrss** (plus 1337x/TPB if schema exists). **YTS is movies-only** — it will not grab B99.
3. Sonarr indexers include those TV publics (Prowlarr `fullSync`), not only YTS/TorBox.
4. B99 S01 / TWD S01: SeasonSearch runs. If EZTV/ShowRSS have a pack, `dumps.sonarr` or `decypharr` moves. If publics have no Ultra-HD pack, it stays missing — that is catalog, not a symlink bug.
5. Interstellar / John Wick / Expanse already Available stay Available.

Do not Apply the Tron feature tarball as if it were main.
