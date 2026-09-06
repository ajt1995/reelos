#!/bin/bash
# Remaster Ubuntu 26.04 live-server into a bootable ReelOS ISO.
set -euo pipefail
XORRISO="${XORRISO:-/tmp/xorriso-prefix/bin/xorriso}"
SRC="${SRC:-/tmp/iso-build/ubuntu-26.04.1-live-server-amd64.iso}"
OUT="${OUT:-/workspace/public/install/reelos-1.2.iso}"
WORK=/tmp/iso-build/reelos-overlay
ROOT=/workspace

mkdir -p "$WORK/nocloud" /tmp/iso-build/extract
cp "$ROOT/install/autoinstall/user-data" "$WORK/nocloud/user-data"
cp "$ROOT/install/autoinstall/meta-data" "$WORK/nocloud/meta-data"
cp "$ROOT/install/autoinstall/live-wifi.sh" "$WORK/nocloud/live-wifi.sh"
chmod 755 "$WORK/nocloud/live-wifi.sh"

# Bundle (zip pack) already built by pack-appliance.mjs — reuse tarball if present
BUNDLE=/tmp/reelos-pack/cidata/reelos-bundle.tar.gz
if [ ! -f "$BUNDLE" ]; then
  node "$ROOT/scripts/pack-appliance.mjs"
fi
cp "$BUNDLE" "$WORK/nocloud/reelos-bundle.tar.gz"

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
ls -lh "$OUT"
echo "OK $OUT"
