# ReelOS

Install. Point. Stream.

An appliance **operating system** on Ubuntu 26.04. You boot a disc. A seven-question wizard stands up a debrid-first media stack. Jellyfin (or Plex) is where you watch. The ReelOS shell is the front door.

This repository is the **source and the OTA channel**. The bootable ISO is not stored here (over GitHub’s 2 GB release cap). Build it with `iso/remaster-iso.sh`.

No API keys. No multi-gig ISOs. Indexers are not seeded.

## Layout

Hal’s names, and where the 1.2 USB updater still looks:

| Brief | Path | What |
|---|---|---|
| ISO bake | `iso/` | xorriso remaster, autoinstall, pack |
| Shell | `ui/` and `src/` | Wizard + daily UI. Root `src/` is what OTA unpacks today |
| First boot | `firstboot/` | systemd units, console card, live Wi-Fi |
| Stack | `compose/` | Jellyfin, Prowlarr, Radarr, Sonarr, Lidarr, Bazarr, Decypharr; Local+VPN profile |
| Daemon | `daemon/` | doctor, update, engine wire, install, debrid lock |
| Disc copy | `install/` | What the ISO drops into `/opt/reelos` |

`channel.json` is the mailbox. The rest of this tree is the mail.

## Channel

- Version: see `VERSION` (1.2 is the last USB; 1.2.1 is OTA)
- Box checks `channel.json` then pulls this repo’s archive
- Stack images (Jellyfin / *arrs) stay frozen unless Settings → Updates toggle is on

## What actually boots (1.2 USB)

1. Join Wi-Fi on the live installer if there is no ethernet. Extra apt packages cannot abort the disc.
2. Reboot → console card → `http://reelos.local`
3. Wizard. Paste a debrid key. Ping is live.
4. Engines talk only to Decypharr on the debrid path. No torrent client there.
5. You add indexers. Discover sample titles are original; search on the box goes through Radarr/Sonarr lookup.

## Build a disc (maintainers)

Needs the Ubuntu 26.04 live-server ISO and xorriso.

```
node scripts/pack-appliance.mjs
bash iso/remaster-iso.sh
```

Do not commit the output ISO.

Default login on a fresh install: `reelos` / `reelos`. Change it.
