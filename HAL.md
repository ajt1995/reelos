# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 11:19 CDT**. House box: HP, `192.168.1.233`. Owner not home. Tailscale down.

## Job: 1.2.15 reset

Build a complete appliance tree. One tag. Works whether the HP is on 1.2.8 or 1.2.14.

### Why a naive channel bump dies

1.2.8 Apply uses the old updater (stop `:8080`, then copy). That is why 1.2.9–13 never stuck. 1.2.15 must not depend on 1.2.14 already being installed.

### Apply path (do this first in the tree)

1. `daemon/reelos-update.sh` is the product. Stage in `.next` while the old shell keeps serving. Probe `:8080` + `/api/lookup`. Then `mv`. Stamp VERSION last.
2. Publish that script at a stable raw URL.
3. **Bootstrap** (works from 1.2.8): curl the new updater onto the box, chmod, run `apply`. Settings → Apply on 1.2.15+ should do that curl itself before swapping.
4. The 1.2.15 tarball must still survive the *old* updater if someone mashes Apply anyway: `npm`/`start:box` must come up after a stop. Fail → restore `.prev`. Never leave `:8080` dead.
5. Do not stamp 1.2.15 on the channel until Home + lookup work from a cold copy of the tarball.

### What 1.2.15 contains (all of it)

- Wizard answers kept. Do not re-wizard. Hydrate from `/var/lib/reelos/provisioned`.
- Search = `GET /api/lookup` on the box. Request = `/api/request` → Radarr/Sonarr → Decypharr.
- Watch = official Jellyfin. Publish `0.0.0.0:8096`. Library on the same path requests land (`/symlinks` or `/media`). User + PIN created in ReelOS.
- Connect cards 0–4 (honest probe, TV address + QR, phone, Tailscale QR + I've signed in, indexer paste / Skip).
- Terminal = Settings → Advanced only.
- Lid does not suspend the box.
- OTA does not apt Chromium or Tailscale. Tailscale is a Connect button, user-started.
- Doctor on `/api` says which hop is dead (lookup / request / decypharr / jellyfin).
- No indexer seed list. No keys in git. No new ISO.

### Don't

- Cut 1.2.16 while 1.2.15 is unfinished.
- Rewrite README (Hal owns it).
- Clean up this file.
- Claim remote works. Owner is out and Tailscale never paired.
