#!/usr/bin/env bash
# Bounded native health recovery. Never starts containers or mutates media.
set -uo pipefail

STATE=/var/lib/reelos
LOG="$STATE/selfheal.log"
mkdir -p "$STATE"
exec 9>"$STATE/selfheal.lock"
flock -n 9 || exit 0

log() { echo "$(date -Is) $*" >>"$LOG" 2>/dev/null || true; }
healthy() {
  curl --silent --fail --max-time 3 http://127.0.0.1:8080/api/health >/dev/null 2>&1
}

if healthy; then exit 0; fi
log "native door unhealthy; restarting reelos.service"
systemctl restart reelos.service >/dev/null 2>&1 || true
sleep 4
if healthy; then
  log "native door recovered"
  exit 0
fi

log "native door remains unavailable after one bounded restart"
exit 1
