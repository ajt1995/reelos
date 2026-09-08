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
tok=$(tr -d '[:space:]' <"$STATE/github-token" 2>/dev/null || true)
if [ -n "$tok" ]; then
  python3 - "$f" "$tok" "$WHY" <<'PY' || true
import json, sys, urllib.error, urllib.request
path, tok, why = sys.argv[1:4]
body = open(path, encoding="utf-8", errors="replace").read()[:12000]
payload = json.dumps({
    "title": f"House: {why}"[:80],
    "body": "```\n" + body + "\n```\n",
    "labels": ["house"],
}).encode()
req = urllib.request.Request(
    "https://api.github.com/repos/ajt1995/reelos/issues",
    data=payload,
    method="POST",
    headers={
        "Authorization": f"Bearer {tok}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "ReelOS-bug",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
        print("github", d.get("html_url") or "ok")
except urllib.error.HTTPError as e:
    print("github", e.code, (e.read() or b"")[:200].decode("utf-8", "replace"), file=sys.stderr)
except Exception as e:
    print("github", type(e).__name__, e, file=sys.stderr)
PY
fi

