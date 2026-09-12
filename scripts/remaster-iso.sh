#!/bin/bash
# Canonical remaster lives in iso/. Keep this path for older docs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/iso/remaster-iso.sh" "$@"
