#!/bin/bash
# ReelOS OTA. Stage in .next while :8080 keeps serving. mv, then probe, then stamp VERSION.
# Rollback is rename .prev. Never apt Chromium or Tailscale.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
WORK=/tmp/reelos-ota
LOG="$STATE/ota.log"
mkdir -p "$STATE" "$WORK"
log() { printf '%s\n' "$*" >>"$LOG"; printf '%s\n' "$*" >&2; }
trap 'log "ERR line $LINENO exit $?"' ERR

# curl, not Python urllib. House Python 3.14 hangs under systemd; Node/curl do not.
fetch_channel() {
  mkdir -p "$WORK"
  local u
  for u in \
    "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json" \
    "https://github.com/ajt1995/reelos/raw/refs/heads/main/channel.json"
  do
    log "channel GET $u"
    if curl -fsSL --ipv4 --max-time 20 -A "ReelOS-update" -o "$WORK/channel.json" "$u" \
      && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("version") else 1)' "$WORK/channel.json"
    then
      log "channel $(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json"))["version"])')"
      return 0
    fi
    log "channel miss $u"
  done
  return 1
}

LOCAL=$(cat "$ROOT/VERSION" 2>/dev/null || echo "0")
MODE="${1:-check}"
echo "---- $(date -Is) $MODE local=$LOCAL ----" >>"$LOG"

fetch_channel || { log "channel unreachable"; [ "$MODE" = "check" ] && echo '{"local":"'"$LOCAL"'","remote":"'"$LOCAL"'","available":false}'; exit 1; }
REMOTE=$(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json"))["version"])')
TARBALL=$(python3 -c 'import json; print(json.load(open("/tmp/reelos-ota/channel.json")).get("tarball") or "")')
NOTES=$(python3 -c 'import json; print("\n".join(json.load(open("/tmp/reelos-ota/channel.json")).get("notes") or []))')
if [ -z "$TARBALL" ]; then
  TARBALL="https://github.com/ajt1995/reelos/archive/refs/tags/v${REMOTE}.tar.gz"
fi

newer() {
  python3 -c 'import sys
a=[int(x) for x in sys.argv[1].split(".") if x.isdigit()]
b=[int(x) for x in sys.argv[2].split(".") if x.isdigit()]
n=max(len(a),len(b)); a+=[0]*(n-len(a)); b+=[0]*(n-len(b))
sys.exit(0 if a>b else 1)' "$1" "$2"
}

github_sha() {
  curl -fsSL --ipv4 --max-time 15 -A "ReelOS-update" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/ajt1995/reelos/commits/main \
    | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("sha") or "")
except Exception:
    print("")' || true
}

HEAD_SHA=$(github_sha)
APPLIED_SHA=$(cat "$STATE/applied-sha" 2>/dev/null || true)

if [ "$MODE" = "check" ]; then
  python3 -c 'import json,sys
loc, rem, head, applied = sys.argv[1:5]
def key(v):
    return [int(x) for x in v.split(".") if x.isdigit()]
same_tree = bool(head) and head == applied
print(json.dumps({
  "local": loc,
  "remote": rem,
  "available": key(rem) > key(loc) or (bool(head) and not same_tree),
  "sha": head[:12],
}))' "$LOCAL" "$REMOTE" "$HEAD_SHA" "$APPLIED_SHA"
  exit 0
fi

if ! newer "$REMOTE" "$LOCAL"; then
  if [ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" != "$APPLIED_SHA" ]; then
    log "same $LOCAL, new main ${HEAD_SHA:0:12}"
  else
    log "already $LOCAL (channel $REMOTE)"
    echo "already $LOCAL"
    exit 0
  fi
fi

log "ReelOS $LOCAL → $REMOTE"

# Phone Apply is a child of reelos.service. systemctl stop reelos kills that
# cgroup. SSH is not in that cgroup — do not systemd-run from a pipe ($0 is bash).
in_reelos_unit() {
  grep -q 'reelos.service' /proc/self/cgroup 2>/dev/null
}
if [ "${REELOS_OTA_UNIT:-}" != "1" ] && in_reelos_unit && command -v systemctl >/dev/null 2>&1; then
  log "detach updater into reelos-ota.service (survives stop reelos)"
  mkdir -p /var/lib/reelos /etc/systemd/system
  src="${BASH_SOURCE[0]:-}"
  if [ ! -f "$src" ] || [ "$src" = "bash" ]; then
    src=/var/lib/reelos/update-apply.sh
  fi
  cp -a "$src" /var/lib/reelos/update-apply.sh 2>/dev/null || true
  chmod 755 /var/lib/reelos/update-apply.sh
  cat >/etc/systemd/system/reelos-ota.service <<'EOF'
[Unit]
Description=ReelOS OTA
After=network-online.target
[Service]
Type=oneshot
TimeoutStartSec=infinity
KillMode=mixed
Environment=REELOS_OTA_UNIT=1
Environment=REELOS_ROOT=/opt/reelos
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/var/lib/reelos/ota.log
StandardError=append:/var/lib/reelos/ota.log
ExecStart=/bin/bash /var/lib/reelos/update-apply.sh apply
EOF
  systemctl daemon-reload || true
  systemctl reset-failed reelos-ota 2>/dev/null || true
  systemctl start --no-block reelos-ota
  exit 0
fi

if [ "${REELOS_OTA_REEXEC:-}" = "1" ] && [ -f "$WORK/src/VERSION" ]; then
  log "tarball already extracted — skip second download"
else
  log "downloading $TARBALL"
  curl -fL --ipv4 --retry 3 --max-time 180 -A "ReelOS-update" "$TARBALL" -o "$WORK/src.tar.gz"
  log "tarball $(wc -c < "$WORK/src.tar.gz") bytes"
  rm -rf "$WORK/src"
  mkdir -p "$WORK/src"
  tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1
fi
GOT=$(cat "$WORK/src/VERSION" 2>/dev/null || true)
if [ "$GOT" != "$REMOTE" ]; then
  log "tarball VERSION '$GOT' != channel $REMOTE"
  exit 1
fi

NEW_UP="$WORK/src/daemon/reelos-update.sh"
if [ -f "$NEW_UP" ] && [ "${REELOS_OTA_REEXEC:-}" != "1" ]; then
  if ! cmp -s "$NEW_UP" "$0" 2>/dev/null; then
    log "re-exec updater from tarball (mailman first)"
    chmod 755 "$NEW_UP"
    export REELOS_OTA_REEXEC=1
    exec bash "$NEW_UP" apply
  fi
fi

if [ -f "$WORK/src/daemon/reelos-lid.sh" ]; then
  log "lid: ignore close"
  bash "$WORK/src/daemon/reelos-lid.sh" || log "lid non-fatal"
fi

need() {
  local f="$1" pat="$2"
  [ -f "$WORK/src/$f" ] || { log "canary missing $f"; return 1; }
  grep -q "$pat" "$WORK/src/$f" || { log "canary fail $f ~ $pat"; return 1; }
}
need src/components/home-view.tsx '/api/lookup'
need src/components/title-view.tsx '/api/request'
need src/components/connect-view.tsx 'Watch on the TV'
need src/components/connect-view.tsx 'Install Tailscale on this box'
need src/components/advanced-view.tsx TerminalRow
need src/components/settings-view.tsx 'title="Terminal"'
need src/components/library-view.tsx hydrateShelf
need install/compose/docker-compose.yml '0.0.0.0:8096'
need install/compose/docker-compose.yml rshared
need daemon/reelos-lid.sh HandleLidSwitch
need daemon/wire-engines.py Startup/Configuration
need scripts/reelos-lookup-plugin.mjs 'sonarr hits='
need scripts/reelos-lookup-plugin.mjs '/api/request'
need scripts/reelos-lookup-plugin.mjs 'update-apply.sh'
need scripts/reelos-lookup-plugin.mjs '/api/activity'
need scripts/reelos-lookup-plugin.mjs '/api/intent'
need src/components/player-view.tsx ':8096'
need scripts/reelos-lookup-plugin.mjs '/api/terminal'
need scripts/reelos-lookup-plugin.mjs '/api/library'
need install/compose/docker-compose.yml '/mnt/symlinks:/symlinks'
need install/compose/docker-compose.yml '1.1.1.1'
need src/components/shell.tsx 'to: "/settings"'
need daemon/wire-engines.py 'restart_fuse_readers'
need install/compose/docker-compose.yml '/mnt:/mnt:rslave'
need daemon/reelos-update.sh 'daemon-reload (8080 still up)'
need daemon/reelos-update.sh 'skip second download'
need daemon/reelos-update.sh 'home up — not stamping'
need daemon/reelos-update.sh 'ListenAddress 0.0.0.0'
if grep -q '172.66.170.114' "$WORK/src/install/compose/docker-compose.yml"; then
  log "canary fail pinned extra_hosts"
  exit 1
fi
log "canaries ok"

NEXT="$ROOT.next"
rm -rf "$NEXT"
mkdir -p "$NEXT/app" "$NEXT/bin" "$NEXT/systemd" "$NEXT/compose"
cp -a "$WORK/src/install/." "$NEXT/" 2>/dev/null || true
if [ -d "$WORK/src/src" ]; then
  rm -rf "$NEXT/app"
  mkdir -p "$NEXT/app"
  cp -a "$WORK/src/package.json" "$WORK/src/package-lock.json" "$WORK/src/tsconfig.json" "$WORK/src/vite.config.ts" "$NEXT/app/" 2>/dev/null || true
  cp -a "$WORK/src/src" "$NEXT/app/src"
  [ -d "$WORK/src/server" ] && cp -a "$WORK/src/server" "$NEXT/app/server"
  [ -d "$WORK/src/scripts" ] && cp -a "$WORK/src/scripts" "$NEXT/app/scripts"
  mkdir -p "$NEXT/app/public"
  if [ -d "$WORK/src/public" ]; then
    cp -a "$WORK/src/public/." "$NEXT/app/public/" || true
    rm -rf "$NEXT/app/public/install" || true
  fi
  echo 1 >"$NEXT/app/.reelos-appliance"
fi
if [ -d "$WORK/src/daemon" ]; then
  mkdir -p "$NEXT/bin"
  cp -a "$WORK/src/daemon/." "$NEXT/bin/"
fi
chmod 755 "$NEXT/bin/"* 2>/dev/null || true
if [ -d "$ROOT/compose/configs" ]; then
  mkdir -p "$NEXT/compose"
  cp -a "$ROOT/compose/configs" "$NEXT/compose/configs" || log "config copy skipped vanished sqlite sidecars"
  [ -f "$ROOT/compose/.env" ] && cp -a "$ROOT/compose/.env" "$NEXT/compose/.env"
fi
if [ -f "$WORK/src/install/compose/docker-compose.yml" ]; then
  mkdir -p "$NEXT/compose"
  cp "$WORK/src/install/compose/docker-compose.yml" "$NEXT/compose/docker-compose.yml"
fi
if [ -f "$WORK/src/install/compose/Caddyfile" ]; then
  cp "$WORK/src/install/compose/Caddyfile" "$NEXT/compose/Caddyfile"
fi

SKIP_NPM=0
if [ -f "$ROOT/app/package.json" ] && [ -f "$NEXT/app/package.json" ]; then
  if cmp -s "$ROOT/app/package.json" "$NEXT/app/package.json"; then
    SKIP_NPM=1
    if [ -d "$ROOT/app/node_modules" ]; then
      log "copying node_modules into staging (8080 still up)"
      cp -a "$ROOT/app/node_modules" "$NEXT/app/node_modules"
      log "package.json unchanged — reused node_modules"
    else
      SKIP_NPM=0
    fi
  fi
fi
if [ "$SKIP_NPM" = 0 ] && [ -f "$NEXT/app/package.json" ]; then
  export DEBIAN_FRONTEND=noninteractive
  command -v npm >/dev/null 2>&1 || apt-get install -y nodejs npm || true
  (cd "$NEXT/app" && { npm ci --no-audit --no-fund || npm install --no-audit --no-fund; }) || {
    log "npm failed — not swapping"
    rm -rf "$NEXT"
    exit 1
  }
fi

if [ -d "$ROOT.prev" ]; then
  log "dropping old backup (8080 still up)"
  rm -rf "$ROOT.prev"
fi
mkdir -p "$ROOT.prev"
cp -a "$ROOT/VERSION" "$ROOT.prev/VERSION" 2>/dev/null || true
[ -f "$ROOT/compose/docker-compose.yml" ] && cp -a "$ROOT/compose/docker-compose.yml" "$ROOT.prev/docker-compose.yml" || true

caddy_updating() {
  mkdir -p /etc/caddy
  if [ -f /etc/caddy/Caddyfile ]; then
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.reelos.bak
  fi
  cat >/etc/caddy/Caddyfile <<'EOF'
{
	auto_https off
	admin off
}
:80 {
	header Content-Type "text/html; charset=utf-8"
	respond "ReelOS is updating. This page will come back in a minute." 200
}
EOF
  timeout 8 systemctl reload caddy >/dev/null 2>&1 || timeout 8 systemctl restart caddy >/dev/null 2>&1 || true
  log "caddy parked on updating page"
}

caddy_dropin() {
  mkdir -p /etc/systemd/system/caddy.service.d
  cat >/etc/systemd/system/caddy.service.d/reelos.conf <<'EOF'
[Service]
Type=simple
TimeoutStartSec=12
ExecStart=
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
EOF
  systemctl daemon-reload || true
}

caddy_listen() {
  ss -lptn 2>/dev/null | grep -qE ':80 |:80$' && return 0
  curl -sS -o /dev/null --max-time 1 http://127.0.0.1/ && return 0
  return 1
}

caddy_reelos() {
  mkdir -p /etc/caddy
  if [ -f "$ROOT/compose/Caddyfile" ]; then
    cp "$ROOT/compose/Caddyfile" /etc/caddy/Caddyfile
  elif [ -f /etc/caddy/Caddyfile.reelos.bak ]; then
    cp /etc/caddy/Caddyfile.reelos.bak /etc/caddy/Caddyfile
  fi
  if ! grep -q 'auto_https off' /etc/caddy/Caddyfile 2>/dev/null; then
    printf '%s\n' '{' '	auto_https off' '	admin off' '}' '' | cat - /etc/caddy/Caddyfile > /etc/caddy/Caddyfile.tmp
    mv /etc/caddy/Caddyfile.tmp /etc/caddy/Caddyfile
  fi
  caddy_dropin
  timeout 12 systemctl restart caddy >/dev/null 2>&1 || true
  if ! caddy_listen; then
    log "caddy systemd stuck — running caddy directly"
    timeout 5 systemctl stop caddy >/dev/null 2>&1 || true
    pkill -x caddy >/dev/null 2>&1 || true
    sleep 0.4
    nohup /usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >>/var/lib/reelos/caddy.log 2>&1 &
    sleep 1
  fi
  log "caddy proxying to live 8080"
}

restore() {
  log "restore after failure"
  trap - ERR
  systemctl stop reelos 2>/dev/null || true
  if [ -d "$ROOT.prev/app" ]; then
    rm -rf "$ROOT/app"
    mv "$ROOT.prev/app" "$ROOT/app"
    [ -f "$ROOT.prev/VERSION" ] && cp -a "$ROOT.prev/VERSION" "$ROOT/VERSION"
    [ -f "$ROOT.prev/docker-compose.yml" ] && cp -a "$ROOT.prev/docker-compose.yml" "$ROOT/compose/docker-compose.yml"
  fi
  systemctl daemon-reload 2>/dev/null || true
  systemctl start reelos 2>/dev/null || true
  sleep 2
  systemctl start reelos 2>/dev/null || true
  local i code
  for i in $(seq 1 20); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ || true)
    [ "$code" = "200" ] && break
    sleep 1
  done
  caddy_reelos
}

# Unit + daemon-reload BEFORE stop so start never uses a stale unit.
UNIT_SRC=""
if [ -f "$NEXT/systemd/reelos.service" ]; then
  UNIT_SRC="$NEXT/systemd/reelos.service"
elif [ -f "$WORK/src/install/systemd/reelos.service" ]; then
  UNIT_SRC="$WORK/src/install/systemd/reelos.service"
fi
if [ -n "$UNIT_SRC" ]; then
  mkdir -p "$ROOT/systemd"
  cp "$UNIT_SRC" "$ROOT/systemd/reelos.service"
  cp "$UNIT_SRC" /etc/systemd/system/reelos.service
  systemctl daemon-reload || true
  log "unit installed, daemon-reload (8080 still up)"
fi

trap restore ERR
caddy_updating
log "stopping shell for mv (seconds, not minutes)"
systemctl stop reelos 2>/dev/null || true
mv "$ROOT/app" "$ROOT.prev/app"
mv "$NEXT/app" "$ROOT/app"
mkdir -p "$ROOT/bin" "$ROOT/compose" "$ROOT/systemd"
cp -a "$NEXT/bin/." "$ROOT/bin/"
cp -a "$NEXT/systemd/." "$ROOT/systemd/" 2>/dev/null || true
cp "$NEXT/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml" 2>/dev/null || true
cp "$NEXT/compose/Caddyfile" "$ROOT/compose/Caddyfile" 2>/dev/null || true
rm -rf "$NEXT"

log "starting shell"
systemctl enable reelos >/dev/null 2>&1 || true
systemctl start reelos || true

probe_home() {
  local i code
  for i in $(seq 1 45); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ || true)
    log "probe $i home=$code"
    if [ "$code" = "200" ]; then
      return 0
    fi
    systemctl daemon-reload 2>/dev/null || true
    systemctl start reelos 2>/dev/null || true
    if [ $((i % 8)) -eq 0 ]; then
      log "8080 still down — restart reelos"
      systemctl restart reelos 2>/dev/null || true
    fi
    sleep 1
  done
  journalctl -u reelos --no-pager -n 50 >>"$LOG" 2>/dev/null || true
  log "home never returned"
  return 1
}

probe_port80() {
  local i code page
  for i in $(seq 1 20); do
    code=$(curl -sS -o /tmp/reelos-ota-80.html -w "%{http_code}" --max-time 3 http://127.0.0.1/ || true)
    page=$(head -c 800 /tmp/reelos-ota-80.html 2>/dev/null || true)
    log "probe :80 $i code=$code"
    if echo "$page" | grep -qiE 'Caddy works|Welcome to Caddy'; then
      log "stock Caddy on :80 — reinstalling ReelOS Caddyfile"
      caddy_reelos
      sleep 1
      continue
    fi
    if echo "$page" | grep -qi 'ReelOS is updating'; then
      log ":80 still updating page"
      caddy_reelos
      sleep 1
      continue
    fi
    if [ "$code" = "200" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! probe_home; then
  log "probe failed — restoring previous app"
  restore
  exit 1
fi
trap - ERR
log "home up — not stamping VERSION"

caddy_reelos
if ! probe_port80; then
  log ":80 still down — Home is on :8080, not rolling back"
fi

sshd_open() {
  mkdir -p /etc/ssh/sshd_config.d
  cat >/etc/ssh/sshd_config.d/reelos.conf <<'EOF'
ListenAddress 0.0.0.0
ListenAddress ::
PasswordAuthentication yes
EOF
  systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd 2>/dev/null || true
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow in on tailscale0 >/dev/null 2>&1 || true
  fi
  if command -v tailscale >/dev/null 2>&1; then
    tailscale set --ssh 2>/dev/null || true
  fi
  log "ssh listening on 0.0.0.0:22"
}
sshd_open

nudge_fuse() {
  if [ -e /mnt/debrid/__all__ ] || [ -e /mnt/debrid/version.txt ]; then
    timeout 25 docker restart reelos-jellyfin-1 reelos-radarr-1 reelos-sonarr-1 >/dev/null 2>&1 || true
    log "restarted fuse readers"
  else
    log "fuse not mounted — skip reader restart"
  fi
}
nudge_fuse

load_env() {
  if [ -f "$ROOT/compose/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT/compose/.env"
    set +a
  fi
}

if [ -f /var/lib/reelos/provisioned ] && [ -f "$ROOT/compose/docker-compose.yml" ]; then
  mkdir -p /mnt /mnt/symlinks
  mount --bind /mnt /mnt 2>/dev/null || true
  mount --make-rshared /mnt 2>/dev/null || log "rshared /mnt skipped"
  load_env
  COMPOSE_CHANGED=0
  if [ -f "$WORK/src/install/compose/docker-compose.yml" ]; then
    if cmp -s "$WORK/src/install/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml" 2>/dev/null; then
      log "compose yml unchanged — skip compose up, wire, indexer canary"
    else
      COMPOSE_CHANGED=1
      cp "$WORK/src/install/compose/docker-compose.yml" "$ROOT/compose/docker-compose.yml"
      log "compose yml from tarball"
    fi
  fi
  if [ "$COMPOSE_CHANGED" = "1" ]; then
    (cd "$ROOT/compose" && docker compose \
      --profile indexers --profile movies --profile tv --profile debrid --profile jellyfin --profile subtitles \
      up -d --remove-orphans) || log "compose up skipped"
    log "waiting for Prowlarr :9696"
    for _i in $(seq 1 20); do
      if curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:9696/; then
        log "prowlarr up"
        break
      fi
      sleep 1
    done
  fi
fi
if [ "${COMPOSE_CHANGED:-0}" = "1" ] && [ -f /var/lib/reelos/provisioned ] && [ -x "$ROOT/bin/wire-engines.py" ]; then
  REELOS_OTA=1 python3 "$ROOT/bin/wire-engines.py" || log "wire-engines non-fatal"
fi
if [ -f /var/lib/reelos/stack-images ]; then
  log "stack images — docker compose pull"
  (cd "$ROOT/compose" && docker compose pull) || log "compose pull non-fatal"
fi

indexer_canary() {
  python3 - <<'PY'
import json, os, re, sys, urllib.error, urllib.request
from pathlib import Path
root = Path(os.environ.get("REELOS_ROOT", "/opt/reelos"))
state = Path("/var/lib/reelos")
src = ""
answers = {}
ap = state / "answers.json"
if ap.exists():
    try:
        answers = json.loads(ap.read_text())
        src = str(answers.get("source") or "").strip()
    except json.JSONDecodeError:
        src = ""
envp = root / "compose" / ".env"
if envp.exists():
    for line in envp.read_text().splitlines():
        if line.startswith("SOURCE=") and not src:
            src = line.split("=", 1)[1].strip()
debrid = {"torbox", "real-debrid", "alldebrid", "premiumize", "realdebrid"}
if src == "local-vpn":
    print("skip")
    sys.exit(0)
errp = state / "releases-error.txt"
err = errp.read_text().strip()[:400] if errp.exists() else ""
xml = root / "compose" / "configs" / "prowlarr" / "config.xml"
key = None
if xml.exists():
    m = re.search(r"<ApiKey>([^<]+)</ApiKey>", xml.read_text())
    key = m.group(1) if m else None
if not key:
    print(err or "Prowlarr has no API key")
    sys.exit(1)
req = urllib.request.Request(
    "http://127.0.0.1:9696/api/v1/indexer",
    headers={"X-Api-Key": key},
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        rows = json.load(r)
except Exception as e:
    print(err or f"{type(e).__name__}: {e}")
    sys.exit(1)
ok_names = []
last = err
for ix in rows or []:
    if not ix.get("enable"):
        continue
    req = urllib.request.Request(
        "http://127.0.0.1:9696/api/v1/indexer/test",
        data=json.dumps(ix).encode(),
        method="POST",
        headers={"X-Api-Key": key, "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=25).read()
        ok_names.append(str(ix.get("name")))
    except urllib.error.HTTPError as e:
        last = e.read().decode()[:300] if e.fp else str(e)
    except Exception as e:
        last = f"{type(e).__name__}: {e}"
if not ok_names:
    print(last or "no indexer passed test")
    sys.exit(1)
print(",".join(ok_names))
sys.exit(0)
PY
}

CANARY_FAIL=0
if [ "${COMPOSE_CHANGED:-0}" = "1" ] && [ -f /var/lib/reelos/provisioned ]; then
  CANARY_OUT=$(indexer_canary) || {
    CANARY_FAIL=1
    log "indexer canary FAIL ${CANARY_OUT:-} — not stamping installed version"
    [ -f "$STATE/releases-error.txt" ] && log "$(head -c 400 "$STATE/releases-error.txt")"
  }
  [ "$CANARY_FAIL" = "0" ] && log "indexer canary ${CANARY_OUT:-ok}"
else
  log "indexer canary skipped (UI-only OTA)"
fi

if [ "$CANARY_FAIL" = "1" ]; then
  log "installed remains $(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
  exit 1
fi

echo "$REMOTE" >"$ROOT/VERSION"
echo "$REMOTE" >"$STATE/installed-version"
if [ -n "${HEAD_SHA:-}" ]; then
  echo "$HEAD_SHA" >"$STATE/applied-sha"
fi
log "$NOTES"
log "ReelOS $REMOTE applied."
echo "ReelOS $REMOTE applied."
