#!/bin/bash
# ReelOS Plug-and-Play USB Storage Automounter
# Safely mounts FAT32, NTFS, exFAT, and ext4 USB storage under /mnt/usb
set -euo pipefail

mkdir -p /mnt/usb

# Query block devices connected via USB
lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,TRAN,HOTPLUG 2>/dev/null | python3 -c '
import json, sys, subprocess, os, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

devices = data.get("blockdevices", [])
for dev in devices:
    is_usb = dev.get("tran") == "usb" or dev.get("hotplug") in (True, "1", 1)
    if not is_usb:
        continue
    children = dev.get("children", [dev])
    for part in children:
        name = part.get("name")
        mount = part.get("mountpoint")
        fstype = part.get("fstype")
        label = part.get("label") or ""
        if not name or mount or not fstype:
            continue

        clean_label = re.sub(r"[^a-zA-Z0-9_-]", "_", label.strip()).strip("_")[:32]
        dest = f"/mnt/usb/{clean_label}" if clean_label else f"/mnt/usb/usb-{name}"
        os.makedirs(dest, exist_ok=True)

        opts = "noatime,async,nofail,uid=1000,gid=1000" if fstype.lower() in ("vfat", "fat", "ntfs", "exfat") else "noatime,async,nofail"
        dev_node = f"/dev/{name}"
        subprocess.run(["mount", "-o", opts, dev_node, dest], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
' || true
