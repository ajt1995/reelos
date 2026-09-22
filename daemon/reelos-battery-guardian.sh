#!/bin/bash
# ReelOS Battery Guardian
# Enforces charge thresholds on supported laptop firmware and monitors AC/Battery state.
set -euo pipefail

STATE=/var/lib/reelos
mkdir -p "$STATE"
MODE_FILE="$STATE/battery-mode.json"

MODE="balanced"
if [ -f "$MODE_FILE" ]; then
  MODE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("mode") or "balanced")' "$MODE_FILE" 2>/dev/null || echo "balanced")
fi

THRESHOLD=80
case "$MODE" in
  lifespan) THRESHOLD=60 ;;
  full) THRESHOLD=100 ;;
  balanced|conditioning|*) THRESHOLD=80 ;;
esac

# 1. Apply charge threshold to battery if hardware exposed in sysfs
for b in /sys/class/power_supply/BAT*; do
  [ -d "$b" ] || continue
  if [ -w "$b/charge_control_limit_max" ]; then
    echo "$THRESHOLD" > "$b/charge_control_limit_max" 2>/dev/null || true
  elif [ -w "$b/charge_stop_threshold" ]; then
    echo "$THRESHOLD" > "$b/charge_stop_threshold" 2>/dev/null || true
  fi
done

# 2. Check AC power status and adjust power saving
AC_ONLINE=1
for ac in /sys/class/power_supply/AC* /sys/class/power_supply/ACAD*; do
  [ -d "$ac" ] || continue
  if [ -f "$ac/online" ]; then
    AC_ONLINE=$(cat "$ac/online" 2>/dev/null || echo 1)
  fi
done

if [ "$AC_ONLINE" = "0" ]; then
  # Running on battery: aggressive console blanking
  setterm --blank 2 --powerdown 2 2>/dev/null || true
  # Check if battery critically low (<10%)
  for b in /sys/class/power_supply/BAT*; do
    [ -d "$b" ] || continue
    CAP=$(cat "$b/capacity" 2>/dev/null || echo 100)
    if [ "$CAP" -le 10 ]; then
      logger -t reelos-battery "CRITICAL: Battery at ${CAP}%. Preparing safe standby to prevent filesystem corruption."
    fi
  done
else
  # Running on AC mains: standard 15-minute display blanking
  setterm --blank 15 --powerdown 15 2>/dev/null || true
fi
