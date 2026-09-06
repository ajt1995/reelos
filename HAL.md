# HAL.md

Hal writes here. Xorriso replies in `STATUS.md` (create it if missing).
Do not treat channel.json notes as a conversation.
Dated 2026-09-06 ~03:40 CDT. House box: HP laptop, `192.168.1.233`.

## Standing rules

- Product is an appliance. Dummy-proof after Finish. No *arr UI for daily use.
- ReelOS = request. Jellyfin or Plex = watch. Say that out loud.
- Never stamp `VERSION` before `/` stays up and `:8080` answers.
- Never wipe `/var/lib/reelos/answers.json`, TorBox/RD keys, or compose configs.
- Do not bake a new ISO unless the installer itself is dead.
- Do not seed indexer lists. Paste fields only.
- Terminal belongs under Settings → Advanced, LAN/Tailscale only.
- Android does not resolve `.local`. Print IPv4. TVs want `http://<ip>:8096`.
- Do not say "live" if the container is restarting.

## Next product work — Connect aftercare

Not more wizard questions. A short **Connect** flow after Finish, also reachable from Settings.

### Card 0 — Honest status
Probe Jellyfin (and Plex if chosen). Green / amber / red. Red or amber locks the TV card. Copy: "Still starting" or "Can't start" — never "Jellyfin live" on a Restarting (139).

### Card 1 — Watch on the TV
Huge address: `http://<ipv4>:8096` plus QR.
Copy: Install Jellyfin on the TV → Add server → paste this. **Not reelos.local.**
Create the Jellyfin user in ReelOS (name + PIN). Do not dump them into Jellyfin first-run.

**Box work:** publish Jellyfin on `0.0.0.0:8096`, not `127.0.0.1:8096`. Official TV apps will not go through Caddy `/play`.

### Card 2 — Watch on this phone
Same address. Play Store Jellyfin. One sentence: request in ReelOS, watch in Jellyfin.

### Card 3 — Away from home
Buttons: "Only this house" / "Also my phone when I'm out."
If out: install Tailscale on the phone, show QR + login.tailscale.com link the box already writes, button "I've signed in," probe pair. No subnet-router lecture. No Cloudflare on this card.

### Card 4 — Indexers
URL + API key paste. Add another. Skip allowed. Empty + Skip = search still finds titles, Request waits on "no release."

## House-box backlog (do not re-wizard)

1. Finish 1.2.2 apply if it is still in flight. Then `/opt/reelos/VERSION` must match the files.
2. Bind Jellyfin `:8096` to the LAN.
3. Hydrate the UI from `/var/lib/reelos/provisioned` so a new browser is not a second wizard.
4. Strip Chromium kiosk + surprise Tailscale apt from OTA.
5. `/dev/sdb` is still not a library disk — later, not tonight.
6. Search Batman via Radarr must work on the running shell, not only in a lab lookup.

## Do not

- New USB / remaster unless asked.
- Overlay GitHub over a working UI without canary.
- Auto-seed indexers.
- Open a web terminal on :80 with no auth.
