#!/bin/bash
# Install ReelOS on a stock Ubuntu 24.04/26.04 box (same stack as the USB).
#
#   curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/scripts/install-reelos.sh | sudo bash
#   sudo bash scripts/install-reelos.sh
#
# Fetches GitHub main.tar.gz (or uses a local clone), lays out /opt/reelos,
# installs Docker + Caddy + OpenSSH, enables firstboot once, serves the
# 7-step wizard on :80. No secrets. Does not skip the wizard.
#
# Fresh Ubuntu only. Will not run on a provisioned house. Will not wipe
# /media. Will not delete ota.lock. Will not download an Ubuntu ISO.
set -euo pipefail

GITHUB_TARBALL="${REELOS_GITHUB_TARBALL:-https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz}"
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE="${REELOS_STATE:-/var/lib/reelos}"
DRY=0
if [ "${REELOS_DRY_RUN:-}" = "1" ]; then
  DRY=1
fi

usage() {
  cat <<'EOF'
Install ReelOS on a stock Ubuntu LTS box.

  curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/scripts/install-reelos.sh | sudo bash
  sudo bash scripts/install-reelos.sh
  REELOS_DRY_RUN=1 bash scripts/install-reelos.sh

Does not download an Ubuntu ISO. Does not wipe /media. Does not delete ota.lock.
Wizard stays seven steps. TorBox key and admin PIN are typed there, not here.
Detects hardware. zram on rotational disk. Does not reserve 512M kdump on ≤4.5Gi RAM.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

log() { echo "ReelOS install: $*"; }

is_dry() { [ "$DRY" -eq 1 ]; }

need_root() {
  if is_dry; then
    return 1
  fi
  if [ -n "${REELOS_ROOT:-}" ]; then
    return 1
  fi
  [ "${EUID:-$(id -u)}" -ne 0 ]
}

if need_root; then
  echo "Run as root: sudo bash $0" >&2
  echo "Or: curl -fsSL https://raw.githubusercontent.com/ajt1995/reelos/main/scripts/install-reelos.sh | sudo bash" >&2
  exit 1
fi

mkdir -p "$STATE" "$ROOT"

if [ -f "$STATE/provisioned" ]; then
  echo "This box is already provisioned. This installer is for a fresh Ubuntu." >&2
  echo "Do not re-run the wizard. Do not enable firstboot. Use Settings → Updates → Apply." >&2
  echo "Will not wipe /media. Will not delete ota.lock." >&2
  exit 1
fi

if [ -f "$STATE/ota.lock" ]; then
  echo "ota.lock is present. An Apply is running or was interrupted." >&2
  echo "Will not delete ota.lock. Will not install over it." >&2
  exit 1
fi

script_dir=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

src="${REELOS_SRC:-}"
if [ -z "$src" ] && [ -n "$script_dir" ] && [ -f "$script_dir/../install/reelos-install.sh" ]; then
  src="$(cd "$script_dir/.." && pwd)"
fi

layout_from_repo() {
  local tree="$1"
  if [ ! -d "$tree" ]; then
    echo "ReelOS install: source dir missing: $tree" >&2
    return 1
  fi
  mkdir -p "$ROOT/app" "$ROOT/bin"
  if [ -d "$tree/install" ]; then
    cp -a "$tree/install/." "$ROOT/"
  fi
  if [ -f "$ROOT/reelos-install.sh" ]; then
    cp "$ROOT/reelos-install.sh" "$ROOT/install.sh"
  fi
  chmod 755 "$ROOT/install.sh" "$ROOT/reelos-install.sh" 2>/dev/null || true
  local rel
  for rel in package.json package-lock.json tsconfig.json vite.config.ts src scripts server public channel.json channel-beta.json prebuilt VERSION; do
    if [ -e "$tree/$rel" ]; then
      rm -rf "$ROOT/app/$rel"
      cp -a "$tree/$rel" "$ROOT/app/$rel"
    fi
  done
  if [ -f "$tree/VERSION" ]; then
    cp "$tree/VERSION" "$ROOT/VERSION"
  fi
  mkdir -p "$ROOT/app"
  printf '1\n' >"$ROOT/app/.reelos-appliance"
  if [ ! -f "$ROOT/install.sh" ]; then
    echo "ReelOS install: layout produced no install.sh" >&2
    return 1
  fi
  log "laid out $ROOT from repo tree"
}

fetch_github() {
  local tmp tarball
  tmp=$(mktemp -d)
  tarball="$tmp/main.tar.gz"
  log "fetching GitHub main tarball"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --retry-delay 2 --max-time 180 "$GITHUB_TARBALL" -o "$tarball" || {
      rm -rf "$tmp"
      return 1
    }
  else
    echo "ReelOS install: curl is required to fetch GitHub main" >&2
    rm -rf "$tmp"
    return 1
  fi
  if ! tar -tzf "$tarball" >/dev/null 2>&1; then
    echo "ReelOS install: GitHub payload was not a tarball" >&2
    rm -rf "$tmp"
    return 1
  fi
  mkdir -p "$tmp/src"
  tar -xzf "$tarball" -C "$tmp/src" --strip-components=1
  layout_from_repo "$tmp/src"
  local st=$?
  rm -rf "$tmp"
  return $st
}

if [ -n "$src" ]; then
  layout_from_repo "$src"
  log "local tree"
elif is_dry; then
  log "dry-run: would fetch $GITHUB_TARBALL"
else
  fetch_github
  log "GitHub main"
fi

# Belt: never skip the 7-step wizard. Never plant keys.
rm -f "$STATE/provisioned" "$STATE/answers.json" 2>/dev/null || true
# Never: rm ota.lock. Never: wipe /media.
chmod 755 "$ROOT/bin/"* "$ROOT/install.sh" 2>/dev/null || true

# USB seed can carry reelos_os_tune.py next to this script (nocloud).
# Apply even when GitHub main.tar.gz is older than this installer.
tune_os() {
  local py="" cand
  for cand in \
    "${script_dir:+$script_dir/reelos_os_tune.py}" \
    "/opt/reelos/seed/reelos_os_tune.py" \
    "$ROOT/bin/reelos_os_tune.py"; do
    [ -n "$cand" ] && [ -f "$cand" ] && py="$cand" && break
  done
  if [ -n "$py" ]; then
    if is_dry; then
      log "dry-run: would run os tune (zram on rotational; no 512M kdump on ≤4.5Gi)"
      return 0
    fi
    python3 "$py" --apply || log "os tune non-fatal"
    return 0
  fi
  # Bash fallback when the USB seed is install-reelos.sh alone.
  local mem_kb=0 rota=0 src name
  mem_kb=$(awk '/^MemTotal:/{print $2; exit}' /proc/meminfo 2>/dev/null || echo 0)
  src=$(findmnt -n -o SOURCE / 2>/dev/null || true)
  name=$(basename "$src")
  name="${name%%[0-9]*}"
  if [ -n "$name" ] && [ -f "/sys/block/$name/queue/rotational" ]; then
    rota=$(cat "/sys/block/$name/queue/rotational" 2>/dev/null || echo 0)
  fi
  if is_dry; then
    log "dry-run: would run os tune (zram on rotational; no 512M kdump on ≤4.5Gi)"
    return 0
  fi
  if [ "${rota:-0}" = "1" ]; then
    apt-get install -y --no-install-recommends systemd-zram-generator >/dev/null 2>&1 || true
    mkdir -p /etc
    cat >/etc/systemd/zram-generator.conf <<'ZRAM'
# ReelOS — zram on rotational disk. Do not copy TorBox dumps here.
[zram0]
zram-size = min(ram / 2, 2048)
compression-algorithm = zstd
swap-priority = 100
ZRAM
    log "zram on rotational disk"
  fi
  if [ "${mem_kb:-0}" -gt 0 ] && [ "$mem_kb" -le 4718592 ]; then
    mkdir -p /etc/default/grub.d
    cat >/etc/default/grub.d/reelos-nokdump.cfg <<'GRUB'
# ReelOS — do not reserve 512M kdump on ≤4.5Gi RAM.
GRUB_CMDLINE_LINUX_DEFAULT="${GRUB_CMDLINE_LINUX_DEFAULT} crashkernel=no"
GRUB
    printf 'USE_KDUMP=0\n' >/etc/default/kdump-tools 2>/dev/null || true
    update-grub >/dev/null 2>&1 || true
    systemctl disable --now kdump-tools >/dev/null 2>&1 || true
    log "do not reserve 512M kdump on ≤4.5Gi"
  fi
}

if is_dry; then
  log "dry-run: would install Docker, Caddy, OpenSSH"
  log "dry-run: would enable reelos-firstboot once"
  log "dry-run: would put the 7-step wizard on :80"
  log "dry-run: would not stamp provisioned, would not wipe /media, would not delete ota.lock"
  tune_os
  if [ ! -f "$ROOT/install.sh" ]; then
    log "dry-run: install.sh not laid out (no local tree / no fetch)"
  fi
  exit 0
fi

if [ ! -x "$ROOT/install.sh" ] && [ ! -f "$ROOT/install.sh" ]; then
  echo "ReelOS install: missing $ROOT/install.sh" >&2
  exit 1
fi

tune_os

bash "$ROOT/install.sh" || echo failed >"$STATE/install-failed"

# Firstboot once on this fresh disk so a half-finished late-command can finish.
# ConditionPathExists=!stack-installed — a finished install.sh is a no-op.
if [ ! -f "$STATE/provisioned" ]; then
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable reelos-firstboot.service 2>/dev/null || true
  fi
fi

if [ -f "$STATE/provisioned" ]; then
  echo "install.sh left provisioned — removing so the 7-step wizard runs" >&2
  rm -f "$STATE/provisioned"
fi

log "Docker + Caddy + ReelOS staged. Wizard is on :80 after reboot."
log "Open http://reelos.local — seven steps. Paste a TorBox key there."
log "Did not wipe /media. Did not delete ota.lock. Did not plant secrets."
exit 0
