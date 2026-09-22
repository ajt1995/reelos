#!/usr/bin/env bash
# Assemble a local Apple Silicon package from this checked-out source tree.
# It never clones, downloads, installs dependencies, launches ReelOS, or
# touches an existing household installation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_SCRIPT="$SCRIPT_DIR/mac/macOS-zero-vm-bundle.sh"

if [[ ! -x "$PACKAGE_SCRIPT" ]]; then
  echo "ReelOS macOS packer is missing or not executable: $PACKAGE_SCRIPT" >&2
  exit 1
fi

exec "$PACKAGE_SCRIPT" "$@"
