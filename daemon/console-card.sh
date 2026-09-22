#!/bin/bash
# ReelOS tty1 card — Dual-panel setup display & low-power status dashboard.
set -eu
STATE=/var/lib/reelos
mkdir -p "$STATE"

wifi_dev() {
  iwctl device list 2>/dev/null | awk '/wlan|wlp|wlx/{print $1; exit}' || true
  ip -o link show | awk -F': ' '/wlp|wlan|wlx/{print $2; exit}'
}

has_net() {
  ip route get 1.1.1.1 >/dev/null 2>&1
}

lan_ip() {
  ip -4 -br addr show | awk '
    $2 ~ /UP|UNKNOWN/ && $1 !~ /^(lo|docker|br-|veth|cni)/ {
      split($3,a,"/")
      if (a[1] !~ /^172\.(1[7-9]|2[0-9]|3[01])\./ && a[1] !~ /^192\.168\.4\./) { print a[1]; exit }
    }'
}

tailscale_ip() {
  if command -v tailscale >/dev/null 2>&1; then
    tailscale ip -4 2>/dev/null || true
  fi
}

tailscale_dns() {
  if command -v tailscale >/dev/null 2>&1; then
    tailscale status --json 2>/dev/null | grep -o '"Self":{[^}]*"DNSName":"[^"]*' | head -1 | sed -E 's/.*"DNSName":"([^"]*).*/\1/' | sed 's/\.$//' || true
  fi
}

join_wifi() {
  local ssid pass dev
  dev=$(wifi_dev | head -1)
  if [ -z "$dev" ]; then
    echo "No Wi-Fi radio."
    return 1
  fi
  echo
  echo "Wi-Fi device: $dev"
  printf "Network name: "
  read -r ssid
  [ -n "$ssid" ] || return 1
  printf "Password: "
  stty -echo 2>/dev/null || true
  read -r pass
  stty echo 2>/dev/null || true
  echo
  if command -v iwctl >/dev/null 2>&1; then
    mkdir -p /var/lib/iwd
    umask 077
    printf '[Security]\nPassphrase=%s\n' "$pass" >"/var/lib/iwd/${ssid}.psk"
    iwctl station "$dev" scan >/dev/null 2>&1 || true
    sleep 2
    iwctl station "$dev" connect "$ssid" >/dev/null 2>&1 || true
  else
    ip link set "$dev" up || true
    wpa_passphrase "$ssid" "$pass" >/tmp/reelos-wifi.conf
    wpa_supplicant -B -i "$dev" -c /tmp/reelos-wifi.conf
    rm -f /tmp/reelos-wifi.conf
  fi
  dhclient "$dev" >/dev/null 2>&1 || true
  sleep 3
}

draw_post_setup() {
  local ip ts_ip ts_dns
  ip=$(lan_ip)
  ts_ip=$(tailscale_ip)
  ts_dns=$(tailscale_dns)

  # Enable 15-minute DPMS screen blanking to prevent display burn-in
  setterm --blank 15 --powerdown 15 >/dev/tty1 2>/dev/null || true

  clear
  echo "=========================================================================="
  echo "  REELOS APPLIANCE  ·  STATUS: ONLINE"
  echo "=========================================================================="
  echo
  if [ -n "$ip" ]; then
    echo "  LAN Access:        http://${ip}"
  else
    echo "  LAN Access:        Waiting for network..."
  fi
  if [ -n "$ts_dns" ]; then
    echo "  Tailscale Access:  https://${ts_dns}"
  elif [ -n "$ts_ip" ]; then
    echo "  Tailscale Access:  http://${ts_ip}"
  fi
  echo "  Storage:           USB 3.2 (Internal Windows drive safe & unmounted)"
  echo "  Screen:            Low-power mode (blanks after 15m idle)"
  echo
  if command -v qrencode >/dev/null 2>&1; then
    local target="http://${ip:-reelos.local}"
    [ -n "$ts_dns" ] && target="https://${ts_dns}"
    echo "  Scan to open ReelOS dashboard on your phone:"
    echo
    qrencode -t ansiutf8 "$target" 2>/dev/null || true
    echo
  fi
  echo "1  Join Wi-Fi"
  echo "2  Refresh"
  echo "3  Login shell"
  echo
  printf "Choice: "
}

draw_setup() {
  local ip qr_payload status_msg
  ip=$(lan_ip)
  qr_payload="WIFI:T:WPA;S:ReelOS-Setup;P:reelos123;;"
  if [ -n "$ip" ]; then
    qr_payload="http://${ip}"
  fi

  status_msg="Waiting for phone to connect..."
  if [ -f "$STATE/setup-status" ]; then
    status_msg=$(cat "$STATE/setup-status")
  fi

  # Enable 15-minute DPMS screen blanking to prevent display burn-in during setup
  setterm --blank 15 --powerdown 15 >/dev/tty1 2>/dev/null || true

  clear
  echo "=========================================================================="
  echo "  REELOS APPLIANCE SETUP"
  echo "  Windows & internal storage are completely untouched and safe."
  echo "=========================================================================="
  echo
  echo "  [ PANEL 1: SCAN WITH PHONE ]           [ PANEL 2: OR CONNECT MANUALLY ]"
  echo "  Point phone camera at QR code          1. Open Wi-Fi on your phone"
  echo "  to join setup Wi-Fi automatically.     2. Connect to: ReelOS-Setup"
  echo "                                            Password:   reelos123"
  echo "                                         3. Open: http://192.168.4.1"
  if [ -n "$ip" ]; then
    echo "                                            (LAN: http://${ip})"
  fi
  echo
  if command -v qrencode >/dev/null 2>&1; then
    qrencode -t ansiutf8 "$qr_payload" 2>/dev/null || true
    echo
  fi
  echo "--------------------------------------------------------------------------"
  echo "  Status: ${status_msg}"
  echo "--------------------------------------------------------------------------"
  echo "1  Join Wi-Fi"
  echo "2  Refresh"
  echo "3  Login shell"
  echo
  printf "Choice: "
}

draw() {
  if [ -f "$STATE/provisioned" ]; then
    draw_post_setup
  else
    draw_setup
  fi
}

while true; do
  draw
  read -r -t 20 choice || true
  case "$choice" in
    1) join_wifi ;;
    3) exec /bin/login ;;
    *) ;;
  esac
done
