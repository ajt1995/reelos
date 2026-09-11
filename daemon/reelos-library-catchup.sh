#!/bin/bash
# Background library worker. Never blocks Apply stamp. Never remounts live FUSE.
# Own progress file + library.log so the phone is not frozen on a quiet ota.log.
set -uo pipefail

ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
LOG="$STATE/library.log"
PROGRESS="$STATE/library-progress.json"
LOCK="$STATE/library-catchup.lock"

mkdir -p "$STATE"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) library catch-up already running — not stacking" >>"$LOG" 2>/dev/null || true
  exit 0
fi

log() {
  echo "$(date -Is) $*" >>"$LOG" 2>/dev/null || true
}

ffprobe_d_state() {
  ps -eo state,comm 2>/dev/null | awk '$1 ~ /D/ && $2 ~ /ffprobe/ { n++ } END { print n+0 }'
}

# FUSE/ffprobe D-state is I/O backpressure, not "we're a Pi".
d_limit() {
  local hw="$ROOT/bin/reelos_hardware.py"
  if [ -f "$hw" ]; then
    python3 "$hw" --d-backoff 2>/dev/null && return 0
  fi
  echo 1
}

write_progress() {
  local status="$1" message="$2" splash="${3:-false}" needs="${4:-false}"
  python3 - "$PROGRESS" "$status" "$message" "$splash" "$needs" <<'PY'
import json, sys, time
path, status, message, splash, needs = sys.argv[1:6]
prev = {}
try:
    prev = json.loads(open(path).read())
except Exception:
    prev = {}
prev.update({
    "status": status,
    "message": message,
    "splashLock": splash == "true",
    "needsImport": needs == "true",
    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
})
open(path, "w").write(json.dumps(prev) + "\n")
PY
}

# Do not stack FUSE. Do not walk /mnt/debrid/__all__. Never /media.
fuse_listed() {
  if [ -f /proc/self/mountinfo ] && grep -q ' /mnt/debrid .*fuse.decypharr' /proc/self/mountinfo 2>/dev/null; then
    return 0
  fi
  mount 2>/dev/null | grep -q ' on /mnt/debrid type fuse.decypharr'
}

ffprobe_stubbed() {
  docker exec reelos-sonarr-1 head -1 /app/sonarr/bin/ffprobe 2>/dev/null | grep -q '^#!'
}

log "library catch-up in background"
if fuse_listed; then
  log "fuse listed — do not remount if listed"
fi

limit=$(d_limit)
d=$(ffprobe_d_state)
if [ "${d:-0}" -ge "$limit" ] && ! ffprobe_stubbed; then
  log "import catch-up idle — ffprobe D-state $d (not piling more)"
  write_progress idle "" false false
  # Keep the request flag so the 2min selfheal timer retries when D-state cools.
  exit 0
fi
if [ "${d:-0}" -ge "$limit" ]; then
  log "import catch-up — ffprobe stubbed, skip-existing dumps (D-state $d)"
fi

write_progress running "Library catching up" false false

WIRE="$ROOT/bin/wire-engines.py"
if [ ! -x "$WIRE" ]; then
  log "wire-engines.py missing — catch-up skip"
  write_progress done "Library catch-up skipped" false false
  rm -f "$STATE/library-catchup"
  exit 0
fi

# no-ffprobe is a config write (prevent storm). Never wait on dumps here.
python3 "$ROOT/bin/wire-engines.py" no-ffprobe >>"$LOG" 2>&1 || log "no-ffprobe non-fatal"
# Indexers/heal after stamp — never un-stamp a UI swap.
if ! python3 "$ROOT/bin/wire-engines.py" indexers >>"$LOG" 2>&1; then
  log "indexers heal red — not un-stamping UI swap"
fi
# Import --catch-up: skip already-imported folders, 20s list timeout, no hybrid 1080,
# no RescanSeries-all, no FUSE dfs. Progress JSON is the phone clock.
python3 "$ROOT/bin/wire-engines.py" import --catch-up >>"$LOG" 2>&1 || log "import catch-up non-fatal"

rm -f "$STATE/library-catchup"
# Python wrote folder N / skips / timeouts. Never restore a stale backoff splash.
python3 - "$PROGRESS" <<'PY'
import json, sys, time
path = sys.argv[1]
prev = {}
try:
    prev = json.loads(open(path).read())
except Exception:
    prev = {}
prev["status"] = "done"
prev["splashLock"] = False
prev["needsImport"] = False
msg = str(prev.get("message") or "")
if (not msg) or msg.startswith("Library catching up") or "backing off" in msg:
    skipped = int(prev.get("skipped") or 0)
    timeouts = int(prev.get("timeouts") or 0)
    prev["message"] = f"Library catch-up done — {skipped} skipped, {timeouts} timeouts"
prev["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
open(path, "w").write(json.dumps(prev) + "\n")
PY
log "library catch-up done"
exit 0
