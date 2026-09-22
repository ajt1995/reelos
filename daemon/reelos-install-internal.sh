#!/bin/bash
# ReelOS Internal Drive Migration Engine.
# Safely formats the selected internal disk and migrates ReelOS from USB to internal SSD.
# Strictly requires: --confirm-phrase ERASE
set -euo pipefail

TARGET_DISK="${1:-}"
CONFIRM="${2:-}"
STATE=/var/lib/reelos
mkdir -p "$STATE"

usage() {
  cat <<'EOF'
ReelOS Internal Drive Migration.
Usage:
  sudo /opt/reelos/bin/reelos-install-internal.sh /dev/sdX --confirm-phrase ERASE

Warning:
  This strictly formats the target internal disk.
  Requires --confirm-phrase ERASE to proceed.
EOF
}

if [ -z "$TARGET_DISK" ] || [ "$CONFIRM" != "ERASE" ]; then
  echo "Refusing install: You must provide a target disk and '--confirm-phrase ERASE'." >&2
  exit 1
fi

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Must run as root." >&2
  exit 1
fi

if [ ! -b "$TARGET_DISK" ]; then
  echo "Target is not a valid block device: $TARGET_DISK" >&2
  exit 1
fi

# 1. Safety Check: Verify target is NOT the current running root / USB disk
ROOT_DEV=$(findmnt -n -o SOURCE / || true)
if [ "$ROOT_DEV" = "overlay" ]; then
  ROOT_DEV=$(findmnt -n -o SOURCE /media/writable 2>/dev/null || findmnt -n -o SOURCE /cow 2>/dev/null || findmnt -n -o SOURCE /mnt/persistent 2>/dev/null || true)
fi

if [ -n "$ROOT_DEV" ] && echo "$ROOT_DEV" | grep -q "^$TARGET_DISK"; then
  echo "FATAL: Target disk $TARGET_DISK contains the running ReelOS USB! Refusing to format itself." >&2
  exit 1
fi

echo "ReelOS: Starting intentional internal drive installation on $TARGET_DISK..."
echo "All data on $TARGET_DISK is being erased as explicitly requested."

# Unmount any partitions on target disk
for p in $(lsblk -ln -o NAME "$TARGET_DISK" | tail -n +2); do
  umount -l "/dev/$p" 2>/dev/null || true
done

# 2. Partition target disk (GPT: 512M EFI + ext4 root)
parted -s "$TARGET_DISK" mklabel gpt
parted -s "$TARGET_DISK" mkpart ESP fat32 1MiB 513MiB
parted -s "$TARGET_DISK" set 1 esp on
parted -s "$TARGET_DISK" set 1 boot on
parted -s "$TARGET_DISK" mkpart ReelOS ext4 513MiB 100%

P_EFI="${TARGET_DISK}1"
P_ROOT="${TARGET_DISK}2"
if [ ! -b "$P_EFI" ]; then
  P_EFI="${TARGET_DISK}p1"
  P_ROOT="${TARGET_DISK}p2"
fi

echo "Formatting EFI and root partitions..."
mkfs.vfat -F 32 -n "EFI" "$P_EFI"
mkfs.ext4 -F -L "reelos-root" "$P_ROOT"

# 3. Mount target and copy system files
MNT=/mnt/reelos-target
mkdir -p "$MNT"
mount "$P_ROOT" "$MNT"
mkdir -p "$MNT/boot/efi"
mount "$P_EFI" "$MNT/boot/efi"

echo "Copying system payload to internal SSD..."
# If running live USB with squashfs base:
if [ -d /rofs ]; then
  rsync -aAX --exclude="/mnt/*" --exclude="/media/*" --exclude="/proc/*" --exclude="/sys/*" --exclude="/tmp/*" --exclude="/run/*" --exclude="/dev/*" /rofs/ "$MNT/"
fi

# Sync state, docker, and app configs
mkdir -p "$MNT/var/lib/reelos" "$MNT/opt/reelos"
rsync -aAX /opt/reelos/ "$MNT/opt/reelos/"
rsync -aAX /var/lib/reelos/ "$MNT/var/lib/reelos/"

# 4. Install UEFI bootloader to internal drive
if command -v efibootmgr >/dev/null 2>&1; then
  cp -r /boot/efi/* "$MNT/boot/efi/" 2>/dev/null || true
  # Register EFI entry
  efibootmgr -c -d "$TARGET_DISK" -p 1 -L "ReelOS" -l '\EFI\BOOT\BOOTX64.EFI' 2>/dev/null || true
fi

touch "$STATE/migrated-to-internal"
echo "ReelOS: Migration to internal disk $TARGET_DISK complete!"
echo "Please unplug the USB stick and reboot to run permanently from the internal drive."

umount "$MNT/boot/efi" 2>/dev/null || true
umount "$MNT" 2>/dev/null || true
rmdir "$MNT" 2>/dev/null || true
