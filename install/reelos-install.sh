#!/usr/bin/env bash
# ReelOS native appliance installer for Ubuntu 24.04+ and Debian 12+.
# Installs one Node appliance and its Jellyfin protocol shim. It does not
# install Docker, Jellyfin, Seerr, Sonarr, Radarr, Prowlarr or Decypharr.
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT=/opt/reelos
STATE=/var/lib/reelos
LOG="$STATE/install.log"

mkdir -p "$STATE"
chmod 700 "$STATE"
exec > >(tee -a "$LOG") 2>&1

echo "ReelOS · installing the native appliance"

systemd_live() { systemctl is-system-running >/dev/null 2>&1; }
enable_unit() {
  systemctl enable "$1" >/dev/null 2>&1 || true
  if systemd_live; then systemctl restart "$1" || true; fi
}

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg avahi-daemon avahi-utils caddy ffmpeg \
  python3 unzip tar ufw

node_major() { node -p "parseInt(process.versions.node,10)||0" 2>/dev/null || echo 0; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

hostnamectl set-hostname reelos 2>/dev/null || true
grep -qE '(^|[[:space:]])reelos([[:space:]]|$)' /etc/hosts || \
  echo "127.0.1.1 reelos reelos.local" >>/etc/hosts

mkdir -p "$ROOT" "$ROOT/bin" "$STATE" /srv/media
if [ "$HERE" != "$ROOT" ]; then
  test -d "$HERE/app" || { echo "The ReelOS app bundle is missing." >&2; exit 1; }
  rm -rf "$ROOT/app.new"
  cp -a "$HERE/app" "$ROOT/app.new"
  rm -rf "$ROOT/app.previous"
  if [ -d "$ROOT/app" ]; then mv "$ROOT/app" "$ROOT/app.previous"; fi
  mv "$ROOT/app.new" "$ROOT/app"
  if [ -d "$HERE/bin" ]; then cp -a "$HERE/bin/." "$ROOT/bin/"; fi
  if [ -d "$HERE/systemd" ]; then
    mkdir -p "$ROOT/systemd"
    cp -a "$HERE/systemd/." "$ROOT/systemd/"
  fi
  if [ -f "$HERE/VERSION" ]; then cp "$HERE/VERSION" "$ROOT/VERSION"; fi
fi

cd "$ROOT/app"
npm ci --omit=dev --no-audit --no-fund

# Manual Day-0 install establishes the first active release. It intentionally
# does not create a signing key or trust an update key on the owner's behalf.
APP_VERSION="$(node -p "require('$ROOT/app/package.json').version")"
node - "$ROOT" "$APP_VERSION" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [root, version] = process.argv.slice(2);
const target = path.join(root, 'current.json');
const temporary = `${target}.tmp-${process.pid}`;
fs.writeFileSync(temporary, JSON.stringify({ version, path: path.join(root, 'app'), bootstrap: 'manual-day0' }, null, 2) + '\n', { mode: 0o600 });
fs.renameSync(temporary, target);
NODE

install -m 0644 "$HERE/systemd/reelos.service" /etc/systemd/system/reelos.service
if [ -f "$HERE/systemd/reelos-selfheal.service" ]; then
  install -m 0644 "$HERE/systemd/reelos-selfheal.service" /etc/systemd/system/reelos-selfheal.service
fi
if [ -f "$HERE/systemd/reelos-selfheal.timer" ]; then
  install -m 0644 "$HERE/systemd/reelos-selfheal.timer" /etc/systemd/system/reelos-selfheal.timer
fi
if [ -f "$HERE/avahi/reelos.service" ]; then
  install -m 0644 "$HERE/avahi/reelos.service" /etc/avahi/services/reelos.service
fi
if [ -f "$ROOT/bin/reelos-selfheal.sh" ]; then chmod 0755 "$ROOT/bin/reelos-selfheal.sh"; fi
if [ -f "$ROOT/bin/reelos_hardware.py" ]; then
  chmod 0755 "$ROOT/bin/reelos_hardware.py"
  python3 "$ROOT/bin/reelos_hardware.py" --ensure || true
fi

cat >/etc/caddy/Caddyfile <<'CADDY'
:80 {
  encode gzip
  reverse_proxy 127.0.0.1:8080
}
CADDY

ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 8080/tcp || true
# 8096 is ReelOS's compatibility shim for household media clients.
ufw allow 8096/tcp || true

systemctl daemon-reload
enable_unit avahi-daemon
enable_unit caddy
enable_unit reelos
if [ -f /etc/systemd/system/reelos-selfheal.timer ]; then enable_unit reelos-selfheal.timer; fi

rm -f "$STATE/install-failed"
echo 1 >"$STATE/native-installed"

echo
echo "ReelOS is ready at http://reelos.local"
echo "Open it from an authorized household device to finish setup."
