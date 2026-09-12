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
mkdir -p "$ART" "$ROOT/public/install"
OUT="${OUT:-$ART/reelos-ubuntu.iso}"
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
ln -sfn "$OUT" "$ROOT/public/install/reelos-1.2.iso" 2>/dev/null || cp -f "$OUT" "$ROOT/public/install/reelos-1.2.iso"
ls -lh "$OUT"
echo "OK $OUT"
