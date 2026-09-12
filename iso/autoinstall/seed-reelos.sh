#!/bin/bash
# Layout ReelOS under /opt/reelos on a freshly installed Ubuntu.
# Prefer GitHub `main` so a baked USB still lands current gold.
# The disc bundle is the fallback when GitHub is unreachable.
#
# Never writes /var/lib/reelos/provisioned.
# Never plants a TorBox key or wizard admin PIN.
set -u

ROOT="${REELOS_ROOT:-/opt/reelos}"
SEED="${REELOS_SEED:-/opt/reelos/seed}"
STATE="${REELOS_STATE:-/var/lib/reelos}"
GITHUB_TARBALL="${REELOS_GITHUB_TARBALL:-https://github.com/ajt1995/reelos/archive/refs/heads/main.tar.gz}"

mkdir -p "$ROOT/app" "$ROOT/bin" "$SEED" "$STATE"

layout_from_repo() {
  local src="$1"
  if [ ! -d "$src" ]; then
    echo "ReelOS seed: source dir missing: $src" >&2
    return 1
  fi
  mkdir -p "$ROOT/app" "$ROOT/bin"
  if [ -d "$src/install" ]; then
    cp -a "$src/install/." "$ROOT/"
  fi
  if [ -f "$ROOT/reelos-install.sh" ]; then
    cp "$ROOT/reelos-install.sh" "$ROOT/install.sh"
  fi
  chmod 755 "$ROOT/install.sh" "$ROOT/reelos-install.sh" 2>/dev/null || true
  local rel
  for rel in package.json package-lock.json tsconfig.json vite.config.ts src scripts server public channel.json channel-beta.json prebuilt VERSION; do
    if [ -e "$src/$rel" ]; then
      rm -rf "$ROOT/app/$rel"
      cp -a "$src/$rel" "$ROOT/app/$rel"
    fi
  done
  if [ -f "$src/VERSION" ]; then
    cp "$src/VERSION" "$ROOT/VERSION"
  fi
  mkdir -p "$ROOT/app"
  printf '1\n' >"$ROOT/app/.reelos-appliance"
  if [ ! -f "$ROOT/install.sh" ]; then
    echo "ReelOS seed: layout produced no install.sh" >&2
    return 1
  fi
  echo "ReelOS seed: laid out $ROOT from repo tree"
  return 0
}

fetch_github() {
  local tmp tarball
  tmp=$(mktemp -d)
  tarball="$tmp/main.tar.gz"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --retry-delay 2 --max-time 180 "$GITHUB_TARBALL" -o "$tarball" || {
      rm -rf "$tmp"
      return 1
    }
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$tarball" --timeout=180 --tries=3 "$GITHUB_TARBALL" || {
      rm -rf "$tmp"
      return 1
    }
  else
    rm -rf "$tmp"
    return 1
  fi
  if ! tar -tzf "$tarball" >/dev/null 2>&1; then
    echo "ReelOS seed: GitHub payload was not a tarball" >&2
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

use_bundle() {
  local bundle="$SEED/reelos-bundle.tar.gz"
  [ -f "$bundle" ] || return 1
  tar -C "$ROOT" --strip-components=1 -xzf "$bundle"
  [ -f "$ROOT/install.sh" ] || return 1
  mkdir -p "$ROOT/app"
  [ -f "$ROOT/app/.reelos-appliance" ] || printf '1\n' >"$ROOT/app/.reelos-appliance"
  echo "ReelOS seed: laid out $ROOT from disc bundle"
  return 0
}

# Fixture / local tree wins (tests and sideload). Then GitHub main. Then disc bundle.
if [ -n "${REELOS_SRC:-}" ]; then
  layout_from_repo "$REELOS_SRC" || exit 1
  echo "ReelOS seed: local tree"
elif fetch_github; then
  echo "ReelOS seed: GitHub main"
elif use_bundle; then
  echo "ReelOS seed: bundled tarball"
else
  echo "ReelOS seed: failed (no GitHub, no bundle)" >&2
  exit 1
fi

# Fresh disk: wizard must run. Never stamp provisioned here.
rm -f "$STATE/provisioned" "$STATE/answers.json" 2>/dev/null || true
chmod 755 "$ROOT/bin/"* "$ROOT/install.sh" 2>/dev/null || true
exit 0
