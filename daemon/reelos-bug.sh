#!/bin/bash
# File a house bug snapshot. Called by OTA, Doctor, and the shell on failure.
set -u
STATE=/var/lib/reelos
ROOT="${REELOS_ROOT:-/opt/reelos}"
WHY="${1:-manual}"
mkdir -p "$STATE/bugs"
f="$STATE/bugs/$(date +%Y%m%dT%H%M%S)-$(echo "$WHY" | tr -c 'a-zA-Z0-9' '_' | cut -c1-40).txt"
{
  echo "ReelOS bug"
  echo "why $WHY"
  echo "time $(date -Is)"
  echo "VERSION $(cat "$ROOT/VERSION" 2>/dev/null || echo none)"
  echo "applied-sha $(cat "$STATE/applied-sha" 2>/dev/null || echo none)"
  echo "--- :8080 ---"
  curl -sS -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:8080/ 2>/dev/null || echo down
  echo "--- :80 ---"
  curl -sS -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1/ 2>/dev/null || echo down
  echo "--- jellyfin :8096 ---"
  curl -sS -o /dev/null -w "%{http_code}\n" --max-time 2 http://127.0.0.1:8096/System/Info/Public 2>/dev/null || echo down
  echo "--- fuse ---"
  ls -la /mnt/debrid /mnt/debrid/__all__ 2>&1 | head -20
  echo "--- docker ---"
  docker ps --format 'table {{.Names}}\t{{.Status}}' 2>&1 | head -20
  echo "--- ota.log ---"
  tail -40 "$STATE/ota.log" 2>/dev/null || true
  echo "--- wire.log ---"
  tail -20 "$STATE/wire.log" 2>/dev/null || true
} >"$f" 2>&1
echo "$f"
