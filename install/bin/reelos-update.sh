#!/bin/bash
# ReelOS OTA. Phone stays up until the new tree is ready. VERSION is stamped last.
# Never touches /srv/media libraries or compose configs/.env (API keys).
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
WORK=/tmp/reelos-ota
LOG="$STATE/ota.log"
CHANNEL_URLS=(
  "https://cdn.jsdelivr.net/gh/ajt1995/reelos@main/channel.json"
  "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json"
  "https://github.com/ajt1995/reelos/raw/main/channel.json"
)
mkdir -p "$STATE" "$WORK"
log() { echo "$*" | tee -a "$LOG" >/dev/stderr; }

fetch_channel() {
  python3 - <<'PY'
import json, urllib.request, sys
urls = [
  "https://raw.githubusercontent.com/ajt1995/reelos/v1.2.2/channel.json",
  "https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json",
  "https://api.github.com/repos/ajt1995/reelos/contents/channel.json?ref=main",
  "https://cdn.jsdelivr.net/gh/ajt1995/reelos@main/channel.json",
]
best = None
best_key = []
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "reelos-ota", "Accept": "application/vnd.github.raw"})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
        data = json.loads(raw)
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

json() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2]) or "")' "$WORK/channel.json" "$1"
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

if [ "$MODE" = "check" ]; then
  python3 -c 'import json,sys
print(json.dumps({"local": sys.argv[1], "remote": sys.argv[2], "available": sys.argv[1] != sys.argv[2]}))' "$LOCAL" "$REMOTE"
  exit 0
fi

if [ "$REMOTE" = "$LOCAL" ]; then
  log "already $LOCAL"
  echo "already $LOCAL"
  exit 0
fi

log "ReelOS $LOCAL → $REMOTE"
curl -fL --max-time 120 "$TARBALL" -o "$WORK/src.tar.gz"
rm -rf "$WORK/src"
mkdir -p "$WORK/src"
tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1
GOT=$(cat "$WORK/src/VERSION" 2>/dev/null || true)
if [ "$GOT" != "$REMOTE" ]; then
  log "tarball VERSION '$GOT' != channel $REMOTE"
  exit 1
fi

# Re-exec the updater from this tarball so tonight's script cannot run tomorrow's apply.
NEW_UP="$WORK/src/daemon/reelos-update.sh"
if [ -f "$NEW_UP" ] && [ "${REELOS_OTA_REEXEC:-}" != "1" ]; then
  if ! cmp -s "$NEW_UP" "$0" 2>/dev/null; then
    log "re-exec updater from tarball"
    chmod 755 "$NEW_UP"
    export REELOS_OTA_REEXEC=1
    exec bash "$NEW_UP" apply
  fi
fi

need() {
  local f="$1" pat="$2"
  [ -f "$WORK/src/$f" ] || { log "canary missing $f"; return 1; }
  grep -q "$pat" "$WORK/src/$f" || { log "canary fail $f ~ $pat"; return 1; }
}
need src/components/settings-view.tsx 'title="Terminal"'
need src/components/home-view.tsx '/api/lookup'
need src/components/home-view.tsx 'Watch in this browser'
need src/lib/appliance.ts runTerminal
need src/lib/catalog.ts rememberCatalogTitles
need install/compose/docker-compose.yml rshared
need src/components/connect-view.tsx 'Watch on the TV'
need src/components/connect-view.tsx 'Install Tailscale on this box'
need install/compose/docker-compose.yml '0.0.0.0:8096'
need daemon/reelos-lid.sh HandleLidSwitch
need scripts/reelos-lookup-plugin.mjs '/api/update/apply'
need src/components/title-view.tsx 'Play in Jellyfin'
need src/components/title-view.tsx '/api/request'
need scripts/reelos-lookup-plugin.mjs '/api/terminal'
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
# Keep live secrets. Do not stamp VERSION yet.
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

# npm in the staged tree while the current shell keeps serving.
SKIP_NPM=0
if [ -f "$ROOT/app/package.json" ] && [ -f "$NEXT/app/package.json" ]; then
  if cmp -s "$ROOT/app/package.json" "$NEXT/app/package.json"; then
    SKIP_NPM=1
    if [ -d "$ROOT/app/node_modules" ]; then
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

rm -rf "$ROOT.prev"
mkdir -p "$ROOT.prev"
[ -d "$ROOT/app" ] && cp -a "$ROOT/app" "$ROOT.prev/app"
cp -a "$ROOT/VERSION" "$ROOT.prev/VERSION" 2>/dev/null || true
[ -f "$ROOT/compose/docker-compose.yml" ] && cp -a "$ROOT/compose/docker-compose.yml" "$ROOT.prev/docker-compose.yml" || true

# Swap app/bin/compose yml. Phone blips for a few seconds, not minutes.
systemctl stop reelos 2>/dev/null || true
rm -rf "$ROOT/app"
cp -a "$NEXT/app" "$ROOT/app"
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
systemctl enable --now reelos || true

probe() {
  local i
  for i in $(seq 1 30); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:8080/ || true)
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  return 1
}

if ! probe; then
  log "probe failed — restoring previous app"
  if [ -d "$ROOT.prev/app" ]; then
    systemctl stop reelos 2>/dev/null || true
    rm -rf "$ROOT/app"
    cp -a "$ROOT.prev/app" "$ROOT/app"
    [ -f "$ROOT.prev/VERSION" ] && cp -a "$ROOT.prev/VERSION" "$ROOT/VERSION"
    [ -f "$ROOT.prev/docker-compose.yml" ] && cp -a "$ROOT.prev/docker-compose.yml" "$ROOT/compose/docker-compose.yml"
    systemctl start reelos 2>/dev/null || true
  fi
  exit 1
fi

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
  (cd "$ROOT/compose" && docker compose up -d --force-recreate jellyfin decypharr) || true
fi
if [ -f /var/lib/reelos/provisioned ] && [ -x "$ROOT/bin/wire-engines.py" ]; then
  REELOS_OTA=1 python3 "$ROOT/bin/wire-engines.py" || log "wire-engines non-fatal"
fi

if [ -x "$ROOT/bin/reelos-lid.sh" ]; then
  bash "$ROOT/bin/reelos-lid.sh" || log "lid ignore non-fatal"
elif [ -x "$WORK/src/daemon/reelos-lid.sh" ]; then
  bash "$WORK/src/daemon/reelos-lid.sh" || true
fi
echo "$REMOTE" >"$ROOT/VERSION"
log "$NOTES"
log "ReelOS $REMOTE applied."
echo "ReelOS $REMOTE applied."
