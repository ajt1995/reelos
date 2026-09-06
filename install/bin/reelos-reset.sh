#!/bin/bash
# First-run reset. Does not delete /srv/media or Docker images. Does not run during OTA.
set -euo pipefail
if [ "${REELOS_OTA:-}" = "1" ]; then
  echo "reset refused: OTA"
  exit 1
fi
if pgrep -f "reelos-update.sh" >/dev/null 2>&1; then
  echo "reset refused: OTA running"
  exit 1
fi
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
LOG="$STATE/reset.log"
mkdir -p "$STATE"
echo "---- $(date -Is) reset ----" >>"$LOG"
sleep 2
if [ -f "$ROOT/compose/docker-compose.yml" ]; then
  (cd "$ROOT/compose" && docker compose down --remove-orphans) >>"$LOG" 2>&1 || true
fi
rm -f "$STATE/provisioned" "$STATE/answers.json" "$STATE/engine.json"
rm -rf "$ROOT/compose/configs"
mkdir -p "$ROOT/compose/configs"
echo "reset: configs and provisioned removed" >>"$LOG"
systemctl restart reelos >>"$LOG" 2>&1 || true
echo "reset done" >>"$LOG"
