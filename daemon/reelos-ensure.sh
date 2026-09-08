#!/bin/bash
# Boot door. If systemd dbus is drunk, start Node and Caddy anyway.
set -u
ok() { curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$1" 2>/dev/null | grep -q 200; }
sleep 5
if ! ok http://127.0.0.1:8080/; then
  systemctl start reelos >/dev/null 2>&1 || true
  sleep 8
fi
if ! ok http://127.0.0.1:8080/; then
  if [ -d /opt/reelos/app ]; then
    cd /opt/reelos/app
    nohup /usr/bin/env npm run start:box >>/var/lib/reelos/reelos.log 2>&1 &
    echo $! >/var/lib/reelos/reelos.pid
    sleep 8
  fi
fi
if ! ok http://127.0.0.1/; then
  systemctl start caddy >/dev/null 2>&1 || true
  sleep 2
fi
if ! ok http://127.0.0.1/; then
  if [ -f /etc/caddy/Caddyfile ]; then
    pkill -x caddy >/dev/null 2>&1 || true
    nohup /usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >>/var/lib/reelos/caddy.log 2>&1 &
  fi
fi
exit 0
