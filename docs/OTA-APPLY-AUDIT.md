# ReelOS Apply / OTA audit

**House stamp for this tree is 1.2.50** (PR #51, stacked `#45`–`#50` + configs overlay). `#49`/`#50` on `main` are 1.2.49 (`c3fa807`). Mailman notes below still apply. Expect `ReelOS 1.2.50 applied.`

**2026-09-09.** Code-verified against `daemon/reelos-update.sh`, `scripts/reelos-lookup-plugin.mjs` (`/api/update/*`), `scripts/check-ota.py`, `install/systemd/reelos.service`. Rebased onto main after **#46** (lean cached `/api/library`) and **#47** (JF12 auth, Finish no longer `spawnSync` pull inside Vite; search hop 4× retry). Mailman repair shipped as #48 without a VERSION bump.

Verdict: **Apply is not trustworthy on current main without this PR.** Staging + swap can land a new tree on disk, then fail-closed hops / a short home probe / lockfile `npm ci` refuse to stamp `applied-sha`. Phone Check then keeps offering the same update. A hung oneshot (`TimeoutStartSec=infinity`) can leave `:8080` 502 until someone SIGKILLs `reelos-ota`.

This PR documents the path and lands only the foot-guns that are clear in code.

## Step-by-step Apply flow

Phone Settings → Updates → Check → Apply, or SSH `reelos-update.sh apply`. Same mailman.

1. **Check (`GET /api/update/check`)** — Vite plugin (`handleUpdateCheck`) and the mailman `check` mode both treat an update as available when `channel.json` version > local `VERSION` **or** GitHub `main` SHA ≠ `/var/lib/reelos/applied-sha`. Empty `applied-sha` is always drift. Notes become `Code update on <version> (<sha12>)` for SHA-only drift.
2. **Apply (`POST /api/update/apply`)** — Refuses if `reelos-ota` is `active`/`activating` (`Update already running`). Downloads **`main`'s** `daemon/reelos-update.sh` (GitHub API, then raw), writes `/var/lib/reelos/update-apply.sh`, writes a oneshot `reelos-ota.service` (`REELOS_OTA_UNIT=1`, `TimeoutStartSec=infinity`, `KillMode=mixed`), `systemctl start --no-block reelos-ota`. Returns `{ok:true}` after ~2s if the unit is not already `failed`.
3. **Detached mailman** — If Apply was a child of `reelos.service` (phone), the script copies itself to `update-apply.sh` and re-enters via that unit so `systemctl stop reelos` does not kill the updater. SSH Apply skips this (not in the reelos cgroup).
4. **Flock** `/var/lib/reelos/ota.lock`. Second Apply is refused, not queued. Do **not** delete the lock file (that splits the inode and allows dual Apply). A dead holder already releases flock when its fd closes.
5. **Channel + tarball** — `fetch_channel` prefers GitHub API `channel.json` (raw CDN is stale). Tarball URL today is `…/archive/refs/heads/main.tar.gz`, not a version tag. `HEAD_SHA` is `commits/main` at start. If channel version is not newer but SHA drifted, Apply still continues.
6. **Mailman re-exec** — If the tarball's `daemon/reelos-update.sh` differs, `exec` it with `REELOS_OTA_REEXEC=1` (keeps the extracted tree; no second download). Version compare happens after that. Tarball `VERSION` wins if newer than a stale channel.
7. **Static canaries + `check-ota.py --apply`** — Missing files abort. Copy-string misses warn on the box. Pinned Cloudflare `extra_hosts` aborts.
8. **Stage `/opt/reelos.next`** while `:8080` still serves. Copies `package.json` + lockfile + `src/` + `server/` + `scripts/` + daemon → `bin/` + compose/Caddy. House configs/`.env` overlay onto staging (`configs/.`) so a seeded `install/compose/configs/jellyfin` tree cannot nest house data as `configs/configs`.
9. **`SKIP_NPM`** — Reuses live `node_modules` only when **both** `package.json` and `package-lock.json` match (this PR). Otherwise `npm ci` in the staging tree. Lockfile present → no `npm install` fallback. Failure deletes `.next` only; live `/opt/reelos/app` is not touched.
10. **Prepare `.prev`** — Drops the previous backup, copies `VERSION` + compose yml. Does not snapshot `app` yet.
11. **Park Caddy** on “ReelOS is updating…” (`admin off`, so later reload is a no-op — restart is required). Install `reelos.service` + `daemon-reload` **before** stop.
12. **Swap** — `stop reelos` → `mv /opt/reelos/app /opt/reelos.prev/app` → `mv /opt/reelos.next/app /opt/reelos/app` → copy bin/systemd/compose. `trap restore ERR` is armed just before this. Window with no live app: seconds, unless killed mid-`mv`.
13. **`start_shell`** — `systemctl start reelos` (`npm run start:box` = Vite on `:8080`). Fallback: nohup the same command if dbus is down.
14. **`probe_home`** — HTTP 200 on `127.0.0.1:8080/` (this PR: 90s, nudge unit every 5s). Failure → `restore` from `.prev` and exit 1. Success **does not stamp yet**.
15. **Door `:80`** — Restore ReelOS Caddyfile, restart (not reload), probe. `:80` down is logged; Home-up does **not** roll back for a dead door alone.
16. **FUSE nudge** — Lazy-unmount stale `/mnt/debrid`, `mkdir`, `make-rshared`. Does not bind-mount `/mnt` over a live Decypharr FUSE.
17. **Compose** — If `/var/lib/reelos/provisioned` and compose yml changed vs **pre-swap** `$ROOT.prev/docker-compose.yml`: `docker compose up -d` (profiles), remount FUSE, then `wire-engines`. Comparing the tarball to already-swapped `$ROOT/compose` always skipped up. Unchanged pre-swap yml skips up + indexer test.
18. **`hop_stack`** (provisioned boxes) — FUSE (`/mnt/debrid/__all__` or `version.txt`), Jellyfin `:8096/System/Info/Public` (20s), search `GET /api/lookup?q=Batman` (this PR: 20s/try; **#47** 4× retry + 5s sleep kept). Search is **advisory**. FUSE/Jellyfin fail-close **only** when compose changed. Then `wire-engines import` (non-fatal).
19. **Indexer canary** — Only if compose changed. Prowlarr `indexer/test`. Fail → no stamp.
20. **`ensure_door`** — Home + `:80` again. Fail → no stamp (`phone would see connection refused`).
21. **Stamp last** — `$ROOT/VERSION`, `/var/lib/reelos/installed-version`, `/var/lib/reelos/applied-sha` ← `HEAD_SHA`, log `ReelOS $REMOTE applied.`
22. **Optional image pull** — If `/var/lib/reelos/stack-images` exists (Settings toggle), `timeout 600 docker compose pull` **after** stamp (this PR).

Phone `/api/update/status` polls `systemctl is-active reelos-ota` + last `ota.log` lines + local `VERSION`. Success UI: `local === target && !running`. If the unit exits without a VERSION bump, UI errors “Apply ended. Version did not change.” after ~24 quiet polls.

Daily timer (`reelos-autoupdate.service`) runs `/opt/reelos/bin/reelos-update.sh apply` — the copy OTA installs from `daemon/`.

## Failure modes (house history, verified in code)

| # | What happened | Code verdict | Severity | Works when | Broken when |
|---|---|---|---|---|---|
| 1 | Apply of #44: `package.json` test-script-only change forced `npm ci` against a stale lockfile (`name: app-builder-workspace`, missing `ajv`/`fast-uri`). `applied-sha` stayed old. #45 regenerated the lock. | **Confirmed.** `SKIP_NPM` used to compare **only** `package.json`. Any package.json byte change runs `npm ci` in `.next` against whatever lockfile the tarball shipped. `npm ci \|\| npm install` then hid lock drift (install could “succeed” with a different tree). Staging is correct (live tree not swapped on npm fail). Check keeps offering because stamp never runs. | **High** — blocks Apply of any one-line `package.json` edit until lock is coherent. | Lockfile name=`reelos`, `npm ci` clean, or `package.json` **and** lockfile unchanged (`SKIP_NPM`). | Lockfile name/workspace drift, missing `fast-uri` / `require-from-string`, or package.json edit without a matching lock. |
| 2 | Failed Apply left `/opt/reelos/app` half-wiped (`package.json` missing); restore from `/opt/reelos.prev`; `reelos-ota` stuck activating; UI 502 until SIGKILL. | **Plausible / partial.** `npm ci` itself does **not** wipe live app (runs on `.next`, then `rm -rf .next`). Half-wipe windows: (a) `cp package.json … \|\| true` used to swallow a missing copy, then swap a tree without `package.json`; (b) `mv app → .prev/app` then kill before `mv .next/app → app`; (c) `restore` did `rm -rf $ROOT/app` **before** `mv .prev/app`; (d) oneshot `TimeoutStartSec=infinity` + unbounded `docker compose pull` → unit stays `activating`, Vite dead, plugin Apply returns 409. | **Critical** if it hits — box 502, mailman stuck. | Swap + probe succeed; or `restore` completes. | Killed mid-`mv`; silent incomplete stage; restore `rm` then crash; hung oneshot after stop reelos. |
| 3 | Probe “home never returned” → rollback even when npm/Vite were going to be OK under load. | **Confirmed.** Old probe: 45 × (curl 3s + `start_shell` + 1s). Connection-refused fails fast → **~45s** total. Vite `start:box` after `npm ci` on a loaded disk often exceeds that. Each miss called `systemctl start reelos` (restart storm). Rollback is correct if Home never binds; 45s is too short. | **High** — false rollback of a good stage. | Vite binds `:8080` in < probe budget. | Cold start / I/O from compose or `npm ci` > 45s. |
| 4 | `hop_stack` fail-closed: search `GET /api/lookup?q=Batman` (45s); Seerr/Vite `AbortError` → “not printing applied” even when the tree is already the new SHA. Check keeps offering. | **Confirmed.** Swap + `probe_home` 200 already happened. `handleLookup` uses `seerrFetch(..., ms: 30000)` and returns `{titles:[], error}` when Seerr has **no API key** (common before Finish). Hop required `titles`. Fail → `not printing applied`, **no** `applied-sha`. Check = SHA drift forever. This is the inverse lie: tree is new, product says “update available.” | **Critical** for UI-only OTAs (almost every stamp). | Seerr up, key present, lookup < timeout, titles nonempty. | No Seerr key; Seerr/TMDB slow; Vite Abort under load; empty titles. |
| 5 | Finish/provision `docker compose pull` inside Vite wedges `:8080`. | **Was confirmed; #47 shipped a fix on main.** Finish no longer `spawnSync` pull in the Vite request — `up -d` is backgrounded. OTA pull was in `reelos-ota.service` (separate cgroup) **but** ran *before* hops with **no timeout**, so I/O could still make lookup/home look dead and keep the oneshot `activating`. This PR still moves OTA pull after stamp. | **Medium** for OTA before this PR; Finish wedge is #47. | Finish: #47 on the box. OTA: `stack-images` flag absent (default). | OTA with “Also pull Jellyfin / engine images” toggled on an old mailman. |
| 6 | `SKIP_NPM` when `package.json` unchanged hides lockfile drift until a later one-line package.json edit forces broken `npm ci`. | **Confirmed.** Exact inverse of #1. Lock-only PRs (#45-shaped) never ran `npm ci` on the box. Next package.json tweak exploded. | **High** — silent drift until the next Apply that touches package.json. | This PR’s lockfile `cmp`. | Old mailman on a box that has not yet Apply’d this tip. |

## Other foot-guns (in scope, not in the house list)

- **Stamp is last, on purpose.** `VERSION` / `applied-sha` are written only after hops/door. A live new tree with an old SHA is an uncommitted Apply. Check cannot see “tree is HEAD.”
- **Tarball is `main.tar.gz`.** Channel version is a label. SHA drift is the real “is there code to apply?” signal (`OTA.md` #27).
- **`HEAD_SHA` is fetched at start**, not from the tarball commit. A race if `main` moves during download is possible; not fixed here (need tarball SHA).
- **Phone Apply always fetches mailman from `main`.** House does not get these fixes until this PR is on `main`. Then the next Check→Apply downloads the new mailman *before* the tarball.
- **`reelos.service` `TimeoutStartSec=90`** is Type=simple (process start, not port bind). Not the 45s probe bug.
- **Caddy `admin off`** → `reload` is a no-op. Mailman already restarts. Stock Caddy “works” page is detected and replaced.
- **`install/bin/reelos-update.sh` must stay byte-identical to `daemon/`** (appliance pack + first boot). `check-ota.py` now enforces that.

## What this PR changes (lean)

1. **Lockfile-gated `SKIP_NPM`.** `package.json` **or** `package-lock.json` drift → `npm ci`. No `npm install` fallback when a lockfile exists.
2. **Refuse to swap a tree without `package.json` + lockfile.** Failed `npm ci` still only deletes `.next`.
3. **`restore` moves `$ROOT/app` to `$ROOT/app.broken` before bringing `.prev` back.** Does not `rm -rf` live app first.
4. **Search hop is advisory.** Log + bug snap; still stamp if Home + door passed. FUSE/Jellyfin fail-close only when compose yml changed (stack actually moved). Indexer canary unchanged (compose-only).
5. **Home probe 90s**, `start_shell` every 5s (plus first tick). Search hop timeout 20s (was 45) so a red search cannot sit on the oneshot as long.
6. **`docker compose pull` after `applied.`**, `timeout 600`. Does not un-stamp. Still not inside Vite.

Not changed in the mailman PR: TorBox, Caddy unit design, flock, channel fetch URL. Finish provision pull-in-Vite is **#47 on main** (kept). Stamp **1.2.50** is this integration PR (#51). `#50` is already on `main`.

## Trustworthiness after this PR

| Path | Trust |
|---|---|
| UI-only Apply (compose unchanged), lockfile in sync or `npm ci` clean, Home binds in 90s | **Should stamp.** Search/Seerr red no longer un-applies. |
| package.json-only or lockfile-only change | **`npm ci` runs.** Fails closed without swap if lock is still broken (CI `package-lock.test.mjs` is the gate before merge). |
| Compose-changing Apply with FUSE or Jellyfin red | **Still no stamp** (correct: stack moved and is down). Check will offer again. |
| Compose-changing Apply with indexer canary red | **Still no stamp.** |
| Home never 200 in 90s | **Rollback `.prev`.** |
| Door `:80` dead after Home 200 | **No stamp** (`ensure_door`). Tree is new; Check still offers. Remaining gap — fix Caddy, re-Apply. |
| Finish wizard pull | **#47 on main** backgrounds `up -d`; no longer `spawnSync` pull in Vite. |

Correct product: `applied-sha` means “this tree is on disk and Home/door served,” not “Seerr found Batman.” Stamping when search is red is not a lie. Refusing to stamp after a live swap **is**.

## House verification after merge

Do this on the HP. Do not stamp VERSION by hand.

1. Merge this tip to **main**. Phone Apply fetches mailman from `main` first — this PR must be on `main` before the house run.
2. If `reelos-ota` is `activating` from an older Apply: wait it out or `systemctl reset-failed reelos-ota` after you confirm no `update-apply.sh` process. Do not start a second Apply on a dead Caddy.
3. Settings → Updates → **Check**. Expect available: channel **1.2.50** > local, or SHA drift.
4. **Apply.** Watch `/var/lib/reelos/ota.log` (or the phone step log).
   - `package.json or package-lock.json changed — running npm ci` **or** `package.json unchanged — reused node_modules`.
   - `npm ci failed` must **not** appear. If it does, live `/opt/reelos/app/package.json` must still exist.
   - `home 200` then hops. `hop search red — not blocking UI-only stamp` is OK.
   - Must print `ReelOS 1.2.50 applied.`
5. Proof files:
   - `cat /opt/reelos/VERSION` → `1.2.50`
   - `cat /var/lib/reelos/applied-sha` → this merge commit (or current `main`)
   - `test -f /opt/reelos/app/package.json && test -d /opt/reelos/app/node_modules`
6. Phone **Check** again → **up to date** (not another Apply).
7. Phone Home loads on `:80`. Search “Batman” once (Seerr health — independent of stamp).
8. If “Also pull Jellyfin / engine images” is on: pull happens **after** `applied.` and the oneshot may stay `activating` up to 10 minutes. Home must stay up during that pull.
9. Negative (optional): `systemctl is-active reelos-ota` is `inactive` after Apply, not stuck `activating`.

Do not: Apply a feature-branch tarball, or run Finish/provision during Apply. Stamp is **1.2.50** (HAL.md).
