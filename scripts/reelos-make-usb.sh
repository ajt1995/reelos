#!/bin/bash
# Write a ReelOS autoinstall USB from a Ubuntu LTS live-server ISO you already have.
#
#   ./scripts/reelos-make-usb.sh ubuntu-24.04.x-live-server-amd64.iso /dev/sdX
#
# You download the Ubuntu ISO yourself. This script never fetches one
# (no 6GB wget). It overlays nocloud autoinstall + GRUB, then writes the stick.
#
# Booting the stick installs Ubuntu on the TARGET PC's internal disk, then
# ReelOS (Docker, Caddy, GitHub main tarball, firstboot once, :80 wizard).
# Does not wipe /media on a live house. Does not delete ota.lock.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY=0
YES=0
FORCE=0
STAGE=""
ISO=""
DEV=""

usage() {
  cat <<'EOF'
Write a ReelOS autoinstall USB from a local Ubuntu LTS live-server ISO.

  ./scripts/reelos-make-usb.sh ubuntu-24.04.x-live-server-amd64.iso /dev/sdX

You must download the Ubuntu ISO yourself. This script will not.

Options:
  --dry-run    Stage nocloud + print the write command. Do not touch the device.
  --yes        Skip the "type the device path" confirm (still refuses system disks).
  --force      Allow a non-USB disk that passed the mount checks (rare adapters).
  --stage DIR  Write the nocloud overlay into DIR (tests / inspect).
  --help

Needs: xorriso.  sudo apt-get install xorriso

Destroys the USB stick. Does not wipe /media. Does not delete ota.lock.
Wizard stays seven steps. No secrets on the stick.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --yes|-y) YES=1; shift ;;
    --force) FORCE=1; shift ;;
    --stage)
      [ $# -ge 2 ] || { echo "--stage needs a directory" >&2; exit 2; }
      STAGE="$2"
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    --) shift; break ;;
    -*)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
    *) break ;;
  esac
done

ISO="${1:-}"
DEV="${2:-}"

if [ -z "$ISO" ] || [ -z "$DEV" ]; then
  usage >&2
  exit 2
fi

is_dry() { [ "$DRY" -eq 1 ]; }

if [ ! -f "$ISO" ]; then
  echo "ISO not found: $ISO" >&2
  echo "Download Ubuntu LTS live-server yourself, then pass that file." >&2
  echo "This script will not wget an ISO." >&2
  exit 1
fi

iso_size=$(wc -c <"$ISO" | tr -d ' ')
if [ "${REELOS_TEST:-}" != "1" ] && [ "$iso_size" -lt 10000000 ]; then
  echo "That file is too small to be an Ubuntu live-server ISO ($iso_size bytes): $ISO" >&2
  exit 1
fi

case "$DEV" in
  /dev/loop*|/dev/sd[a-z]|/dev/sd[a-z][a-z]|/dev/vd[a-z]|/dev/hd[a-z]|/dev/nvme[0-9]n[0-9]|/dev/mmcblk[0-9]|/dev/xvd[a-z])
    ;;
  /dev/*[0-9]p[0-9]*|/dev/sd[a-z][0-9]*|/dev/vd[a-z][0-9]*|/dev/mmcblk[0-9]p[0-9]*)
    echo "Pass the whole disk, not a partition: $DEV" >&2
    echo "Example: /dev/sdb   not /dev/sdb1" >&2
    exit 1
    ;;
  *)
    echo "Refusing unusual device path: $DEV" >&2
    echo "Expected something like /dev/sdb or /dev/nvme1n1" >&2
    exit 1
    ;;
esac

device_busy_with_system() {
  local d="$1"
  local mp
  # Whole disk or any partition mounted on /, /boot, /home, or /media.
  # Never wipe /media.
  while IFS= read -r mp; do
    [ -n "$mp" ] || continue
    case "$mp" in
      /|/boot|/boot/*|/home|/home/*|/media|/media/*)
        echo "Refusing $d: a partition is mounted on $mp" >&2
        return 0
        ;;
    esac
  done < <(lsblk -nrpo MOUNTPOINT "$d" 2>/dev/null || true)
  return 1
}

if ! is_dry; then
  if [ ! -b "$DEV" ] && [ ! -e "$DEV" ]; then
    echo "Device not found: $DEV" >&2
    echo "Plug the USB in and run lsblk. Do not pick the house HDD." >&2
    exit 1
  fi
  if device_busy_with_system "$DEV"; then
    echo "Refusing to write $DEV — it looks like a system or /media disk." >&2
    echo "This script does not wipe /media." >&2
    exit 1
  fi
  short="${DEV#/dev/}"
  if [ -f "/sys/block/$short/removable" ]; then
    rem="$(cat "/sys/block/$short/removable" 2>/dev/null || echo 1)"
    if [ "$rem" = "0" ] && [ "$FORCE" -ne 1 ]; then
      echo "$DEV does not look like a removable USB." >&2
      echo "If it really is the stick, re-run with --force. Do not pass the house HDD." >&2
      exit 1
    fi
  fi
fi

if [ "$YES" -ne 1 ] && ! is_dry; then
  echo
  echo "This DESTROYS $DEV (the USB stick) and writes a ReelOS autoinstall image."
  echo "It does not wipe /media. It does not delete ota.lock."
  echo "Booting that stick will wipe the TARGET PC's internal disk."
  echo
  printf "Type %s to continue: " "$DEV"
  read -r confirm
  if [ "$confirm" != "$DEV" ]; then
    echo "Aborted."
    exit 1
  fi
fi

CLEAN_STAGE=0
if [ -z "$STAGE" ]; then
  STAGE="$(mktemp -d /tmp/reelos-usb-XXXXXX)"
  CLEAN_STAGE=1
fi

NOCLOUD="$STAGE/nocloud"
mkdir -p "$NOCLOUD" "$STAGE/grub"

if [ ! -f "$ROOT/autoinstall/user-data" ] || [ ! -f "$ROOT/autoinstall/meta-data" ]; then
  echo "Missing autoinstall/user-data or autoinstall/meta-data in $ROOT" >&2
  exit 1
fi
cp "$ROOT/autoinstall/user-data" "$NOCLOUD/user-data"
cp "$ROOT/autoinstall/meta-data" "$NOCLOUD/meta-data"
if [ -f "$ROOT/autoinstall/live-wifi.sh" ]; then
  cp "$ROOT/autoinstall/live-wifi.sh" "$NOCLOUD/live-wifi.sh"
elif [ -f "$ROOT/install/autoinstall/live-wifi.sh" ]; then
  cp "$ROOT/install/autoinstall/live-wifi.sh" "$NOCLOUD/live-wifi.sh"
fi
cp "$ROOT/scripts/install-reelos.sh" "$NOCLOUD/install-reelos.sh"
chmod 755 "$NOCLOUD/install-reelos.sh" "$NOCLOUD/live-wifi.sh" 2>/dev/null || true

cat >"$STAGE/grub/grub.cfg" <<'GRUB'
set timeout=5
set default=0

loadfont unicode

set menu_color_normal=white/black
set menu_color_highlight=black/light-gray

menuentry "Install ReelOS" {
    set gfxpayload=keep
    linux  /casper/vmlinuz quiet autoinstall ds=nocloud\;s=/cdrom/nocloud/ ---
    initrd /casper/initrd
}
menuentry "Try or Install Ubuntu Server" {
    set gfxpayload=keep
    linux  /casper/vmlinuz  ---
    initrd /casper/initrd
}
grub_platform
if [ "$grub_platform" = "efi" ]; then
menuentry 'Boot from next volume' {
    exit 1
}
menuentry 'UEFI Firmware Settings' {
    fwsetup
}
fi
GRUB

cat >"$STAGE/grub/loopback.cfg" <<'GRUB'
menuentry "Install ReelOS" {
    set gfxpayload=keep
    linux  /casper/vmlinuz iso-scan/filename=${iso_path} quiet autoinstall ds=nocloud\;s=/cdrom/nocloud/ ---
    initrd /casper/initrd
}
menuentry "Try or Install Ubuntu Server" {
    set gfxpayload=keep
    linux  /casper/vmlinuz  iso-scan/filename=${iso_path} ---
    initrd /casper/initrd
}
GRUB

XORRISO="${XORRISO:-$(command -v xorriso || true)}"
CMD=()
if [ -n "$XORRISO" ]; then
  CMD=(
    "$XORRISO" -indev "$ISO" -outdev "$DEV"
    -boot_image any replay
    -volid "ReelOS"
    -map "$NOCLOUD" /nocloud
    -map "$STAGE/grub/grub.cfg" /boot/grub/grub.cfg
    -map "$STAGE/grub/loopback.cfg" /boot/grub/loopback.cfg
    -commit
  )
fi

echo "nocloud staged at $NOCLOUD"
echo "  user-data  meta-data  install-reelos.sh  live-wifi.sh"
echo
if is_dry; then
  echo "dry-run: would write $ISO -> $DEV"
  if [ "${#CMD[@]}" -gt 0 ]; then
    printf 'dry-run:'; printf ' %q' "${CMD[@]}"; echo
  else
    echo "dry-run: xorriso is not installed (sudo apt-get install xorriso)"
  fi
  echo "dry-run: did not wget Ubuntu. did not wipe /media. did not delete ota.lock."
  [ "$CLEAN_STAGE" -eq 1 ] && rm -rf "$STAGE"
  exit 0
fi

if [ -z "$XORRISO" ]; then
  echo "xorriso is not installed." >&2
  echo "  sudo apt-get install xorriso" >&2
  [ "$CLEAN_STAGE" -eq 1 ] && rm -rf "$STAGE"
  exit 1
fi

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Writing the USB needs root:" >&2
  echo "  sudo $0 --yes ${FORCE:+--force }\"$ISO\" \"$DEV\"" >&2
  [ "$CLEAN_STAGE" -eq 1 ] && rm -rf "$STAGE"
  exit 1
fi

echo "Writing $ISO -> $DEV (this takes a few minutes)..."
"$XORRISO" -indev "$ISO" -outdev "$DEV" \
  -boot_image any replay \
  -volid "ReelOS" \
  -map "$NOCLOUD" /nocloud \
  -map "$STAGE/grub/grub.cfg" /boot/grub/grub.cfg \
  -map "$STAGE/grub/loopback.cfg" /boot/grub/loopback.cfg \
  -commit
sync
[ "$CLEAN_STAGE" -eq 1 ] && rm -rf "$STAGE"
echo
echo "USB ready. Plug it into the spare PC, boot from USB (F9 / EFI menu)."
echo "Default GRUB entry installs ReelOS. That wipes the TARGET internal disk."
echo "After reboot: http://reelos.local — seven-step wizard. Paste the TorBox key there."
echo "SSH: reelos / reelos — change it. That is not the wizard PIN."
