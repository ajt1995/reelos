#!/bin/bash
# ReelOS tty1 card — IPv4 URL first. Not a desktop.
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

addrs() {
  ip -4 -br addr show | awk '$2 ~ /UP|UNKNOWN/ && $1 !~ /lo/ {print $1, $3}'
}

ipv4_urls() {
  ip -4 -br addr show | awk '$2 ~ /UP|UNKNOWN/ && $1 !~ /lo/{split($3,a,"/"); print "  http://" a[1]}'
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
  clear
  echo "========================================"
  echo "  ReelOS"
  echo "========================================"
  echo
  echo "This screen is setup. Daily use is on another device."
  echo
  echo "Hostname:  $(hostname)"
  if has_net; then
    echo "Network:   up"
    addrs | sed 's/^/  /'
  else
    echo "Network:   down — join Wi-Fi from this keyboard."
  fi
  echo
  if [ -f "$STATE/stack-installed" ]; then
    echo "Stack:     installed"
  else
    echo "Stack:     finishing after network is up"
  fi
  echo
  echo "On your phone, open:"
  if ipv4_urls | grep -q .; then
    ipv4_urls
  else
    echo "  (no address yet — join Wi-Fi)"
  fi
  echo "  http://reelos.local"
  echo
  if command -v qrencode >/dev/null 2>&1; then
    url=$(ip -4 -br addr show | awk '$2 ~ /UP|UNKNOWN/ && $1 !~ /lo/{split($3,a,"/"); print "http://" a[1]; exit}')
    [ -n "${url:-}" ] && qrencode -t ansiutf8 "$url" 2>/dev/null || true
  fi
  echo
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
