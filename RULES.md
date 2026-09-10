# RULES.md

The project rules for ReelOS. Owner: **Austin**. This file is the single source of governance — it replaces the old persona-based hand-off. When another doc disagrees with this one, this one wins.

## Roles

- **Owner** decides scope and names a version stamp. Only the owner turns "it works" into a shipped VERSION.
- **Agent** (any AI assistant or contributor) implements, tests, and opens PRs. An agent does **not** name a stamp, bump `VERSION`, or Apply to the house on its own.

## Done means a movie plays

A title is requested in ReelOS and it **plays in Jellyfin on the TV** (`:8096`, original quality). Not "looks nicer." Not "a version exists." Not "Home returned 200 once."

## VERSION discipline

- Docs and mailbox files (this file, `STATUS.md`, `ROADMAP.md`, `DEV.md`, `OTA.md`, `FACELIFT.md`) never get a `VERSION` bump.
- Do not cut a patch because a hypothesis changed.
- If Apply / the canary refuses `applied.`, do **not** stamp `VERSION` on the box. A `heal_red` blocks the stamp — that is honest, not a bug to paper over.

## Branches and PRs

- One issue → one `feature/*` (or `cursor/*`) branch → PR.
- Merge to `main` only when the owner approves the stamp. `main` is the house channel; the OTA payload is the git tag / `main.tar.gz`.
- Do not force-push or amend shared history. Do not merge your own PRs.

## OTA / the updater

The updater (`daemon/reelos-update.sh`, a.k.a. the mailman) is the only pipe onto the house box. Treat it like a product, not a debug REPL.

- Keep the updater **frozen across feature PRs**. A feature may *run* compose, but it must not add new canary sentences, new Python, or a new fetch URL in the same stamp.
- **One Apply.** Flock; a second Apply is refused, not queued on a dead Caddy. The owner is not the debugger — never hand them "run these three curls."
- Prefer the GitHub API. The tarball version wins over a stale CDN `channel.json`. Re-exec from the tarball **before** the version compare.
- Stamp last: stage `.next` while `:8080` still serves → FUSE/mounts → Caddy **systemd unit** serving `:80` → `ensure_door` → print `applied.` once → then write `VERSION` / `applied-sha`.
- Canaries: missing **files** abort; copy-string / Doctor sentences only **warn**.
- Doctor green means the **service**, not the file.

## Never

- Never wipe `/media`.
- Never re-add compose `dns: 1.1.1.1` (and do not put `127.0.0.11` in `dns:`).
- Never delete `ota.lock`.
- Never wipe TorBox.
- Never paste private indexer/tracker keys or API keys into the tree. No secrets in git.
- Do not seed an indexer roster, and do not `apt` Tailscale/Chromium inside an OTA.
- Do not chase individual titles. Fix the general behavior; a specific movie or show is an example in a test, never a special case in product code.

## Status and handoff

- `STATUS.md` is the current ship state — what is on the tree and what is on the box. Keep it truthful; an agent updates it but never invents a stamp.
- `DEV.md` is product law (what "done" means). `OTA.md` covers the updater in depth. `ROADMAP.md` is the work queue. `FACELIFT.md` is the parked design system.

## Cutting a disc

Only when the installer itself is dead — point updates are OTA:

```
node iso/pack-appliance.mjs
bash iso/remaster-iso.sh
```

`iso/remaster-iso.sh` shells out to the real `xorriso` ISO tool. Output discs and keys are never committed.
