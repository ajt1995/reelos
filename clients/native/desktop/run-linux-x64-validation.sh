#!/bin/sh
# Isolated validation artifact. Requires system Java 17 and LibVLC with its plugins.
set -eu
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) ;;
  *) echo "This validation bundle requires Linux x86_64." >&2; exit 1 ;;
esac
bundle_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REELOS_NATIVE_DATA=${REELOS_NATIVE_DATA:-"$bundle_dir/data"}
export REELOS_NATIVE_DATA
mkdir -p "$REELOS_NATIVE_DATA"
# OpenJDK's X11 bridge must not wait for reparent events under Wayland compositors
# such as Cage. Without this, the HP rendered only its initial 800x600 surface and
# did not process the expected UI interaction. Keep traditional X11 sessions alone.
if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -z "${_JAVA_AWT_WM_NONREPARENTING:-}" ]; then
    _JAVA_AWT_WM_NONREPARENTING=1
    export _JAVA_AWT_WM_NONREPARENTING
fi
exec java -cp "$bundle_dir/lib/*" com.reelos.desktop.MainKt "$@"
