#!/bin/bash
# ReelOS tty1 card — IPv4 first, large. Not reelos.local first.
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
      if (a[1] !~ /^172\.(1[7-9]|2[0-9]|3[01])\./) { print a[1]; exit }
    }'
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

draw() {
  local ip url
  ip=$(lan_ip)
  url=""
  [ -n "$ip" ] && url="http://${ip}"
  clear
  echo "========================================"
  echo "  ReelOS"
  echo "========================================"
  echo
  echo "This screen is setup. Daily use is on another device."
  echo
  if [ -n "$url" ]; then
    echo
    echo "  On your phone:"
    echo
    echo "      ${url}"
    echo
  else
    echo "  No LAN address yet — join Wi-Fi (1)."
    echo
  fi
  echo "  (optional) http://reelos.local"
  echo
  if command -v qrencode >/dev/null 2>&1 && [ -n "$url" ]; then
    qrencode -t ansiutf8 "$url" 2>/dev/null || true
    echo
  fi
  echo "1  Join Wi-Fi"
  echo "2  Refresh"
  echo "3  Login shell"
  echo
  printf "Choice: "
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
