#!/usr/bin/env bash
# Signed ReelOS update entry point. There is no unsigned/network fallback.
set -euo pipefail
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE="${REELOS_STATE:-/var/lib/reelos}"
MANIFEST="${1:-}"
ARTIFACT="${2:-}"
if [ -z "$MANIFEST" ] || [ -z "$ARTIFACT" ]; then
  echo "Usage: reelos-update.sh SIGNED_MANIFEST ARTIFACT" >&2
  exit 64
fi
if [ ! -f "$STATE/release-trust.json" ]; then
  echo "Updates unavailable: complete the manual Day-0 release trust bootstrap first." >&2
  exit 78
fi
case "$(uname -s)" in Linux) PLATFORM=linux ;; MINGW*|MSYS*|CYGWIN*) PLATFORM=win32 ;; *) echo "Updates unavailable on this platform." >&2; exit 78 ;; esac
case "$(uname -m)" in x86_64|amd64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Updates unavailable for this architecture." >&2; exit 78 ;; esac
exec node "$ROOT/app/scripts/reelos-release-tool.mjs" apply \
  --manifest "$MANIFEST" --artifact "$ARTIFACT" --state "$STATE" --install "$ROOT" \
  --platform "$PLATFORM" --arch "$ARCH"
