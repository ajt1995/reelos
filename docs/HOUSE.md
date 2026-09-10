# House — robot briefing

**2026-09-10.** Austin is out of the loop. Do the work. Do not ask him to paste.

House: MagicDNS `reelos` / `100.100.154.16`. Channel tarball is `main.tar.gz`. Apply only from **main**.

## Do not

- Edit `HAL.md`
- Delete `/var/lib/reelos/ota.lock` (leftover file is normal; only a **held flock** means Apply is running)
- Wipe `/media`
- Re-add compose `dns: 1.1.1.1`
- Merge Tron `#70` / stamp **1.2.51**
- Tap Apply twice / start a second Apply
- Stamp `VERSION` by hand on the box

## What git already has

| PR | What | State |
| --- | --- | --- |
| [#73](https://github.com/ajt1995/reelos/pull/73) | **1.2.50.21** one poster, hybrid 1080+4K, Settings Fix, faster phone | **merged** (`810c4dd`) |
| [#74](https://github.com/ajt1995/reelos/pull/74) | Arena neon decision (`docs/NEON.md`). Not a stamp. Books unblocked. | open |
| [#75](https://github.com/ajt1995/reelos/pull/75) | **1.2.50.22** Applying bar. Status uses held `ota.lock` flock. | open — **do not Apply yet** |
| [#76](https://github.com/ajt1995/reelos/pull/76) | Cloud Agent `environment.json` for the Vite UI | open |
| [#70](https://github.com/ajt1995/reelos/pull/70) | Tron-night + Books | **hold** |

## What the house actually is (not in VERSION)

CLI Apply of **1.2.50.21** ran **04:36–05:16 UTC** from this cloud VM via Tailscale SSH:

```
curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-update.sh | bash -s apply
```

- New tree is on disk (`/opt/reelos/app` has `SHIPPED_VERSION` **1.2.50.21**).
- Mailman **did not stamp**. `/opt/reelos/VERSION` is still **1.2.50.20**. `applied-sha` is still `1ebccd47` (#72).
- Log: `import/heal red` → `not printing applied — jellyfin/indexer heal red`
- Bug snap: `/var/lib/reelos/bugs/20260910T051609-heal_red_.txt`
- `:80` is ReelOS. Hops were green. Indexer canary passed (`eztv/showrss/tpb/yts`).

### Why heal went red

1. **Jellyfin 401** on Movies/Shows after JF/*arr recreate. Token was not accepted. `wire-engines.py import` → `heal_after_import()` returned false.
2. **Seerr name conflict** (`/seerr` already in use) → `compose up skipped` → leftover `HostConfig.Dns=["1.1.1.1","8.8.8.8"]` still on `reelos-radarr-1`, `reelos-sonarr-1`, `reelos-prowlarr-1`, `decypharr`.
3. **Radarr hybrid recycle PUT 400** in a loop. Noise. Should not fail-close the stamp.

A second Apply of 21 will run the same long library heal and can fail the same way. **Do not Apply again until those three are fixed.**

## Your job (in order)

1. Fix mailman/heal so a provisioned Apply can stamp: JF token after recreate, Seerr name clash so leftover DNS actually recreates, recycle 400 is not fatal.
2. One Apply from **main** only. Success is the log line `ReelOS x.y.z applied.` **and** `cat /opt/reelos/VERSION` matches **and** `:80` is ReelOS. Then Radarr/Sonarr/Prowlarr/Decypharr `HostConfig.Dns` is `[]`.
3. After 21 (or the fix stamp) is honestly applied: phone **Check → Apply once** for **1.2.50.22** (#75). That bar is the UX lie we just hit (CLI Apply is not `reelos-ota.service`).
4. Books ships on current gold chrome. Arena (#74) is later paint. Do not couple Books + Tron.

## Future OTAs

Fixes stay in the tree (one poster, hybrid 1080, DNS leftover check). Mailman still runs `import` + heal on every provisioned Apply — it is not a “already healed Interstellar” checklist. Settings → **Fix** is the named path so Austin does not wait on a 40-minute OTA to merge posters.

## How to talk to the house

```
sudo tailscale --socket=/run/tailscale/tailscaled.sock ssh root@reelos -- '…'
```

Prefer a worker **on the box**. Do not make Austin paste. Do not make him Apply.
