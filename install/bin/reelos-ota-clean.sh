#!/bin/bash
# ReelOS OTA cleaner — leftover nonsense from previous builds.
# Never /media. Never ota.lock. Never firstboot. Never docker restart Sonarr.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="$HERE/reelos_ota_clean.py"
[ -f "$PY" ] || PY="$ROOT/bin/reelos_ota_clean.py"

door_or_tmp=0
for a in "$@"; do
  case "$a" in
    --door|--tmp) door_or_tmp=1 ;;
  esac
done

progress_cleaner() {
  local detail=$1 py=""
  for cand in "$HERE/reelos_apply_progress.py" "$ROOT/bin/reelos_apply_progress.py"; do
    if [ -f "$cand" ]; then py=$cand; break; fi
  done
  [ -z "$py" ] && return 0
  REELOS_STATE="${REELOS_STATE:-/var/lib/reelos}" python3 "$py" --stage cleaner --detail "$detail" >/dev/null 2>&1 || true
}

python3 "$PY" "$@" || true

if [ "$door_or_tmp" = "1" ]; then
  exit 0
fi

progress_cleaner "Cleaning leftover builds"
if [ -f "$HERE/reelos_hardware.py" ]; then
  progress_cleaner "Hardware profile"
  python3 "$HERE/reelos_hardware.py" --ensure || true
elif [ -f "$ROOT/bin/reelos_hardware.py" ]; then
  progress_cleaner "Hardware profile"
  python3 "$ROOT/bin/reelos_hardware.py" --ensure || true
fi

if [ -f "$HERE/reelos_os_tune.py" ]; then
  progress_cleaner "OS tune"
  python3 "$HERE/reelos_os_tune.py" --apply || true
elif [ -f "$ROOT/bin/reelos_os_tune.py" ]; then
  progress_cleaner "OS tune"
  python3 "$ROOT/bin/reelos_os_tune.py" --apply || true
fi

WIRE="$HERE/wire-engines.py"
[ -f "$WIRE" ] || WIRE="$ROOT/bin/wire-engines.py"
if [ -f "$WIRE" ]; then
  progress_cleaner "Ghost Jellyfin ids"
  python3 "$WIRE" ota-clean || true
fi

echo "OTA cleaner done"
