#!/bin/bash
# Auto-expand USB persistent partition on first boot and configure volatile RAM logging.
set -euo pipefail

STATE=/var/lib/reelos
mkdir -p "$STATE"

if [ -f "$STATE/usb-expanded" ]; then
  exit 0
fi

# 1. Detect if root/persistence is on a USB device
get_root_disk() {
  local root_dev
  root_dev=$(findmnt -n -o SOURCE / || true)
  if [ -z "$root_dev" ]; then
    echo ""
    return
  fi
  # If overlayfs, find upperdir source device
  if [ "$root_dev" = "overlay" ]; then
    root_dev=$(findmnt -n -o SOURCE /media/writable 2>/dev/null || findmnt -n -o SOURCE /cow 2>/dev/null || findmnt -n -o SOURCE /mnt/persistent 2>/dev/null || true)
  fi
  echo "$root_dev"
}

ROOT_DEV=$(get_root_disk)

if [ -n "$ROOT_DEV" ] && [ -b "$ROOT_DEV" ]; then
  # Find parent disk and partition number
  PART_NUM=$(echo "$ROOT_DEV" | grep -o '[0-9]*$')
  DISK_DEV=$(echo "$ROOT_DEV" | sed -E 's/p?[0-9]+$//')

  if [ -n "$PART_NUM" ] && [ -n "$DISK_DEV" ] && [ -b "$DISK_DEV" ]; then
    echo "ReelOS: Expanding persistent partition $ROOT_DEV on $DISK_DEV..."
    if command -v growpart >/dev/null 2>&1; then
      growpart "$DISK_DEV" "$PART_NUM" || true
    fi
    if command -v resize2fs >/dev/null 2>&1; then
      resize2fs "$ROOT_DEV" || true
    fi
  fi
fi

# 2. Configure volatile RAM journal logging to prevent USB flash wear
mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/reelos-volatile.conf <<'EOF'
[Journal]
Storage=volatile
RuntimeMaxUse=64M
EOF

# Restart journald if running
systemctl kill -s HUP systemd-journald >/dev/null 2>&1 || true

touch "$STATE/usb-expanded"
echo "ReelOS: USB persistent expansion and volatile logging configured."
