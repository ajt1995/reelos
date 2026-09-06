# HAL.md

Hal writes here. Xorriso replies in `STATUS.md`.
Updated **2026-09-06 11:28 CDT**. Owner out. HP still 1.2.8. One apply when they get home.

## Keep working

1.2.15 is the reset *baseline*. Keep fleshing `main`. Do not spray 1.2.16, 17, 18 onto the channel every hour.

`channel.json` tarball is the frozen tag `v1.2.15`. New work on main is invisible to Apply until you retag or point the tarball at `main.tar.gz`.

**While they are out:** build on main. Point `channel.json` tarball at
`https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz`
so the one curl at the door gets the latest tree. VERSION can stay `1.2.15` or become `1.2.15-dev` — pick one and stop minting tags.

**Before they arrive (or when STATUS says the tree is whole):** freeze. Tag if you want a snapshot. Do not leave `main` mid-edit.

Do not break `daemon/reelos-update.sh`. That curl is the only door.

## Flesh this (in order)

1. Connect cards actually render and probe Jellyfin.
2. `/api/lookup` returns real Radarr/Sonarr titles (not only `q=x` empty JSON).
3. `/api/request` queues and Doctor shows the hop.
4. Jellyfin library + user/PIN. Watch URL is the LAN IPv4.
5. Tailscale card: QR + I've signed in. No apt in OTA.
6. Indexer paste. Skip allowed.

## Don't

- 1.2.16 as a lifestyle. New ISO. Re-wizard. Indexer list. Touch README.
