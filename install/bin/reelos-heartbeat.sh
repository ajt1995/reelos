#!/bin/bash
# ReelOS Anonymous Fleet Heartbeat
# Collects zero PII: machine-id is salted SHA-256 hashed, no IPs, no keys, no names.
set -euo pipefail

ROOT="${REELOS_ROOT:-/opt/reelos}"
STATE=/var/lib/reelos

VERSION=$(cat "$ROOT/VERSION" 2>/dev/null || cat "$STATE/installed-version" 2>/dev/null || echo "unknown")
APPLIED_SHA=$(cat "$STATE/applied-sha" 2>/dev/null || echo "none")

# Salted anonymous machine identifier (one-way SHA-256)
RAW_ID=""
if [ -f /etc/machine-id ]; then
  RAW_ID=$(cat /etc/machine-id 2>/dev/null || true)
elif [ -f /var/lib/dbus/machine-id ]; then
  RAW_ID=$(cat /var/lib/dbus/machine-id 2>/dev/null || true)
fi
if [ -z "$RAW_ID" ]; then
  RAW_ID="reelos-$(uname -n 2>/dev/null || echo default)"
fi
ANON_ID=$(printf '%s:reelos-fleet-salt' "$RAW_ID" | sha256sum 2>/dev/null | awk '{print $1}' | cut -c1-32 || echo "0000000000000000")

# Channel
CHANNEL="stable"
if [ -f "$STATE/ui-settings.json" ]; then
  if grep -q '"betaChannel": *true' "$STATE/ui-settings.json" 2>/dev/null; then
    CHANNEL="beta"
  fi
fi

# Hardware profile
RAM_MB=$(awk '/MemTotal:/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
DISK_KIND="unknown"
if [ -f "$STATE/hardware-profile.json" ]; then
  DISK_KIND=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("disk_kind") or "unknown")' "$STATE/hardware-profile.json" 2>/dev/null || echo "unknown")
fi

UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)
ARCH=$(uname -m 2>/dev/null || echo "unknown")

# Engine health summary (booleans only)
JF_OK="false"
curl -fsS --max-time 2 http://127.0.0.1:8096/System/Info/Public >/dev/null 2>&1 && JF_OK="true"

DOOR_OK="false"
curl -fsS --max-time 2 http://127.0.0.1:8080/api/ready >/dev/null 2>&1 && DOOR_OK="true"

DEBRID_OK="false"
if timeout 2 stat /mnt/debrid/__all__ >/dev/null 2>&1 || timeout 2 stat /mnt/debrid/version.txt >/dev/null 2>&1; then
  DEBRID_OK="true"
fi

# JSON payload
PAYLOAD=$(python3 -c '
import json, sys
anon_id, ver, sha, chan, ram, disk, arch, uptime, jf, door, debrid = sys.argv[1:12]
doc = {
    "box_id": anon_id,
    "version": ver,
    "sha": sha[:12] if sha != "none" else "",
    "channel": chan,
    "ram_mb": int(ram or 0),
    "disk_kind": disk,
    "arch": arch,
    "uptime_seconds": int(uptime or 0),
    "services": {
        "door": door == "true",
        "jellyfin": jf == "true",
        "debrid": debrid == "true",
    }
}
print(json.dumps(doc))
' "$ANON_ID" "$VERSION" "$APPLIED_SHA" "$CHANNEL" "$RAM_MB" "$DISK_KIND" "$ARCH" "$UPTIME_SEC" "$JF_OK" "$DOOR_OK" "$DEBRID_OK" 2>/dev/null || echo '{}')

# Write locally for diagnostics
mkdir -p "$STATE"
echo "$PAYLOAD" > "$STATE/heartbeat-last.json" 2>/dev/null || true

# Send to fleet endpoint (fails silently if offline or endpoint not reachable)
ENDPOINT="${REELOS_HEARTBEAT_URL:-https://api.reelos.org/api/v1/heartbeat}"
if [ -f "$STATE/heartbeat-url" ]; then
  ENDPOINT=$(cat "$STATE/heartbeat-url" 2>/dev/null | tr -d '\r\n' || true)
fi

if [ -n "$ENDPOINT" ] && [ "$PAYLOAD" != "{}" ]; then
  curl -fsSL --ipv4 --max-time 10 -A "ReelOS-Heartbeat/$VERSION" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" "$ENDPOINT" >/dev/null 2>&1 || true
fi
