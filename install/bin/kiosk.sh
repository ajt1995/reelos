#!/bin/bash
# Optional: fullscreen ReelOS if a display is present.
set -eu
if [ ! -e /dev/dri ] && [ ! -d /sys/class/drm ]; then
  exit 0
fi
bin=""
command -v chromium >/dev/null && bin=chromium
command -v chromium-browser >/dev/null && bin=chromium-browser
if [ -z "$bin" ]; then
  apt-get install -y --no-install-recommends chromium-browser >/dev/null 2>&1 || \
    apt-get install -y --no-install-recommends chromium >/dev/null 2>&1 || true
  command -v chromium >/dev/null && bin=chromium
  command -v chromium-browser >/dev/null && bin=chromium-browser
fi
[ -n "$bin" ] || exit 0
if command -v cage >/dev/null 2>&1; then
  exec cage -- "$bin" --kiosk --app=http://127.0.0.1
fi
exit 0
