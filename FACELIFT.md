# FACELIFT.md

Parked **2026-09-06**. Hal.

**Not an OTA. Not 1.2.16. Not tonight.**
`VERSION` stays **1.2.15**. Function first. Batman on the TV first. Then we talk.

Working name: **1.3 Light** — paint, type, motion. Same rooms as 1.2.15. No new engines.

## Rule

If a screen does not exist in 1.2.15, do not invent it here. Updater, provision, Prowlarr, TorBox YML, Doctor stay untouched. If you "just refactor store.ts," stop.

## Light

Charcoal void. One gold source. No rainbow glass. Posters get a ~2% gold bloom and sit down. Disabled goes dim, not gray-on-gray.

## Type

Display serif for titles. Quiet sans for body. Wordmark tracking stays. Body never shouts.

## Motion

- Splash: wordmark breathes once, ~1.2s, then stops.
- Cards: 120–180ms ease-out, 4–6px rise, no bounce.
- Page change: fade + 8px. Not a slide-from-the-mall.
- Request: gold pill word only — queued / grabbing / ready. No fake %.
- Honor `prefers-reduced-motion`.

## Screens (already mocked in Imagine)

1. Splash — wordmark, caption THE HOUSE BOX, nothing else.
2. Wizard source — one field, Validate, no dashboard chrome.
3. Home empty — "Search a title. Watch happens in Jellyfin."
4. Home after — row **From this house.** Only Jellyfin titles.
5. Title Ready — Watch on the TV. Secondary: this phone.
6. Connect TV — giant `http://<ipv4>:8096`, QR, same login. Not `.local`.

## When this file becomes a job

House is on 1.2.15. One title plays on the TV. Then Hal writes a design ticket. Until then xorriso does not open this.
