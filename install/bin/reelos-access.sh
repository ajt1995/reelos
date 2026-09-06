#!/bin/bash
# Apply wizard access: Tailscale or Cloudflare Tunnel. LAN is a no-op.
set -euo pipefail
STATE=/var/lib/reelos
ANSWERS="$STATE/answers.json"
[ -f "$ANSWERS" ] || exit 0
ACCESS=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("access") or "lan")' "$ANSWERS")
TOKEN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("tunnelToken") or "")' "$ANSWERS")

if [ "$ACCESS" = "tailscale" ]; then
  if ! command -v tailscale >/dev/null 2>&1; then
    curl -fsSL https://tailscale.com/install.sh | sh || true
  fi
  systemctl enable --now tailscaled 2>/dev/null || true
  if ! tailscale status >/dev/null 2>&1; then
    URL=$(tailscale up --timeout=8s 2>&1 | grep -o 'https://login.tailscale.com[^ ]*' | head -1 || true)
    [ -n "${URL:-}" ] && echo "$URL" >"$STATE/tailscale-auth.url"
  fi
fi

if [ "$ACCESS" = "cloudflare" ] && [ -n "$TOKEN" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared || true
    chmod 755 /usr/local/bin/cloudflared || true
  fi
  if command -v cloudflared >/dev/null 2>&1; then
    cat >/etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
[Service]
ExecStart=/usr/local/bin/cloudflared tunnel run --token ${TOKEN}
Restart=always
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now cloudflared || true
  fi
fi
