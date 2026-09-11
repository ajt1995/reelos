#!/bin/bash
# Background diagnose + self-heal. Austin should not tap Heal / Hops / Doctor.
# Does not re-enable firstboot. Does not walk FUSE. Does not talk to TorBox.
set -uo pipefail

ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
LOG="$STATE/selfheal.log"

mkdir -p "$STATE"
exec 9>"$STATE/selfheal.lock"
if ! flock -n 9; then
  exit 0
fi

log() {
  echo "$(date -Is) $*" >>"$LOG" 2>/dev/null || true
}

ok() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$1" 2>/dev/null | grep -q 200
}

# Door: Home :8080 and Caddy :80. Restart hung Vite; do not no-op start.
ensure_door() {
  if ! ok http://127.0.0.1:8080/; then
    log "door :8080 not 200 — start reelos"
    systemctl start reelos >/dev/null 2>&1 || true
    sleep 4
  fi
  if ! ok http://127.0.0.1:8080/; then
    log "door :8080 still down — restart hung reelos"
    timeout 20 systemctl restart reelos >/dev/null 2>&1 || true
    if [ -d "$ROOT/app" ]; then
      cd "$ROOT/app" || true
      nohup /usr/bin/env npm run start:box >>"$STATE/reelos.log" 2>&1 &
      echo $! >"$STATE/reelos.pid" || true
    fi
    sleep 6
  fi
  if ! ok http://127.0.0.1/; then
    systemctl start caddy >/dev/null 2>&1 || true
    sleep 2
  fi
}

ffprobe_d_state() {
  ps -eo state,comm 2>/dev/null | awk '$1 ~ /D/ && $2 ~ /ffprobe/ { n++ } END { print n+0 }'
}

# Core stack only. --no-recreate: do not bounce healthy containers.
# Do not pull compose images. Do not walk /mnt or /media.
# Do not compose-up / recover while Sonarr is ffprobe-D on FUSE dumps.
ensure_compose() {
  if [ ! -f "$STATE/provisioned" ]; then
    return 0
  fi
  if [ ! -f "$ROOT/compose/docker-compose.yml" ]; then
    return 0
  fi
  local d
  d=$(ffprobe_d_state)
  if [ "${d:-0}" -gt 0 ]; then
    log "skip compose up — ffprobe D-state $d"
    return 0
  fi
  cd "$ROOT/compose" || return 0
  docker compose up -d --no-recreate >/dev/null 2>&1 || true
}

# Do not systemctl-enable the firstboot unit. Do not delete the OTA lock file.
# not enabling firstboot
# not walking FUSE
# not talking to TorBox

ensure_door
ensure_compose

APP_HEAL=""
if [ -f "$ROOT/app/scripts/reelos-selfheal.mjs" ]; then
  APP_HEAL="$ROOT/app/scripts/reelos-selfheal.mjs"
elif [ -f "/workspace/scripts/reelos-selfheal.mjs" ]; then
  APP_HEAL="/workspace/scripts/reelos-selfheal.mjs"
fi
d=$(ffprobe_d_state)
if [ "${d:-0}" -gt 0 ]; then
  log "skip engines — ffprobe D-state $d (not walking FUSE)"
elif [ -n "$APP_HEAL" ]; then
  node "$APP_HEAL" >>"$LOG" 2>&1 || true
fi
exit 0
