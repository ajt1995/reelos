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

# Wizard writes `provisioned` but historically never `stack-installed`.
# firstboot ConditionPathExists=!/var/lib/reelos/stack-installed and
# Restart=on-failure every 30s — latch and leave so a live house is a no-op.
if [ -f "$STATE/provisioned" ]; then
  echo 1 >"$STATE/stack-installed"
  echo "Already provisioned — stamped stack-installed; not re-running install; not enabling firstboot."
  exit 0
fi

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

# Point Caddy at ReelOS before the rest of the install. A half-finished
# box must never serve the factory welcome page on reelos.local.
apply_caddy() {
  local src=""
  if [ -f "$HERE/compose/Caddyfile" ]; then
    src="$HERE/compose/Caddyfile"
  elif [ -f "$ROOT/compose/Caddyfile" ]; then
    src="$ROOT/compose/Caddyfile"
  fi
  mkdir -p /etc/caddy
  if [ -n "$src" ]; then
    cp "$src" /etc/caddy/Caddyfile
  elif [ ! -f /etc/caddy/Caddyfile ]; then
    cat >/etc/caddy/Caddyfile <<'CADDY'
:80 {
	encode gzip
	handle {
		reverse_proxy 127.0.0.1:8080
	}
}
CADDY
  fi
  if systemd_live; then
    systemctl enable caddy >/dev/null 2>&1 || true
    if systemctl is-active --quiet caddy; then
      systemctl reload caddy >/dev/null 2>&1 || true
    else
      systemctl start caddy >/dev/null 2>&1 || true
    fi
  fi
}
apply_caddy

# Nested Docker (cloud/CI): overlay2 whiteouts fail with "operation not permitted".
# USB / bare metal keeps the default overlay2 driver. Never vfs on a real box.
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
  mkdir -p /etc/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    printf '%s\n' '{"storage-driver":"vfs"}' >/etc/docker/daemon.json
    echo "Nested container: Docker storage-driver vfs (overlay whiteouts are blocked here)."
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh || true
fi
enable_unit docker

# Node 22 — Ubuntu 24.04 apt is Node 18; start:box / Vite 8 need 20+.
# Do not settle for distro nodejs if it is too old (that left ExecStart on 18).
node_major() {
  node -p "parseInt(process.versions.node,10)||0" 2>/dev/null || echo 0
}
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - || true
  apt-get install -y nodejs || true
fi
if ! command -v npm >/dev/null 2>&1; then
  apt-get install -y nodejs npm || true
fi

hostnamectl set-hostname reelos 2>/dev/null || hostname reelos
if ! grep -q 'reelos' /etc/hosts; then
  echo "127.0.1.1 reelos reelos.local" >> /etc/hosts
fi

mkdir -p "$ROOT" "$STATE" \
  "$MEDIA/movies" "$MEDIA/tv" "$MEDIA/anime" "$MEDIA/music" "$MEDIA/downloads" \
  /mnt/debrid /mnt/symlinks

# Firstboot ExecStart is this script in /opt/reelos (HERE==ROOT). GNU cp
# dies with "are the same file" — that was the 1722-restart loop.
if [ "$HERE" != "$ROOT" ]; then
  if [ -d "$HERE/app" ]; then
    rm -rf "$ROOT/app"
    cp -a "$HERE/app" "$ROOT/app"
  fi
  if [ -d "$HERE/compose" ]; then
    rm -rf "$ROOT/compose"
    cp -a "$HERE/compose" "$ROOT/compose"
  fi
  mkdir -p "$ROOT/bin"
  if [ -d "$HERE/bin" ]; then
    cp -a "$HERE/bin/." "$ROOT/bin/"
  fi
fi
mkdir -p "$ROOT/bin" "$ROOT/compose/configs/decypharr"
if [ -d "$ROOT/bin" ]; then
  chmod 755 "$ROOT/bin/"* || true
fi

if [ -f "$ROOT/bin/reelos_hardware.py" ]; then
  python3 "$ROOT/bin/reelos_hardware.py" --ensure || true
fi

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
if [ -f "$HERE/systemd/reelos-selfheal.service" ]; then
  cp "$HERE/systemd/reelos-selfheal.service" /etc/systemd/system/reelos-selfheal.service
fi
if [ -f "$HERE/systemd/reelos-selfheal.timer" ]; then
  cp "$HERE/systemd/reelos-selfheal.timer" /etc/systemd/system/reelos-selfheal.timer
fi
if [ -f "$HERE/systemd/reelos-mnt-rshared.service" ]; then
  cp "$HERE/systemd/reelos-mnt-rshared.service" /etc/systemd/system/reelos-mnt-rshared.service
fi

apply_caddy

cd "$ROOT/app"
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || true
fi
chown -R 1000:1000 "$MEDIA" /mnt/debrid /mnt/symlinks || true

# Detect hardware. zram on rotational disk. Do not reserve 512M kdump on ≤4.5Gi.
# Never wipe /media. Never delete ota.lock.
if [ -f "$ROOT/bin/reelos_os_tune.py" ]; then
  python3 "$ROOT/bin/reelos_os_tune.py" --apply || echo "os tune non-fatal"
fi
if [ -f "$ROOT/bin/reelos_hardware.py" ]; then
  python3 "$ROOT/bin/reelos_hardware.py" --apply || echo "hardware profile non-fatal"
fi

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
if command -v npm >/dev/null 2>&1 && [ -d "$ROOT/app/node_modules" ]; then
  systemctl enable --now reelos || enable_unit reelos
else
  echo "npm or node_modules missing — reelos.service not started."
  enable_unit reelos
fi
if systemd_live; then
  systemctl enable caddy >/dev/null 2>&1 || true
  if systemctl is-active --quiet caddy; then
    systemctl reload caddy >/dev/null 2>&1 || true
  else
    systemctl start caddy >/dev/null 2>&1 || enable_unit caddy
  fi
else
  enable_unit caddy
fi

chmod 700 "$STATE"
rm -f "$STATE/install-failed"
echo 1 >"$STATE/stack-installed"
if [ -f "$HERE/VERSION" ] && [ "$HERE" != "$ROOT" ]; then
  cp "$HERE/VERSION" "$ROOT/VERSION"
fi
[ -f "$ROOT/VERSION" ] || echo 1.2.0 >"$ROOT/VERSION"
# ISO already enabled firstboot so a half-finished install can finish.
# Do not enable it on a box that already finished the wizard — Restart=on-failure
# loops install.sh if a later cp same-file exits 1.
if [ ! -f "$STATE/provisioned" ]; then
  enable_unit reelos-firstboot
fi
enable_unit reelos-console
systemctl enable reelos-lock-clients.timer >/dev/null 2>&1 || true
systemctl enable reelos-selfheal.timer >/dev/null 2>&1 || true
systemctl enable --now reelos-mnt-rshared >/dev/null 2>&1 || enable_unit reelos-mnt-rshared
if systemd_live; then
  systemctl start reelos-lock-clients.timer || true
  systemctl start reelos-selfheal.timer || true
  python3 /opt/reelos/bin/lock-download-clients.py || true
fi
systemctl disable getty@tty1.service >/dev/null 2>&1 || true

echo
echo "ReelOS is up."
echo "From another device on this network, open http://reelos.local"
echo "First boot is the seven-question wizard. Paste a TorBox key to ping the live account."
echo "This installer does not seed indexers and does not fetch copyrighted media."

