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

# D-state is I/O backpressure (any hardware). Tiny-RAM detect lives in reelos_hardware.py.

load_high() {
  awk '{ exit !($1+0 >= 2) }' /proc/loadavg 2>/dev/null
}

anything_playing() {
  ps -eo args 2>/dev/null | grep -i '[j]ellyfin' | grep -qi ffmpeg
}

idle_load_skip() {
  if anything_playing; then
    return 1
  fi
  if load_high; then
    return 0
  fi
  return 1
}

# Core stack only. --no-recreate: do not bounce healthy containers.
# Do not pull compose images. Do not walk /mnt or /media.
# Do not compose-up / recover while Sonarr is ffprobe-D on FUSE dumps.
# Idle + high load: don't start extra recover/compose/heal (D-state skip stays first).
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
  if idle_load_skip; then
    log "skip compose up — idle load (nothing playing)"
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
# Apply stamps first, then this recover job dumps/heals in the background.
# Persistent reelos-library-catchup.service outlives TimeoutStartSec=90.
# systemd-run / nohup 9>&- is the fallback if the unit is missing.
# Do not walk FUSE dfs. Keep the catch-up request flag while ffprobe is
# D-state, but do not start the oneshot every two minutes (FUSE wedge).
start_library_catchup() {
  log "library catch-up in background"
  if [ -f "$ROOT/bin/reelos_hardware.py" ]; then
    python3 "$ROOT/bin/reelos_hardware.py" --apply >/dev/null 2>&1 || log "hardware profile apply non-fatal"
  fi
  if [ -f "$ROOT/systemd/reelos-library-catchup.service" ]; then
    cp "$ROOT/systemd/reelos-library-catchup.service" /etc/systemd/system/reelos-library-catchup.service 2>/dev/null || true
    chmod 755 "$ROOT/bin/reelos-library-catchup.sh" 2>/dev/null || true
    systemctl daemon-reload >/dev/null 2>&1 || true
  fi
  systemctl reset-failed reelos-library-catchup.service >/dev/null 2>&1 || true
  if systemctl is-active --quiet reelos-library-catchup.service; then
    log "library catch-up already running"
    return 0
  fi
  if systemctl start --no-block reelos-library-catchup.service >/dev/null 2>&1; then
    return 0
  fi
  if [ -x "$ROOT/bin/reelos-library-catchup.sh" ]; then
    if ! systemd-run --quiet --collect --unit=reelos-library-catchup \
      --property=Type=oneshot --property=TimeoutStartSec=3600 --property=KillMode=process \
      /bin/bash "$ROOT/bin/reelos-library-catchup.sh" >/dev/null 2>&1; then
      nohup bash "$ROOT/bin/reelos-library-catchup.sh" >/dev/null 2>&1 9>&- &
    fi
    return 0
  fi
  if [ -x "$ROOT/bin/wire-engines.py" ]; then
    if ! systemd-run --quiet --collect --unit=reelos-library-catchup \
      --property=Type=oneshot --property=TimeoutStartSec=3600 \
      /bin/bash -c 'python3 "$1" import --catch-up >>"$2" 2>&1' \
      bash "$ROOT/bin/wire-engines.py" "$STATE/library.log" >/dev/null 2>&1; then
      nohup python3 "$ROOT/bin/wire-engines.py" import --catch-up >>"$STATE/library.log" 2>&1 9>&- &
    fi
  fi
}

ffprobe_stubbed() {
  docker exec reelos-sonarr-1 head -1 /app/sonarr/bin/ffprobe 2>/dev/null | grep -q '^#!'
}

d=$(ffprobe_d_state)
if [ -f "$STATE/library-catchup" ]; then
  if [ "${d:-0}" -gt 0 ] && ! ffprobe_stubbed; then
    log "library catch-up deferred — ffprobe D-state $d (not piling more)"
  else
    start_library_catchup
  fi
fi
if [ "${d:-0}" -gt 0 ]; then
  log "skip compose up — ffprobe D-state $d"
  log "skip engines — ffprobe D-state $d (not walking FUSE)"
  exit 0
fi
if idle_load_skip; then
  log "skip compose up — idle load (nothing playing)"
  log "skip engines — idle load (nothing playing)"
  exit 0
fi
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
