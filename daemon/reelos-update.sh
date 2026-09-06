#!/bin/bash
# ReelOS OTA. Reads GitHub channel.json. Never touches /srv/media or compose configs.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
CHANNEL_URL="${REELOS_CHANNEL_URL:-https://raw.githubusercontent.com/ajt1995/reelos/main/channel.json}"
WORK=/tmp/reelos-ota
mkdir -p "$STATE" "$WORK"
LOCAL=$(cat "$ROOT/VERSION" 2>/dev/null || echo "0")
MODE="${1:-check}"

curl -fsSL "$CHANNEL_URL" >"$WORK/channel.json"
REMOTE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$WORK/channel.json")
TARBALL=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("tarball") or "")' "$WORK/channel.json")
NOTES=$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1])).get("notes") or []))' "$WORK/channel.json")

if [ "$MODE" = "check" ]; then
  python3 -c 'import json,sys
local, remote = sys.argv[1], sys.argv[2]
print(json.dumps({"local": local, "remote": remote, "available": remote != local}))' "$LOCAL" "$REMOTE"
  exit 0
fi

if [ "$REMOTE" = "$LOCAL" ]; then
  echo "already $LOCAL"
  exit 0
fi

echo "ReelOS $LOCAL → $REMOTE"
curl -fL "$TARBALL" -o "$WORK/src.tar.gz"
rm -rf "$WORK/src"
mkdir -p "$WORK/src"
tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1
if [ ! -f "$WORK/src/VERSION" ]; then
  echo "tarball has no VERSION" >&2
  exit 1
fi
GOT=$(cat "$WORK/src/VERSION")
if [ "$GOT" != "$REMOTE" ]; then
  echo "VERSION $GOT != channel $REMOTE" >&2
  exit 1
fi

# Stage next tree. Keep secrets and libraries.
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
cp "$WORK/src/VERSION" "$NEXT/VERSION"
cp "$WORK/src/install/reelos-install.sh" "$NEXT/install.sh"
chmod 755 "$NEXT/install.sh" "$NEXT/bin/"* 2>/dev/null || true

# Swap. Keep compose/configs.
systemctl stop reelos 2>/dev/null || true
if [ -d "$ROOT/compose/configs" ]; then
  mkdir -p "$NEXT/compose"
  cp -a "$ROOT/compose/configs" "$NEXT/compose/configs"
  [ -f "$ROOT/compose/.env" ] && cp -a "$ROOT/compose/.env" "$NEXT/compose/.env"
fi
# Keep previous as .prev for fail-closed restore
rm -rf "$ROOT.prev"
if [ -d "$ROOT/app" ]; then
  mkdir -p "$ROOT.prev"
  cp -a "$ROOT/app" "$ROOT.prev/app"
  cp -a "$ROOT/VERSION" "$ROOT.prev/VERSION" 2>/dev/null || true
fi
cp -a "$NEXT/." "$ROOT/"
rm -rf "$NEXT"
if [ -f "$ROOT/app/package.json" ]; then
  (cd "$ROOT/app" && npm ci --no-audit --no-fund) || {
    echo "npm ci failed — restoring" >&2
    if [ -d "$ROOT.prev/app" ]; then
      rm -rf "$ROOT/app"
      cp -a "$ROOT.prev/app" "$ROOT/app"
      cp -a "$ROOT.prev/VERSION" "$ROOT/VERSION" 2>/dev/null || true
    fi
    systemctl start reelos 2>/dev/null || true
    exit 1
  }
fi
systemctl daemon-reload || true
systemctl start reelos || true
if [ -f /var/lib/reelos/provisioned ] && [ -x "$ROOT/bin/wire-engines.py" ]; then
  python3 "$ROOT/bin/wire-engines.py" || true
fi
echo "$NOTES"
echo "ReelOS $REMOTE applied."
