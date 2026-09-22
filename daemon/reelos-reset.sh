#!/bin/bash
# First-run reset. Does not delete /srv/media or Docker images. Does not run during OTA.
set -euo pipefail
if [ "${REELOS_OTA:-}" = "1" ]; then
  echo "reset refused: OTA"
  exit 1
fi
if pgrep -f "reelos-update.sh" >/dev/null 2>&1; then
  echo "reset refused: OTA running"
  exit 1
fi
ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos
LOG="$STATE/reset.log"
mkdir -p "$STATE"
echo "---- $(date -Is) reset ----" >>"$LOG"
sleep 2
if [ -f "$ROOT/compose/docker-compose.yml" ]; then
  (cd "$ROOT/compose" && docker compose down --remove-orphans) >>"$LOG" 2>&1 || true
fi
rm -f "$STATE/provisioned" "$STATE/answers.json" "$STATE/engine.json"
rm -rf "$ROOT/compose/configs"
mkdir -p "$ROOT/compose/configs/jellyfin/config"
# Soft-reset must not leave JF on a first-run with docker LocalAddress 172.18.x.
cat >"$ROOT/compose/configs/jellyfin/config/network.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<NetworkConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EnableUPnP>false</EnableUPnP>
  <EnableIPv4>true</EnableIPv4>
  <EnableIPv6>false</EnableIPv6>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <RequireHttps>false</RequireHttps>
  <AutoDiscovery>true</AutoDiscovery>
  <EnablePublishedServerUriByRequest>true</EnablePublishedServerUriByRequest>
</NetworkConfiguration>
XML
# No GPU: DirectPlay/DirectStream only. VAAPI when /dev/dri has a render/card node.
ACCEL=none
HW=false
HEVC=false
if ls /dev/dri/renderD* /dev/dri/card* >/dev/null 2>&1; then
  ACCEL=vaapi
  HW=true
  HEVC=true
fi
cat >"$ROOT/compose/configs/jellyfin/config/encoding.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<EncodingOptions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EncodingThreadCount>1</EncodingThreadCount>
  <EnableThrottling>true</EnableThrottling>
  <EnableSegmentDeletion>true</EnableSegmentDeletion>
  <SegmentKeepSeconds>60</SegmentKeepSeconds>
  <HardwareAccelerationType>${ACCEL}</HardwareAccelerationType>
  <EnableHardwareEncoding>${HW}</EnableHardwareEncoding>
  <EnableSubtitleExtraction>false</EnableSubtitleExtraction>
  <EncoderPreset>veryfast</EncoderPreset>
  <AllowHevcEncoding>${HEVC}</AllowHevcEncoding>
  <VaapiDevice>/dev/dri/renderD128</VaapiDevice>
</EncodingOptions>
XML
echo "reset: configs wiped; jellyfin network.xml re-seeded; encoding.xml DirectPlay/VAAPI" >>"$LOG"
systemctl restart reelos >>"$LOG" 2>&1 || true
echo "reset done" >>"$LOG"
