#!/usr/bin/env bash
# House integration bench — think in the cloud, poke the HP over SSH.
#
# Hardware is HP Laptop 15-bs0xx, 4GB RAM, HDD (WD5000LPCX). Do not call it a Pi.
# SSH user is reelos only. Read-only by default (HOUSE_BENCH_WRITE=0).
#
# This is not Apply. Do not delete ota.lock. Do not wipe /media.
# Do not docker-restart Sonarr. Do not install Cursor/node on the house.
# Do not check out a second /opt/reelos. Do not run npm or vite on the house.
# Never print adminPassword.
#
# Cloud `npm test` / `start:box` is not proof of FUSE, ffprobe, mailman Apply,
# or dump import. Verify those on the house with this script.

set -u

HOUSE_USER="${HOUSE_USER:-reelos}"
HOUSE_HOST="${HOUSE_HOST:-100.100.154.16}"
HOUSE_BENCH_WRITE="${HOUSE_BENCH_WRITE:-0}"
HOUSE_MAGICDNS="${HOUSE_MAGICDNS:-reelos.tail977fee.ts.net}"

usage() {
  cat <<'EOF'
Usage: scripts/house-bench.sh

SSH as reelos and print house facts (VERSION, door :80/:8080, fuse.decypharr,
ffprobe D-state, load vs nproc, catch-up unit, library-progress.json, orphan
start:box on :8080). If Tailscale is in check-mode, prints the first line
(login.tailscale.com).

  HOUSE_HOST          default 100.100.154.16
  HOUSE_USER          must be reelos
  HOUSE_BENCH_WRITE   must be 0 (write is not implemented)
  HOUSE_MAGICDNS      fallback reelos.tail977fee.ts.net

Read-only. Will not Apply, delete ota.lock, wipe /media, or restart Docker.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    apply|Apply|--apply|-apply)
      echo "house-bench: will not Apply" >&2
      exit 2
      ;;
  esac
done

if [ "$HOUSE_USER" != "reelos" ]; then
  echo "house-bench: SSH user must be reelos (got ${HOUSE_USER})" >&2
  exit 2
fi

if [ "$HOUSE_BENCH_WRITE" != "0" ]; then
  echo "house-bench: HOUSE_BENCH_WRITE=${HOUSE_BENCH_WRITE} refused; this script is read-only" >&2
  exit 2
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "house-bench: ssh not found on this cloud pod" >&2
  exit 1
fi

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=20
  -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes
  -o PreferredAuthentications=publickey
)

# Read-only probe. No sudo. No compose. No mailman. No file writes.
REMOTE_SCRIPT=$(cat <<'REMOTE'
set +e
echo "=== house-bench $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "whoami=$(whoami)"
echo "hostname=$(hostname)"
echo "hardware=HP Laptop 15-bs0xx (not a Pi)"
echo "product_name=$(cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null)"
echo "VERSION=$(cat /opt/reelos/VERSION 2>/dev/null || echo missing)"
echo "applied-sha=$(cat /var/lib/reelos/applied-sha 2>/dev/null || echo missing)"
echo "installed-version=$(cat /var/lib/reelos/installed-version 2>/dev/null || echo missing)"

echo "=== door ==="
for p in 80 8080; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:${p}/" 2>/dev/null || echo fail)
  echo "door :${p} http=${code}"
done

echo "=== fuse.decypharr ==="
echo "fuse.decypharr_count=$(grep -c 'fuse.decypharr' /proc/self/mountinfo 2>/dev/null || echo 0)"
echo "fuse.decypharr_mnt_debrid=$(grep -c ' /mnt/debrid .* - fuse.decypharr' /proc/self/mountinfo 2>/dev/null || echo 0)"

echo "=== ffprobe D-state ==="
echo "ffprobe_D=$(ps -eo state,comm --no-headers 2>/dev/null | awk '$1 ~ /D/ && $2 ~ /ffprobe/ { n++ } END { print n+0 }')"

echo "=== load vs nproc ==="
echo "loadavg=$(cut -d' ' -f1-3 /proc/loadavg)"
echo "nproc=$(nproc)"
awk '/MemTotal/ { print "MemTotal="$2" "$3 }' /proc/meminfo

echo "=== catch-up unit ==="
echo "catchup_enabled=$(systemctl is-enabled reelos-library-catchup.service 2>&1)"
echo "catchup_active=$(systemctl is-active reelos-library-catchup.service 2>&1)"
systemctl show reelos-library-catchup.service -p LoadState,UnitFileState,FragmentPath,ActiveState,SubState,Result,MainPID --no-pager 2>&1

echo "=== library-progress.json ==="
if [ -f /var/lib/reelos/library-progress.json ]; then
  python3 -c 'import json,sys
p=json.load(open("/var/lib/reelos/library-progress.json"))
keep=("status","message","splashLock","needsImport","stopped","updatedAt","folder","imported","skipped","timeouts","total","error")
out={k:p.get(k) for k in keep if k in p}
print("library-progress="+json.dumps(out, default=str))
print("library-progress.status="+str(p.get("status")))'
else
  echo "library-progress=missing"
  echo "library-progress.status=missing"
fi

echo "=== start:box / :8080 ==="
box_count=$(ps -eo args --no-headers 2>/dev/null | grep -c '[n]pm run start:box')
unit_active=$(systemctl is-active reelos.service 2>&1)
unit_pid=$(systemctl show -p MainPID --value reelos.service 2>/dev/null || echo 0)
echo "start:box_count=${box_count}"
echo "reelos.service=${unit_active}"
echo "reelos.service.MainPID=${unit_pid}"
orphan=no
if [ "${box_count}" -gt 1 ]; then
  orphan=yes
elif [ "${box_count}" -ge 1 ] && [ "${unit_active}" != "active" ]; then
  orphan=yes
fi
echo "orphan_start_box=${orphan}"
ss -lptn 'sport = :8080' 2>/dev/null | head -n 5 || true

echo "=== ota.lock (read-only) ==="
if [ -e /var/lib/reelos/ota.lock ]; then
  echo "ota.lock=exists"
  python3 -c 'import fcntl,os
p="/var/lib/reelos/ota.lock"
fd=os.open(p, os.O_RDONLY)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    fcntl.flock(fd, fcntl.LOCK_UN)
    print("ota.lock.flock=not-held")
except BlockingIOError:
    print("ota.lock.flock=held")
os.close(fd)' 2>/dev/null || echo "ota.lock.flock=unknown"
else
  echo "ota.lock=missing"
fi

echo "=== done ==="
REMOTE
)

print_check_mode_line() {
  local blob="$1"
  local first
  first=$(printf '%s\n' "$blob" | head -n 1)
  case "$first" in
    *login.tailscale.com*)
      echo "tailscale_check_mode=${first}"
      ;;
  esac
}

try_host() {
  local host="$1"
  local out rc
  echo "=== ssh ${HOUSE_USER}@${host} ==="
  out=$(ssh "${SSH_OPTS[@]}" "${HOUSE_USER}@${host}" bash -s <<<"${REMOTE_SCRIPT}" 2>&1)
  rc=$?
  print_check_mode_line "$out"
  printf '%s\n' "$out"
  return "$rc"
}

HOSTS=("${HOUSE_HOST}")
if [ "$HOUSE_HOST" = "100.100.154.16" ]; then
  HOSTS+=("${HOUSE_MAGICDNS}" "reelos")
elif [ "$HOUSE_HOST" = "$HOUSE_MAGICDNS" ]; then
  HOSTS+=("100.100.154.16" "reelos")
fi

last_rc=1
tried=""
for host in "${HOSTS[@]}"; do
  case " ${tried} " in
    *" ${host} "*) continue ;;
  esac
  tried="${tried} ${host}"
  if try_host "$host"; then
    exit 0
  fi
  last_rc=$?
  echo "house-bench: ssh ${HOUSE_USER}@${host} failed (exit ${last_rc})" >&2
done

echo "house-bench: could not SSH the house as reelos" >&2
exit "$last_rc"
