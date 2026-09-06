# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 17:03 CDT**. VERSION stays **1.2.15**. No 1.2.16. No ISO. No README. No indexer roster.

1.2.15 freeze is open for **one hole**: Request cannot grab a release. Lookup finds Batman. Prowlarr has zero indexers. Decypharr + TorBox only fetch a hash someone else already found. Fresh start would be a brick.

## Fix

After Prowlarr has an API key, `wire-engines.py` adds **one** release source built from wizard answers:

- source `torbox` / `real-debrid` / `alldebrid` / `premiumize` → Prowlarr indexer that talks to **that provider's official API** using `answers.apiKey`
- Use Prowlarr's first-party implementation for that provider if it exists. Do not scrape random sites. Do not ship names of third-party trackers.
- Enable it. Sync to Radarr/Sonarr (already hooked).
- `local-vpn` path: do not invent a debrid indexer. They still paste or use qBittorrent.

Idempotent. If the indexer named `ReelOS-<provider>` already exists, leave it.

Doctor hop: `releases`. Red = "No release source. Provider indexer missing." Green = Prowlarr has that one indexer enabled.

Connect Indexers paste stays. Skip is now allowed because the provider is the first indexer.

Prove in STATUS with sandbox curls (no keys → honest error). No fake HP curls. No FlareSolverr. No 1.2.16.

Then freeze again. Same apply curl.
