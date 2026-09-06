#!/bin/bash
# ReelOS installer — run on a fresh Ubuntu 24.04/26.04 box.
#   sudo bash reelos-install.sh
# Safe under autoinstall (chroot): enables units, starts them only if systemd is live.
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT=/opt/reelos
STATE=/var/lib/reelos
MEDIA=/srv/media
LOG="$STATE/install.log"

mkdir -p "$STATE"
exec > >(tee -a "$LOG") 2>&1

echo "ReelOS · installing the appliance"

. /etc/os-release
case "${ID:-}-${VERSION_ID:-}" in
  ubuntu-24.*|ubuntu-25.*|ubuntu-26.*|debian-12*|debian-13*) ;;
  *)
    echo "This installer targets Ubuntu 24.04+ or Debian 12+. Found ${ID:-unknown} ${VERSION_ID:-}."
    echo "Continuing anyway."
    ;;
esac

export DEBIAN_FRONTEND=noninteractive

# Curtin/chroot: live resolv.conf is often systemd stub 127.0.0.53, which is dead in the target.
if ! getent hosts archive.ubuntu.com >/dev/null 2>&1; then
  rm -f /etc/resolv.conf
  printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' >/etc/resolv.conf
fi

systemd_live() {
  systemctl is-system-running >/dev/null 2>&1
}

enable_unit() {
  systemctl enable "$1" >/dev/null 2>&1 || true
  if systemd_live; then
    systemctl start "$1" || true
  fi
}

apt-get update -y

# universe: caddy lives here on some Ubuntu releases and nowhere on others
if command -v add-apt-repository >/dev/null 2>&1; then
  add-apt-repository -y universe || true
  apt-get update -y || true
fi

apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg avahi-daemon avahi-utils ufw \
  unzip tar python3 software-properties-common apt-transport-https \
  debian-keyring debian-archive-keyring \
  wpasupplicant rfkill || true

if ! apt-get install -y --no-install-recommends caddy; then
  echo "Caddy not in distro repos — trying the official package."
  mkdir -p /usr/share/keyrings
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    >/etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
enable_unit docker

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE 'v2[2-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

hostnamectl set-hostname reelos 2>/dev/null || hostname reelos
if ! grep -q 'reelos' /etc/hosts; then
  echo "127.0.1.1 reelos reelos.local" >> /etc/hosts
fi

mkdir -p "$ROOT" "$STATE" \
  "$MEDIA/movies" "$MEDIA/tv" "$MEDIA/anime" "$MEDIA/music" "$MEDIA/downloads" \
  /mnt/debrid /mnt/symlinks

if [ "$HERE" != "$ROOT" ]; then
  if [ -d "$HERE/app" ]; then
    rm -rf "$ROOT/app"
    cp -a "$HERE/app" "$ROOT/app"
  fi
  if [ -d "$HERE/compose" ]; then
    rm -rf "$ROOT/compose"
    cp -a "$HERE/compose" "$ROOT/compose"
  fi
fi
mkdir -p "$ROOT/compose/configs/decypharr"

if [ -d "$HERE/avahi" ]; then
  cp -a "$HERE/avahi/reelos.service" /etc/avahi/services/reelos.service
fi
enable_unit avahi-daemon

if [ -f "$HERE/systemd/reelos.service" ]; then
  cp "$HERE/systemd/reelos.service" /etc/systemd/system/reelos.service
fi
if [ -f "$HERE/systemd/reelos-firstboot.service" ]; then
  cp "$HERE/systemd/reelos-firstboot.service" /etc/systemd/system/reelos-firstboot.service
fi
if [ -f "$HERE/systemd/reelos-console.service" ]; then
  cp "$HERE/systemd/reelos-console.service" /etc/systemd/system/reelos-console.service
fi
if [ -f "$HERE/systemd/reelos-lock-clients.service" ]; then
  cp "$HERE/systemd/reelos-lock-clients.service" /etc/systemd/system/reelos-lock-clients.service
fi
if [ -f "$HERE/systemd/reelos-lock-clients.timer" ]; then
  cp "$HERE/systemd/reelos-lock-clients.timer" /etc/systemd/system/reelos-lock-clients.timer
fi
mkdir -p /opt/reelos/bin
if [ -d "$HERE/bin" ]; then
  cp -a "$HERE/bin/." /opt/reelos/bin/
  chmod 755 /opt/reelos/bin/* || true
fi

if [ -f "$HERE/compose/Caddyfile" ]; then
  mkdir -p /etc/caddy
  cp "$HERE/compose/Caddyfile" /etc/caddy/Caddyfile
fi

cd "$ROOT/app"
npm ci --no-audit --no-fund
chown -R 1000:1000 "$MEDIA" /mnt/debrid /mnt/symlinks || true

ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 22/tcp || true
# No BitTorrent on this box. *arrs talk to Decypharr only.
ufw deny 6881:6889/tcp || true
ufw deny 6881:6889/udp || true
ufw deny 51413/tcp || true
ufw deny 51413/udp || true

if systemd_live; then
  systemctl daemon-reload || true
fi
enable_unit reelos
enable_unit caddy
if systemd_live; then
  systemctl reload caddy || systemctl restart caddy || true
fi

chmod 700 "$STATE"
rm -f "$STATE/install-failed"
echo 1 >"$STATE/stack-installed"
[ -f "$HERE/VERSION" ] && cp "$HERE/VERSION" "$ROOT/VERSION"
[ -f "$ROOT/VERSION" ] || echo 1.2.0 >"$ROOT/VERSION"
enable_unit reelos-firstboot
enable_unit reelos-console
systemctl enable reelos-lock-clients.timer >/dev/null 2>&1 || true
if systemd_live; then
  systemctl start reelos-lock-clients.timer || true
  python3 /opt/reelos/bin/lock-download-clients.py || true
fi
systemctl disable getty@tty1.service >/dev/null 2>&1 || true

echo
echo "ReelOS is up."
echo "From another device on this network, open http://reelos.local"
echo "First boot is the seven-question wizard. Paste a Real-Debrid key to ping the live account."
echo "This installer does not seed indexers and does not fetch copyrighted media."
