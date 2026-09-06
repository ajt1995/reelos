#!/bin/bash
# ReelOS OTA. Stage in .next while :8080 keeps serving. mv, then probe, then stamp VERSION.
# Rollback is rename .prev. Never apt Chromium or Tailscale.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
WORK=/tmp/reelos-ota
LOG="$STATE/ota.log"
mkdir -p "$STATE" "$WORK"
log() { echo "$*" | tee -a "$LOG" >/dev/stderr; }

fetch_channel() {
  python3 - <<'PY'
import json, urllib.request, sys
urls = [
  "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
  "https://github.com/ajt1995/reelos/raw/refs/heads/main/channel.json",
  "https://api.github.com/repos/ajt1995/reelos/contents/channel.json?ref=main",
]
best = None
best_key = []
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "ReelOS-update", "Accept": "application/vnd.github.raw"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
        data = json.loads(raw)
        if "content" in data and data.get("encoding") == "base64":
            import base64
            data = json.loads(base64.b64decode(data["content"]).decode())
        ver = str(data.get("version") or "")
        key = [int(x) for x in ver.split(".") if x.isdigit()]
        if key > best_key:
            best, best_key = data, key
    except Exception:
        continue
if not best:
    sys.exit(1)
open("/tmp/reelos-ota/channel.json", "w").write(json.dumps(best, indent=2) + "\n")
PY
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
  python3 - <<'PY'
import json, urllib.request
try:
    req = urllib.request.Request(
        "https://api.github.com/repos/ajt1995/reelos/commits/main",
        headers={"User-Agent": "ReelOS-update", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        print(json.load(r).get("sha") or "")
except Exception:
    print("")
PY
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
curl -fL --retry 3 --max-time 180 -A "ReelOS-update" "$TARBALL" -o "$WORK/src.tar.gz"
rm -rf "$WORK/src"
mkdir -p "$WORK/src"
tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1
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
need install/compose/docker-compose.yml '0.0.0.0:8096'
need install/compose/docker-compose.yml rshared
need daemon/reelos-lid.sh HandleLidSwitch
need daemon/wire-engines.py Startup/Configuration
need scripts/reelos-lookup-plugin.mjs '/api/lookup'
need scripts/reelos-lookup-plugin.mjs '/api/request'
need scripts/reelos-lookup-plugin.mjs '/api/update/apply'
need scripts/reelos-lookup-plugin.mjs '/api/terminal'
need src/components/library-view.tsx '/api/library'
need scripts/reelos-lookup-plugin.mjs '/api/library'
need install/compose/docker-compose.yml '/mnt/symlinks:/symlinks'
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
  cp -a "$ROOT/compose/configs" "$NEXT/compose/configs"
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
}

trap restore ERR
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

if [ -f "$ROOT/compose/Caddyfile" ]; then
  mkdir -p /etc/caddy
  cp "$ROOT/compose/Caddyfile" /etc/caddy/Caddyfile
  systemctl enable --now caddy >/dev/null 2>&1 || true
  systemctl reload caddy 2>/dev/null || systemctl restart caddy || true
fi
if [ -f "$ROOT/systemd/reelos.service" ]; then
  cp "$ROOT/systemd/reelos.service" /etc/systemd/system/reelos.service
  systemctl daemon-reload || true
fi
log "starting shell"
systemctl enable --now reelos || true
systemctl restart reelos || true

probe() {
  local i code body
  for i in $(seq 1 45); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ || true)
    body=$(curl -sS --max-time 5 "http://127.0.0.1:8080/api/lookup?q=x" || true)
    log "probe $i home=$code lookup=${body:0:40}"
    if [ "$code" = "200" ] && echo "$body" | grep -q 'titles'; then
      return 0
    fi
    systemctl start reelos 2>/dev/null || true
    sleep 1
  done
  return 1
}

if ! probe; then
  log "probe failed — restoring previous app"
  restore
  exit 1
fi
trap - ERR

load_env() {
  if [ -f "$ROOT/compose/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT/compose/.env"
    set +a
  fi
}

if [ -f /var/lib/reelos/provisioned ] && [ -f "$ROOT/compose/docker-compose.yml" ]; then
  load_env
  (cd "$ROOT/compose" && docker compose up -d --remove-orphans) || log "compose up skipped"
  (cd "$ROOT/compose" && docker compose --profile jellyfin --profile debrid up -d jellyfin decypharr) || true
fi
if [ -f /var/lib/reelos/provisioned ] && [ -x "$ROOT/bin/wire-engines.py" ]; then
  REELOS_OTA=1 python3 "$ROOT/bin/wire-engines.py" || log "wire-engines non-fatal"
fi
if [ -x "$ROOT/bin/reelos-lid.sh" ]; then
  bash "$ROOT/bin/reelos-lid.sh" || log "lid ignore non-fatal"
fi

echo "$REMOTE" >"$ROOT/VERSION"
if [ -n "${HEAD_SHA:-}" ]; then
  echo "$HEAD_SHA" >"$STATE/applied-sha"
fi
log "$NOTES"
log "ReelOS $REMOTE applied."
echo "ReelOS $REMOTE applied."
