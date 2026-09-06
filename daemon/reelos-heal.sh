#!/bin/bash
# Heal a provisioned ReelOS box. Does not re-run the wizard. Does not wipe answers.
#
#   curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/reelos-heal.sh | sudo bash
#
set -uo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT=/opt/reelos
COMPOSE="$ROOT/compose"
STATE=/var/lib/reelos
APP="$ROOT/app"

echo "ReelOS · heal (keep wizard answers)"

mkdir -p "$COMPOSE/configs/jellyfin" "$COMPOSE/configs/decypharr" \
  /mnt/debrid /mnt/symlinks /srv/media/movies /srv/media/tv /srv/media/anime /srv/media/music
modprobe fuse 2>/dev/null || true
mount --make-rshared /mnt 2>/dev/null || true
chown -R 1000:1000 "$COMPOSE/configs" /mnt/debrid /mnt/symlinks /srv/media 2>/dev/null || true

# Pull the compose file that no longer sets user: on jellyfin/decypharr.
if curl -fsSL "https://raw.githubusercontent.com/ajt1995/reelos/main/install/compose/docker-compose.yml" \
  -o "$COMPOSE/docker-compose.yml.new"; then
  mv "$COMPOSE/docker-compose.yml.new" "$COMPOSE/docker-compose.yml"
fi

# Drop fuse devices if the kernel has no /dev/fuse — otherwise compose never starts.
if [ ! -e /dev/fuse ]; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/opt/reelos/compose/docker-compose.yml")
t = p.read_text()
t = t.replace("    devices:\n      - /dev/fuse:/dev/fuse:rwm\n", "")
p.write_text(t)
print("heal: stripped fuse device (no /dev/fuse)")
PY
fi

# Refresh the shell search path without touching answers.
for f in src/lib/appliance.ts src/lib/catalog.ts src/components/home-view.tsx src/components/discover-view.tsx; do
  dest="$APP/$f"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "https://raw.githubusercontent.com/ajt1995/reelos/main/$f" -o "$dest" || true
done

if [ -x "$ROOT/bin/wire-engines.py" ]; then
  python3 "$ROOT/bin/wire-engines.py" || true
elif [ -f /tmp/wire-engines.py ]; then
  python3 /tmp/wire-engines.py || true
else
  curl -fsSL "https://raw.githubusercontent.com/ajt1995/reelos/main/daemon/wire-engines.py" \
    -o /tmp/wire-engines.py && python3 /tmp/wire-engines.py || true
fi

if [ -f "$COMPOSE/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$COMPOSE/.env"
  set +a
fi
cd "$COMPOSE"
docker compose up -d --remove-orphans || true
sleep 4
echo
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
if command -v systemctl >/dev/null; then
  systemctl restart reelos || true
fi
echo
echo "Search Batman on http://$(hostname -I | awk '{print $1}'):8080"
