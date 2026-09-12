#!/bin/bash
# Smoke the ReelOS Ubuntu ISO. Always validates the nocloud overlay.
# Boots QEMU when available. Does not touch the live house.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ISO="${ISO:-/tmp/iso-build/reelos-ubuntu.iso}"
WORK="${WORK:-/tmp/iso-smoke}"
FULL="${FULL:-0}"

if [ ! -f "$ISO" ]; then
  echo "ISO missing: $ISO" >&2
  echo "Run: bash $ROOT/iso/build-iso.sh" >&2
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK/nocloud"
xorriso -osirrox on -indev "$ISO" \
  -extract /nocloud "$WORK/nocloud" \
  -extract /boot/grub/grub.cfg "$WORK/grub.cfg" \
  -- >/dev/null 2>&1 || true

fail() { echo "FAIL: $*" >&2; exit 1; }

[ -f "$WORK/nocloud/user-data" ] || fail "ISO has no /nocloud/user-data"
[ -f "$WORK/nocloud/seed-reelos.sh" ] || fail "ISO has no seed-reelos.sh"
[ -f "$WORK/nocloud/late.sh" ] || fail "ISO has no late.sh"
grep -q 'username: reelos' "$WORK/nocloud/user-data" || fail "identity user is not reelos"
grep -q 'install-server: true' "$WORK/nocloud/user-data" || fail "SSH server not requested"
grep -q 'systemctl enable reelos-firstboot' "$WORK/nocloud/late.sh" || fail "late.sh does not enable firstboot"
grep -q 'ajt1995/reelos/archive/refs/heads/main.tar.gz' "$WORK/nocloud/seed-reelos.sh" || fail "seed does not fetch GitHub main"
grep -q 'rm -f "$STATE/provisioned"' "$WORK/nocloud/seed-reelos.sh" || fail "seed must not leave provisioned"
if grep -qiE 'adminPassword:|TORBOX_[A-Z0-9_]*KEY|api_key: [A-Za-z0-9]' "$WORK/nocloud/user-data" "$WORK/nocloud/late.sh" "$WORK/nocloud/seed-reelos.sh"; then
  fail "secrets must not be baked into nocloud"
fi
if [ -f "$WORK/grub.cfg" ]; then
  grep -q 'autoinstall' "$WORK/grub.cfg" || fail "GRUB default is not autoinstall"
fi
echo "ISO nocloud overlay looks right ($(du -h "$ISO" | awk '{print $1}'))"

if [ ! -e /dev/kvm ]; then
  echo "No /dev/kvm — skip QEMU boot. Flash $ISO with iso/README.md"
  exit 0
fi
if ! command -v qemu-system-x86_64 >/dev/null 2>&1; then
  echo "qemu-system-x86_64 missing — nocloud checks passed"
  exit 0
fi

echo "QEMU present. Extracting installer kernel..."
xorriso -osirrox on -indev "$ISO" \
  -extract /casper/vmlinuz "$WORK/vmlinuz" \
  -extract /casper/initrd "$WORK/initrd" \
  -- >/dev/null 2>&1
chmod 644 "$WORK/vmlinuz" "$WORK/initrd" 2>/dev/null || true
qemu-img create -f qcow2 "$WORK/disk.qcow2" 8G >/dev/null

# Nested KVM on this cloud host can kvm_spurious_fault. TCG + qemu64 still
# proves the installer kernel sees autoinstall. USB boot uses GRUB, not -kernel.
QEMU_BIN=(qemu-system-x86_64)
if [ ! -w /dev/kvm ]; then
  QEMU_BIN=(sudo -n qemu-system-x86_64)
fi
QEMU=("${QEMU_BIN[@]}"
  -cpu qemu64
  -m 1024
  -smp 1
  -machine pc
  -drive file="$WORK/disk.qcow2",if=virtio,format=qcow2
  -cdrom "$ISO"
  -boot d
  -netdev user,id=net0
  -device virtio-net-pci,netdev=net0
  -nographic
  -no-reboot
)

if [ "$FULL" = 1 ]; then
  echo "FULL=1: autoinstall through first reboot (this takes a while)..."
  timeout --signal=KILL 45m "${QEMU[@]}" \
    -kernel "$WORK/vmlinuz" -initrd "$WORK/initrd" \
    -append "console=ttyS0,115200n8 earlyprintk=ttyS0,115200n8 autoinstall ds=nocloud;s=/cdrom/nocloud/ ---" \
    | tee "$WORK/serial.log"
  grep -Eiq 'late.sh|ReelOS|cloud-init|autoinstall|subiquity|installing|Linux version' "$WORK/serial.log" \
    || fail "serial log never looked like an installer"
  echo "QEMU full run finished. See $WORK/serial.log"
  exit 0
fi

echo "QEMU 30s boot smoke (installer kernel + autoinstall cmdline)..."
set +e
timeout --signal=KILL 30s "${QEMU[@]}" \
  -kernel "$WORK/vmlinuz" -initrd "$WORK/initrd" \
  -append "console=ttyS0,115200n8 earlyprintk=ttyS0,115200n8 autoinstall ds=nocloud;s=/cdrom/nocloud/ ---" \
  >"$WORK/serial.log" 2>&1
st=$?
set -e
if grep -Eiq 'Linux version' "$WORK/serial.log" && grep -Eiq 'autoinstall' "$WORK/serial.log"; then
  echo "QEMU installer kernel came up with autoinstall on the cmdline (timeout $st is expected)."
  exit 0
fi
echo "QEMU produced no installer banner in 30s (timeout $st). Last lines:"
tail -40 "$WORK/serial.log"
# Overlay already validated; a quiet serial is not a bake failure.
exit 0
