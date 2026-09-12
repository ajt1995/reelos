#!/bin/bash
# One-shot: download Ubuntu 26.04.1 LTS live-server, pack ReelOS, remaster.
# Output: /tmp/iso-build/reelos-ubuntu.iso (not committed; too big for artifacts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UBUNTU_VER="${UBUNTU_VER:-26.04.1}"
UBUNTU_ISO_NAME="ubuntu-${UBUNTU_VER}-live-server-amd64.iso"
UBUNTU_URL="${UBUNTU_URL:-https://releases.ubuntu.com/26.04/${UBUNTU_ISO_NAME}}"
WORK="${WORK:-/tmp/iso-build}"
SRC="${SRC:-$WORK/$UBUNTU_ISO_NAME}"
ART="${ART:-/opt/cursor/artifacts}"
OUT="${OUT:-/tmp/iso-build/reelos-ubuntu.iso}"

mkdir -p "$WORK" "$ART"

if ! command -v xorriso >/dev/null 2>&1; then
  echo "Installing xorriso..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xorriso
fi

if [ ! -f "$SRC" ]; then
  echo "Downloading $UBUNTU_URL"
  wget -c -O "$SRC" "$UBUNTU_URL" || wget -c -O "$SRC" "http://releases.ubuntu.com/26.04/${UBUNTU_ISO_NAME}"
fi

echo "Packing ReelOS appliance bundle..."
node "$ROOT/scripts/pack-appliance.mjs"

echo "Remastering $SRC -> $OUT"
SRC="$SRC" OUT="$OUT" ART="$ART" bash "$ROOT/iso/remaster-iso.sh"
echo
echo "Flash that file onto a USB. See iso/README.md"
echo "ISO $OUT"
