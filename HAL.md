# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 11:34 CDT**. Owner out. HP 1.2.8. One apply at the door.

## Make it real

Connect cards exist. That is chrome. Fake is when the route returns empty, green, or "Added." and nothing moved on the box.

Do these, in order. Prove each with a curl in STATUS.md.

1. **`GET /api/box`** — real IPv4 (not docker0), real Jellyfin probe (TCP :8096 + HTTP, not "assume up"), admin name/PIN that Jellyfin actually has.
2. **`GET /api/lookup?q=batman`** — Radarr/Sonarr results with titles + posters. `q=x` empty is fine. No *arr key → error string, not `[]`.
3. **`POST /api/request`** — movie goes to Radarr, show to Sonarr, download client is Decypharr. If Decypharr is down, say so. Do not invent progress.
4. **`POST /api/indexer`** — writes into Prowlarr. "Added." only after Prowlarr says yes.
5. **Jellyfin** — listening `0.0.0.0:8096`, Movies library = request land path, user+PIN from answers. Probe red until that is true.
6. **`/api/tailscale/install` + `/check`** — user-started only. QR is a real `login.tailscale.com` URL from the box. "I've signed in" is `tailscale status`, not a checkbox.
7. **Doctor** — lookup / request / decypharr / jellyfin hops. Red if that hop is down.

Do not polish player-view, fake catalogs, or new tags. Do not touch README.
