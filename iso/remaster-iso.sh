#!/bin/bash
# Remaster Ubuntu 26.04 LTS live-server into a bootable ReelOS USB/ISO.
# Overlay is nocloud autoinstall + a ReelOS seed. Not a custom desktop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
XORRISO="${XORRISO:-$(command -v xorriso || true)}"
if [ -z "$XORRISO" ] && [ -x /tmp/xorriso-prefix/bin/xorriso ]; then
  XORRISO=/tmp/xorriso-prefix/bin/xorriso
fi
if [ -z "$XORRISO" ]; then
  echo "xorriso is not installed. apt-get install xorriso" >&2
  exit 1
fi
SRC="${SRC:-/tmp/iso-build/ubuntu-26.04.1-live-server-amd64.iso}"
ART="${ART:-/opt/cursor/artifacts}"
mkdir -p "$ART" "$ROOT/public/install" /tmp/iso-build
# Artifacts FUSE caps ~100MiB/file with fsync; GitHub releases cap 2G.
# The 2.8G ISO stays on the build disk.
OUT="${OUT:-/tmp/iso-build/reelos-ubuntu.iso}"
WORK="${WORK:-/tmp/iso-build/reelos-overlay}"

if [ ! -f "$SRC" ]; then
  echo "Ubuntu live-server ISO missing: $SRC" >&2
  echo "Run: bash $ROOT/iso/build-iso.sh" >&2
  exit 1
fi

mkdir -p "$WORK/nocloud" /tmp/iso-build/extract
cp -a "$ROOT/install/autoinstall/." "$WORK/nocloud/"
chmod 755 "$WORK/nocloud/"*.sh 2>/dev/null || true

BUNDLE=/tmp/reelos-pack/cidata/reelos-bundle.tar.gz
if [ ! -f "$BUNDLE" ]; then
  node "$ROOT/scripts/pack-appliance.mjs"
fi
if [ -f "$BUNDLE" ]; then
  cp "$BUNDLE" "$WORK/nocloud/reelos-bundle.tar.gz"
fi

cat > /tmp/iso-build/extract/grub.cfg <<'GRUB'
set timeout=2
set default=0

loadfont unicode

set menu_color_normal=white/black
set menu_color_highlight=black/light-gray

menuentry "Install ReelOS 1.2" {
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

cat > /tmp/iso-build/extract/loopback.cfg <<'GRUB'
menuentry "Install ReelOS 1.2" {
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

rm -f "$OUT"
"$XORRISO" -indev "$SRC" -outdev "$OUT" \
  -boot_image any replay \
  -volid "ReelOS 1.2" \
  -map "$WORK/nocloud" /nocloud \
  -map /tmp/iso-build/extract/grub.cfg /boot/grub/grub.cfg \
  -map /tmp/iso-build/extract/loopback.cfg /boot/grub/loopback.cfg \
  -commit
cp -f "$OUT" "$ROOT/public/install/reelos-1.2.iso"
SUM=$(sha256sum "$OUT" | awk '{print $1}')
SIZE=$(du -h "$OUT" | awk '{print $1}')
{
  echo "ReelOS Ubuntu install ISO"
  echo "path: $OUT"
  echo "also: $ROOT/public/install/reelos-1.2.iso"
  echo "sha256: $SUM"
  echo "size: $SIZE"
  echo "This file is ~2.8G (Ubuntu live-server). Cursor artifacts cap a single"
  echo "file around 100MiB, GitHub release assets cap at 2G, so the ISO is not"
  echo "uploaded. Bake it with: bash iso/build-iso.sh"
  echo "Flash: sudo dd if=$OUT of=/dev/sdX bs=4M status=progress conv=fsync"
} > "$ART/reelos-ubuntu.iso.txt"
sha256sum "$OUT" > "$ART/reelos-ubuntu.iso.sha256"
if [ -f /tmp/reelos-pack/cidata/reelos-bundle.tar.gz ]; then
  cp -f /tmp/reelos-pack/cidata/reelos-bundle.tar.gz "$ART/reelos-bundle.tar.gz" || true
fi
if [ -f "$ROOT/public/install/reelos-cidata.iso" ]; then
  cp -f "$ROOT/public/install/reelos-cidata.iso" "$ART/reelos-cidata.iso" || true
fi
ls -lh "$OUT"
echo "OK $OUT"
echo "sha256 $SUM"
