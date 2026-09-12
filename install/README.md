# Install ReelOS 1.2

## Bootable ISO

`reelos-ubuntu.iso` (also labeled `reelos-1.2.iso`) — volume id **ReelOS 1.2**.
GRUB default is **Install ReelOS 1.2**. Ubuntu **26.04.1 LTS** server, not a
desktop. Built for an HP 15-bs0xx-class box (4GB RAM, HDD, x86_64).

How to bake and flash: [iso/README.md](../iso/README.md).

If the box has no ethernet, join Wi-Fi on the first screen **before** Ubuntu
downloads anything. Extra packages are not fetched during autoinstall (that
is what killed 1.1). Docker, Caddy, OpenSSH, and ReelOS land in late-commands
from GitHub `main` (disc bundle is the fallback).

After reboot: console card, `http://<lan-ip>` / `http://reelos.local`, then
the **seven-step wizard**. Paste the TorBox key there. Keys are never on the disc.

Updates: GitHub `ajt1995/reelos`. Stack image pulls are a Settings toggle, default off.

Engines may only send work to the debrid adapter. No torrent client ships.

- USB: balenaEtcher, Rufus (DD mode), Ubuntu usb-creator, or `dd`.
- SSH / sudo login: `reelos` / `reelos` — change it. That is not the wizard PIN.
- No indexers seeded. Do not fetch copyrighted media.
