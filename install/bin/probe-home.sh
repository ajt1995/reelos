#!/bin/bash
# ReelOS Home Probe & Watchdog Auto-Restart
# Probes :8080/api/ready. On 3 consecutive failures, auto-restarts ReelOS.
set -uo pipefail

ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
FAILS_FILE="$STATE/probe-home.fails"
LOG_FILE="$STATE/watchdog.log"
ENDPOINT="${PROBE_URL:-http://127.0.0.1:8080/api/ready}"

mkdir -p "$STATE"

ok() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null | grep -q '^200$'
}

if ok "$ENDPOINT"; then
  rm -f "$FAILS_FILE" 2>/dev/null || true
  exit 0
fi

# Failure occurred — increment counter
FAILS=0
if [ -f "$FAILS_FILE" ]; then
  FAILS=$(cat "$FAILS_FILE" 2>/dev/null || echo 0)
fi
FAILS=$(( ${FAILS:-0} + 1 ))
echo "$FAILS" > "$FAILS_FILE" 2>/dev/null || true

if [ "$FAILS" -ge 3 ]; then
  echo "$(date -Is 2>/dev/null || date) [watchdog] probe-home 3x fail ($ENDPOINT down) — restarting reelos" >> "$LOG_FILE" 2>/dev/null || true
  rm -f "$FAILS_FILE" 2>/dev/null || true

  if command -v systemctl >/dev/null 2>&1; then
    timeout 20 systemctl restart reelos >/dev/null 2>&1 || true
    sleep 3
  fi

  if ! ok "$ENDPOINT" && [ -d "$ROOT/app" ]; then
    echo "$(date -Is 2>/dev/null || date) [watchdog] fallback process restart" >> "$LOG_FILE" 2>/dev/null || true
    cd "$ROOT/app" || true
    nohup /usr/bin/env npm run start:box >> "$STATE/reelos.log" 2>&1 &
    echo $! > "$STATE/reelos.pid" 2>/dev/null || true
  fi
fi

exit 1
