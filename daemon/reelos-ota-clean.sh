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

python3 "$PY" "$@" || true

if [ "$door_or_tmp" = "1" ]; then
  exit 0
fi

if [ -f "$HERE/reelos_os_tune.py" ]; then
  python3 "$HERE/reelos_os_tune.py" --apply || true
elif [ -f "$ROOT/bin/reelos_os_tune.py" ]; then
  python3 "$ROOT/bin/reelos_os_tune.py" --apply || true
fi

WIRE="$HERE/wire-engines.py"
[ -f "$WIRE" ] || WIRE="$ROOT/bin/wire-engines.py"
if [ -f "$WIRE" ]; then
  python3 "$WIRE" ota-clean || true
fi

echo "OTA cleaner done"
