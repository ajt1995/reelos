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
APP="$ROOT/app"
RAW=https://raw.githubusercontent.com/ajt1995/reelos/main

echo "ReelOS · heal (keep wizard answers)"

mkdir -p "$COMPOSE/configs/jellyfin" "$COMPOSE/configs/decypharr" "$COMPOSE/configs/seerr" "$ROOT/bin" \
  /mnt/debrid /mnt/symlinks /mnt/symlinks/radarr /mnt/symlinks/sonarr \
  /srv/media/movies /srv/media/tv /srv/media/anime /srv/media/music
modprobe fuse 2>/dev/null || true
mount --make-rshared /mnt 2>/dev/null || true
chown -R 1000:1000 "$COMPOSE/configs" /mnt/debrid /mnt/symlinks /srv/media 2>/dev/null || true

pull() {
  local url="$1" dest="$2"
  local tmp
  tmp="$(mktemp)"
  if curl -fsSL "$url" -o "$tmp"; then
    mkdir -p "$(dirname "$dest")"
    mv "$tmp" "$dest"
    return 0
  fi
  rm -f "$tmp"
  echo "heal: skip $dest (not on GitHub yet)" >&2
  return 1
}

# Compose that no longer sets user: on jellyfin/decypharr.
pull "$RAW/install/compose/docker-compose.yml" "$COMPOSE/docker-compose.yml" || true

# Drop fuse devices if the kernel has no /dev/fuse — otherwise compose never starts.
# Exact block only — do not strip gluetun's /dev/net/tun.
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

# Search + engine lookup. Never touch answers.json.
for f in src/lib/appliance.ts src/lib/catalog.ts src/components/home-view.tsx src/components/discover-view.tsx; do
  pull "$RAW/$f" "$APP/$f" || true
done

# Always take GitHub wire-engines (ISO copy still sets use_webdav).
# The shim execs wire-engines.parts — pulling only the loader bricks heal.
pull "$RAW/daemon/wire-engines.py" "$ROOT/bin/wire-engines.py" || true
chmod +x "$ROOT/bin/wire-engines.py" 2>/dev/null || true
mkdir -p "$ROOT/bin/wire-engines.parts"
for i in 00 01 02 03 04 05 06 07 08 09; do
  pull "$RAW/daemon/wire-engines.parts/$i.part" "$ROOT/bin/wire-engines.parts/$i.part" || true
done
pull "$RAW/daemon/relink_dumps.py" "$ROOT/bin/relink_dumps.py" || true
pull "$RAW/daemon/sonarr_manual_import.py" "$ROOT/bin/sonarr_manual_import.py" || true
pull "$RAW/daemon/stuck-downloads.py" "$ROOT/bin/stuck-downloads.py" || true
pull "$RAW/daemon/public_indexers.py" "$ROOT/bin/public_indexers.py" || true

if [ -f "$COMPOSE/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$COMPOSE/.env"
  set +a
fi
cd "$COMPOSE"
docker compose up -d --remove-orphans || true

if [ -f "$ROOT/bin/wire-engines.py" ]; then
  python3 "$ROOT/bin/wire-engines.py" || true
fi

sleep 6
echo
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
if command -v systemctl >/dev/null; then
  systemctl restart reelos || true
fi
echo
echo "Search Batman on http://$(hostname -I | awk '{print $1}'):8080"
echo "Wizard answers were not touched."
