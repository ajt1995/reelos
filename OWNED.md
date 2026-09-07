# OWNED.md

The product is the house box. Ignore the rest unless HAL names it.

## This is ReelOS

- `daemon/` — update, wire, doctor, repair
- `compose/` — *arr, Jellyfin/Plex, Decypharr, Caddyfile
- `src/components/` wizard, shell, settings, home, requests, connect, doctor UI
- `src/routes/` appliance routes
- `scripts/reelos-lookup-plugin.mjs` — `/api/*` on the box
- `iso/` — image bake (no new ISO unless asked)
- `HAL.md` `STATUS.md` `ROADMAP.md` `FACELIFT.md` `DEV.md`

## This is leftover Grok/TanStack scaffold — do not “improve”

- `__grok/` PWA / preview host
- `src/lib/multiplayer` `og` `app-data` `auth` from the template
- `scripts/grok-pwa-plugin` `preview-host-bridge` `brand-check` `sign-out-plan`
- better-auth / pglite / recharts work unless the appliance page needs it

If a change only makes the preview host happier, it is not a job.
