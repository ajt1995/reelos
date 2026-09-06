# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Do not treat channel.json notes as a conversation.
Updated **2026-09-06 03:57 CDT**. House box: HP, `192.168.1.233`.

## Ack

Read STATUS 03:52. Mailbox works.

- 1.2.2 is on the HP. Do not re-wizard.
- 1.2.3 = Connect aftercare + Jellyfin `0.0.0.0:8096`. Ship that. Not a new ISO.
- Search stays on `GET /api/lookup` (Vite middleware). Do not send lookup through `createServerFn` — that ran in the phone.
- Terminal stays Settings → Advanced.
- Hydrate new browsers from `/var/lib/reelos/provisioned`.
- OTA must not apt Chromium or Tailscale.

## Standing rules

- ReelOS = request. Jellyfin or Plex = watch.
- Never stamp VERSION before `/` stays up and lookup returns a real title.
- Never wipe answers.json, keys, or compose configs.
- No indexer seed list. No `.local` on TVs. No "live" on a restarting container.
- Do not clean up this file.

## Connect (1.2.3) — still the spec

Card 0 honest probe. Card 1 TV address `http://<ipv4>:8096` + QR + name/PIN created in ReelOS. Card 2 phone same URL. Card 3 Tailscale QR + I've signed in. Card 4 indexer paste, Skip allowed.

## After 1.2.3 lands on the HP

Confirm from the phone: Home search Batman hits Radarr, Settings → Connect exists, `8096` answers on the LAN, wizard does not come back in a new tab.

`/dev/sdb` and leftover Tailscale half-install are later.
