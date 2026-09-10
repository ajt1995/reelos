# STATUS.md

***1.2.50.27 is the ship.*** 2026-09-10. House Apply of **1.2.50.26** swapped the tree, heal-red'd on indexer/import, and **exited before `ensure_door`**. Phone `:80` showed Begin setup; `:8080` hung; Radarr/Sonarr were down. Does not take Tron (#52 / #70).

## Stamp

- **VERSION / channel:** `1.2.50.27`
- **Base:** `main` at 1.2.50.26
- Did **not** take Tron chrome from #52 / #70

## Changelog

### Heal-red must still restore the phone door

`daemon/reelos-update.sh` logged `not printing applied — jellyfin/indexer heal red` and `exit 1` before `ensure_door`. FUSE/engine hops had already bounced Caddy/Vite. Contract: never leave Caddy dead after those restarts. Still do not stamp VERSION on heal/indexer red.

`ensure_door` now starts every compose container (`docker start` is a no-op if already up) and **restarts** hung Vite when `:8080` accepts TCP but is not HTTP 200. `systemctl start` is a no-op on a hung-but-active unit.

## Proof

```
python3 scripts/check-ota.py .
node --test scripts/stack-smoke.test.mjs
python3 daemon/reelos-doctor.py --self-test
```

## Owner / house Apply

1. If `:8080` is hung, restart `reelos` **once** (or reboot). Do not tap Apply twice.
2. Merge this to **main**. Phone **Check → Apply once**.
3. Phone Home is ReelOS (not Begin setup). `cat /opt/reelos/VERSION` is `1.2.50.27` only if hops/import were green; otherwise VERSION stays 1.2.50.22 and the door is still up.

## Do not

- Cut 1.2.51 / Tron #52 / #70 onto this stamp
- Tap Apply twice
- Delete `ota.lock`
- Wipe `/media` or TorBox
