#!/usr/bin/env bash
# Build an unsigned Apple Silicon app bundle from the current checkout only.
# The shared boundary excludes .reelos-state, private presets, credentials,
# retired server-stack paths, nested artifacts, and test-only sources.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_APP="$SCRIPT_DIR/ReelOS-Mac.app"
OUTPUT_APP="${REELOS_MAC_OUTPUT:-$ROOT_DIR/dist-macos/ReelOS-Mac.app}"
REPLACE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_APP="$2"; shift 2 ;;
    --replace) REPLACE=1; shift ;;
    *) echo "Usage: $0 [--output <ReelOS-Mac.app>] [--replace]" >&2; exit 2 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "Apple Silicon packaging requires a native Darwin arm64 host; no package was created." >&2
  exit 1
fi
if [[ ! -f "$ROOT_DIR/package.json" || ! -f "$ROOT_DIR/scripts/reelos-box.mjs" ]]; then
  echo "Current checkout is incomplete; refusing to package a guessed runtime path." >&2
  exit 1
fi
if [[ ! -d "$TEMPLATE_APP" ]]; then
  echo "App bundle template is missing: $TEMPLATE_APP" >&2
  exit 1
fi
for prerequisite in ditto node python3; do
  if ! command -v "$prerequisite" >/dev/null 2>&1; then
    echo "Apple Silicon packaging requires $prerequisite; no package was created." >&2
    exit 1
  fi
done

OUTPUT_APP="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$OUTPUT_APP")"
case "$OUTPUT_APP" in
  "$ROOT_DIR"/dist-macos/*) ;;
  *) echo "Output must remain under $ROOT_DIR/dist-macos" >&2; exit 1 ;;
esac
if [[ -e "$OUTPUT_APP" ]]; then
  if [[ "$REPLACE" != "1" ]]; then
    echo "Refusing to overwrite $OUTPUT_APP; pass --replace for this generated artifact." >&2
    exit 1
  fi
  rm -rf -- "$OUTPUT_APP"
fi

mkdir -p "$(dirname "$OUTPUT_APP")"
ditto "$TEMPLATE_APP" "$OUTPUT_APP"
RUNTIME="$OUTPUT_APP/Contents/Resources/reelos-runtime"
mkdir -p "$RUNTIME"
node "$ROOT_DIR/scripts/release-artifact-boundary.mjs" stage \
  --root "$ROOT_DIR" --artifact "$RUNTIME" --platform macos
chmod +x "$OUTPUT_APP/Contents/MacOS/ReelOS-Mac"

echo "Created unsigned Apple Silicon package: $OUTPUT_APP"
echo "No dependencies were downloaded, no app was installed or launched, and no household state was copied."
echo "The target Mac still needs a supported Node.js runtime; code signing and notarization are not performed here."
