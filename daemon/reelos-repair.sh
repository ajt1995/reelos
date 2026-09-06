#!/bin/bash
# Finish a ReelOS 1.2 disc that stopped short. Does not replace the app source
# already on the box (the ISO tree is complete; GitHub may still be filling in).
#
#   curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-repair.sh | sudo bash
#
set -uo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT=/opt/reelos
STATE=/var/lib/reelos
export DEBIAN_FRONTEND=noninteractive

mkdir -p "$STATE" "$ROOT" /etc/caddy
exec > >(tee -a "$STATE/repair.log") 2>&1

echo "ReelOS · repair (1.2 disc stopped short)"

if ! getent hosts archive.ubuntu.com >/dev/null 2>&1; then
  rm -f /etc/resolv.conf
  printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' >/etc/resolv.conf
fi

apt-get update -y || true
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg python3 tar unzip \
  avahi-daemon avahi-utils wpasupplicant rfkill \
  debian-keyring debian-archive-keyring || true

if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends caddy || true
fi
if ! command -v caddy >/dev/null 2>&1; then
  mkdir -p /usr/share/keyrings
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg || true
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    >/etc/apt/sources.list.d/caddy-stable.list || true
  apt-get update -y || true
  apt-get install -y caddy || true
fi

if [ -f "$ROOT/compose/Caddyfile" ]; then
  cp "$ROOT/compose/Caddyfile" /etc/caddy/Caddyfile
else
  cat >/etc/caddy/Caddyfile <<'EOF'
:80 {
	encode gzip
	handle /play* {
		reverse_proxy 127.0.0.1:8096
	}
	handle /advanced/downloads* {
		uri strip_prefix /advanced/downloads
		reverse_proxy 127.0.0.1:8282
	}
	handle {
		reverse_proxy 127.0.0.1:8080
	}
}
EOF
fi
systemctl enable --now caddy 2>/dev/null || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy || true

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh || true
fi
systemctl enable --now docker 2>/dev/null || true

if ! command -v npm >/dev/null 2>&1; then
  apt-get install -y nodejs npm || true
fi
if ! command -v npm >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - || true
  apt-get install -y nodejs || true
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is still missing. Cannot start the shell." >&2
  exit 1
fi

if [ ! -f "$ROOT/app/package.json" ]; then
  echo "No app at $ROOT/app. This repair expects the 1.2 disc tree." >&2
  exit 1
fi

echo "Installing app modules. This takes a few minutes."
(cd "$ROOT/app" && npm install --no-audit --no-fund) || {
  echo "npm install failed." >&2
  exit 1
}

if [ -f "$ROOT/systemd/reelos.service" ]; then
  cp "$ROOT/systemd/reelos.service" /etc/systemd/system/reelos.service
else
  cat >/etc/systemd/system/reelos.service <<'UNIT'
[Unit]
Description=ReelOS shell
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/opt/reelos/app

[Service]
Type=simple
WorkingDirectory=/opt/reelos/app
Environment=REELOS_APPLIANCE=1
Environment=REELOS_ROOT=/opt/reelos
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
ExecStart=/usr/bin/env npm run start:box
Restart=on-failure
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT
fi
if [ -f "$ROOT/systemd/reelos-console.service" ]; then
  cp "$ROOT/systemd/reelos-console.service" /etc/systemd/system/reelos-console.service
fi
systemctl daemon-reload || true
systemctl enable --now reelos
systemctl enable --now reelos-console 2>/dev/null || true
systemctl enable --now caddy 2>/dev/null || true
systemctl disable getty@tty1.service >/dev/null 2>&1 || true

echo 1 >"$STATE/stack-installed"
rm -f "$STATE/install-failed"

echo
echo "On your phone, open:"
ip -4 -br addr show | awk '$2 ~ /UP|UNKNOWN/ && $1 !~ /lo/{split($3,a,"/"); print "  http://" a[1]}'
echo "  http://reelos.local"
systemctl is-active reelos
