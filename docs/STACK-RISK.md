# ReelOS stack risk — #45 through #51

**2026-09-09.** Latest `main` is `c3fa807` (`#45`–`#50`, stamp **1.2.49**). `#50` is **already merged** — importPending retry **and** container ENOTCONN / `reelos-mnt-rshared.service`. This PR does **not** re-land `#50`. It overlays house `compose/configs`, retargets stale mailman canaries, adds stack-smoke, and names the stacked Apply **1.2.50**. Did not touch TorBox.

## Verdict

**GO** to merge this integration tip (**1.2.50**), then **house Check→Apply once**. Expect `ReelOS 1.2.50 applied.`

Do **not** merge anything else in this stack. `#50` is already on `main`.

A house Apply of current `main` (`#45`–`#50` / 1.2.49) alone is **GO** but incomplete — misses the configs overlay (nesting after `#49` seed) and this named stamp.

## Ordered merge list

| Order | PR | State at audit | Notes |
|---|---|---|---|
| 1 | [#45](https://github.com/ajt1995/reelos/pull/45) lockfile `npm ci` | **merged** | `package-lock.json` name=`reelos` |
| 2 | [#46](https://github.com/ajt1995/reelos/pull/46) lean cached `/api/library` | **merged** | token TTL + `serveLibrary` |
| 3 | [#47](https://github.com/ajt1995/reelos/pull/47) JF12 auth, unhide, Finish detach | **merged** | hop search 4× retry (still fail-closed then) |
| 4 | [#48](https://github.com/ajt1995/reelos/pull/48) OTA mailman stamp | **merged** | search hop **advisory**; lockfile `SKIP_NPM`; restore `.broken` |
| 5 | [#49](https://github.com/ajt1995/reelos/pull/49) Jellyfin durable seed | **merged** | stamp **1.2.49**; `network.xml` seed |
| 6 | [#50](https://github.com/ajt1995/reelos/pull/50) importPending / FUSE retry | **merged** `c3fa807` | also ENOTCONN-in-container / rslave heal / `reelos-mnt-rshared.service` |
| 7 | this PR [#51](https://github.com/ajt1995/reelos/pull/51) | overlay + smoke + **1.2.50** | **merge this** |

Books / Kavita / env-setup PRs (`#40`, `#42`, `#43`, …) are **out of this stack**. Do not Apply those tarballs.

## Interactions traced

### OTA mailman vs non-blocking Finish

Both touch compose/wire/Vite, but not the same moment.

- Finish (`#47`, kept by `#49`): writes answers/env, seeds `network.xml`, detaches `docker compose up -d` (pulls missing images). Vite stays live. `provisioned` stamped only after `up` succeeds.
- Apply (`#48`): stages `/opt/reelos.next`, optional `npm ci`, swaps app, probes `:8080` 90s, hops, **then** stamps. `docker compose pull` (stack-images flag) is **after** `applied.`, 10 min cap, not inside Vite.

No fight. Do not Finish during Apply (already refused).

### Shelf `/api/library` cache vs JF12 auth vs `handleBox`

`#46` `jellyfinTokens` + `serveLibrary` survived `#47`/`#49`. `AuthenticateByName` sends `Authorization` **and** `X-Emby-Authorization`. Cache key is still user/PIN. `handleLibrary` still uses lean Items (no Overview). `handleBox` gained `provisioning` / `provisionError` (`#47`) and `#49` treats Shows as required unless `intent.tv === false`. Wizard defaults `tv: true`. Doctor red on a movies-only box is only if someone clears `tv` without setting `false`.

### stuck-downloads / importPending vs OTA hop / FUSE

`#50` on `main` (`c3fa807`) changes `decide_queue_action`: `importPending` + readable FUSE → `retry_import` (not `ignore`). House-confirmed: host `ls /mnt/debrid` can succeed while *arr/Jellyfin docker **rslave** binds see `ENOTCONN` (Socket not connected). Heal `docker exec`s those containers, `mount --make-rshared /mnt` before restarts, and persists `reelos-mnt-rshared.service` (install + firstboot + mailman `systemctl enable --now` after swap).

OTA `hop_stack` only checks `/mnt/debrid/__all__` or `version.txt` exist — it does **not** `listdir`. After hops, mailman already runs `wire-engines.py import` (non-fatal, no `REELOS_OTA`). `#50` `wait_fuse_ready(40)` can add up to ~40s on a cold FUSE; stamp is not blocked. UI-only Apply (this PR does not change `docker-compose.yml`) does **not** fail-close on FUSE/Jellyfin red (`#48`).

`kick_imports` does not reset Jellyfin config. Full `wire-engines` during compose-changing Apply still sets `REELOS_OTA=1` (no auth-mismatch wipe).

### `SKIP_NPM` / lockfile vs other PRs

None of `#47`–`#51` touch `package.json` / `package-lock.json`. `#45` lock + `#48` dual-file `cmp` stay coherent. A later package.json-only edit will run `npm ci` (no `npm install` fallback).

### applied-sha vs search hop vs UI-only OTAs

`#47` retried Batman 4× and still set `HOP_FAIL`. `#48` kept the retry and moved red to `SEARCH_HOP_FAIL` (advisory). This stack is UI-only, so a red search **must not** refuse stamp. FUSE/Jellyfin fail-close only when compose **yml** changed.

### restore / `.prev` vs refuse-swap

`#48` refuse-swap (missing `package.json` / failed `npm ci`) deletes `.next` only. `restore` moves live app to `app.broken` then brings `.prev` back. `#49`–`#51` do not touch that path.

### `#49` seed vs mailman `cp -a install/.`

**Clear stacking bug, fixed in this PR.** `#49` adds `install/compose/configs/jellyfin/config/network.xml`. Mailman does `cp -a install/. $NEXT`, so `$NEXT/compose/configs` now exists. The old `cp -a $ROOT/compose/configs $NEXT/compose/configs` then **nests** house data as `configs/configs` (dest-exists `cp` gotcha). Swap does not copy configs back today, so a current Apply would not wipe live Jellyfin — but the next person who copies `$NEXT/compose` wholesale would. Mailman now overlays `configs/.` so house files win and the seed remains only when the house file is missing.

## Integration fixes in this PR (lean)

1. Overlay house `compose/configs/.` onto staging (daemon + install twins). Keep `#50` rshared enable-after-swap.
2. `scripts/stack-smoke.test.mjs` — lockfile gate + JF12 `Authorization` + cache + no `spawnSync` pull + advisory search hop + importPending retry + rshared unit + parts twins.
3. `check-ota.py` / `reelos-update.test.mjs` contracts for the overlay.
4. Retargeted three stale mailman `need()` canaries (`title-view-live.tsx`, `settings-terminal.tsx`, plugin `serveLibrary`) so push-time `check-ota.py` is green.
5. Named stamp **1.2.50** (`VERSION`, `channel.json`, `version-stamp.ts`, `store.ts`, HAL.md, STATUS.md).

## Residual (do not block Apply)

| Item | Why it is OK |
|---|---|
| Post-hop `import` can wait ~40s if FUSE is cold | Non-fatal; Home already 200; stamp still runs on UI-only. |
| `#50` `kick_import` timeout 120s vs `wait_http` 90+90 | `#50`'s own bound. Next lock-clients tick retries. |
| importPending is timer-driven | After Apply, wait up to one `reelos-lock-clients.timer` minute for the first retry. |
| Host FUSE green / container ENOTCONN | `#50` already heals rslave binds + persists `reelos-mnt-rshared.service`. |

## House Apply (after this tip is on main)

1. If `reelos-ota` is stuck `activating`, wait or `reset-failed` after the process is gone.
2. Phone **Check → Apply**. Expect `ReelOS 1.2.50 applied.` Search hop red is OK.
3. `cat /opt/reelos/VERSION` → `1.2.50`. `applied-sha` is this merge. Second Check is up to date.
4. `test -f /opt/reelos/app/package.json` and Home on `:80`.
5. Home/Library still paint from lean `/api/library`. Finish must not wedge `:8080`.
6. Next cached TorBox grab should leave Radarr with `hasFile` without a manual import (`retry import` in stuck log). Host `ls /mnt/debrid` is not enough — *arr containers must also list.

Do not: cut 1.2.51 in the same hour, Apply a feature-branch tarball, wipe TorBox, or Finish during Apply.
