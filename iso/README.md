# ReelOS Ubuntu install ISO

Clean-disk installer for a spare x86_64 box (HP 15-bs0xx class: **4GB RAM, HDD**).
Not for the live house. Do not re-enable firstboot on a provisioned box.
Do not wipe `/media`. Do not delete `ota.lock`.

The disc is **Ubuntu 26.04.1 LTS** live-server remastered with autoinstall.
It is not a custom desktop image. After Ubuntu is on the disk, late-commands
create user **reelos**, install Docker Compose + Caddy + OpenSSH, extract
ReelOS from GitHub `main` (disc bundle is the fallback), enable **firstboot
once**, and put the door on **:80**. The **7-step wizard still runs**. TorBox
key and admin PIN are typed there. They are never in this image.

## Build (cloud VM or any Ubuntu box with ~8GB free)

```bash
bash iso/build-iso.sh
```

Writes `/opt/cursor/artifacts/reelos-ubuntu.iso` (also `public/install/reelos-1.2.iso`).
The ISO is too big for git. If `xorriso` is missing: `sudo apt-get install xorriso`.

Need only the autoinstall payload (no remaster)? `install/autoinstall/user-data`
plus `seed-reelos.sh` / `late.sh` are the hands-off path Austin can run against
a stock Ubuntu 26.04 live-server USB with `autoinstall ds=nocloud;s=/cdrom/nocloud/`.

## Flash

USB, whole disk, **destroys the stick**:

```bash
# Find the USB (not the house HDD). Example: /dev/sdX
lsblk
sudo dd if=/opt/cursor/artifacts/reelos-ubuntu.iso of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

Or **balenaEtcher** / **Raspberry Pi Imager**: pick `reelos-ubuntu.iso`, pick the USB, flash.
Or Ubuntu **usb-creator-gtk** / **Startup Disk Creator**. Rufus: **DD mode**, not ISO mode.

Plug into the HP, boot from USB (F9 / EFI boot menu). Default GRUB entry is
**Install ReelOS 1.2**. That wipes the **internal disk**. Ethernet is easiest.
No cable: join Wi-Fi on the first screen before Ubuntu continues.

## First boot

1. Autoinstall runs unattended (storage layout `direct` — whole disk). Reboot.
2. tty1 shows the ReelOS card with the LAN IPv4. Daily use is another device.
3. Phone or laptop: `http://<that-ip>` or `http://reelos.local` — splash, then
   **Begin setup**. Seven steps. Do not skip them.
4. Step 2 is the source. **Paste the TorBox API key** and Validate. The ISO
   does not ship a key.
5. Step 6 is the household admin PIN. Pick it there. Not baked.
6. Finish starts compose. Door stays on :80. Request → library after that is
   the current `main` path (no magnet babysitting for named titles).
7. SSH: `ssh reelos@<ip>` — Ubuntu login `reelos` / `reelos`. **Change it.**
   That password is not the wizard PIN.

`reelos-firstboot` is enabled on this fresh disk so a half-finished late-command
can finish `install.sh`. After `install.sh` stamps `stack-installed`, the unit
is a no-op. A later OTA Apply must not re-enable it.

## Smoke in this cloud

```bash
bash iso/smoke-iso.sh
# FULL=1 bash iso/smoke-iso.sh   # QEMU autoinstall, ~2G RAM, several minutes
```

Needs `/dev/kvm` for the boot check. Without KVM the script still validates
the nocloud overlay inside the ISO.
