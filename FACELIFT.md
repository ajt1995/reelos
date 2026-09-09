# FACELIFT.md

Parked. Hal. Updated **2026-09-06 19:02 CDT**.

**Not an OTA. Not tonight.** No version until the owner assigns one.

Working name: **1.3 Light**.

This is a **design system**, not a poster of six phones. Issues #2–#4 must be able to land later without a second facelift and without orphan chrome.

## First pass still does not invent features

Paint the rooms that exist in 1.2.15. Do not build Seerr, books, or Lidarr lookup here. Do not touch updater / provision / Prowlarr / TorBox YML.

## System (this is the work)

### Tokens

- Void: charcoal, near-black.
- Light: one gold source. No second accent.
- Type: display serif for titles, quiet sans for body, mono for addresses.
- Motion: 120–180ms ease-out, 4–6px rise, fade+8px pages. Splash breathes once. `prefers-reduced-motion` kills it.
- State pills: word only — queued / grabbing / ready. No fake %.

### Chrome (stable)

Every future room uses the same shell:

- Top: wordmark left, one utility right (Settings).
- Center: one primary action (search, or the thing this page is for).
- Rows: **From this house.** Only real library items. Kind is a label, not a new theme.
- Bottom nav: slots, not a frozen trio. Home / Requests / Connect today. A fourth slot may appear when a kind is on (Music, Books). Empty slots do not exist.
- Connect cards: giant IPv4 + port, QR, same login, name of the **destination app** (Jellyfin, later Kavita, etc.).

### Slots for later tickets

| Later | Reuses |
|---|---|
| #2 Request in Jellyfin | Same pill + same request row. TV is still Connect. Do not skin Seerr gold. |
| #3 Ebooks | New intent chip in the **existing** wizard step. New Connect card. New Home row if Kavita/Calibre has items. Same title page: primary = Open on the phone. |
| #4 Music | Same lookup field, same request pill, Home row if Jellyfin Music has items. |

New kind = one chip + one row + one Connect destination. Not a new palette.

### What would break this

- A second gold. Neon. Per-feature themes.
- Hard-coded three-tab nav that cannot grow.
- Title page that assumes “Watch on the TV” is the only primary.
- Home that maps `catalog.ts` when a kind is empty.

## Screens to paint first (examples, not a ceiling)

1. Splash
2. Wizard source
3. Home empty
4. Home after (one row)
5. Title Ready (primary action named by kind)
6. Connect (destination card)

When this becomes a job: owner names a version. Until then do not open it.

## Landed as 1.2.51 Tron-night (not Light)

Owner asked for glow / neon cyan-magenta on deep black instead of one-gold Light. Tokens, motion, and Books slot shipped on **1.2.51**. Light stays a parked sketch — do not paint a second facelift on top without an owner name.
