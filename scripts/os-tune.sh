#!/usr/bin/env bash
# ReelOS Appliance OS Tuner Wrapper
# Applies zram, kdump reduction, and memory optimizations according to hardware profile.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TUNE_PY="${ROOT_DIR}/daemon/reelos_os_tune.py"

if [ ! -f "${TUNE_PY}" ]; then
  echo "Error: reelos_os_tune.py not found at ${TUNE_PY}" >&2
  exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
  else
    echo "Error: python3 is required for OS tuning." >&2
    exit 1
  fi
fi

exec "${PYTHON_CMD}" "${TUNE_PY}" "$@"
