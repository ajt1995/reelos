#!/bin/bash
# ReelOS Wi-Fi SoftAP and Captive Portal Manager.
#   reelos-hotspot.sh start   -> starts ReelOS-Setup AP and captive DNS on wlan0
#   reelos-hotspot.sh stop    -> shuts down AP cleanly once home Wi-Fi connects
#   reelos-hotspot.sh status  -> prints active state (JSON or exit code)
set -euo pipefail

STATE=/var/lib/reelos
mkdir -p "$STATE"
RUN_DIR=/run/reelos
mkdir -p "$RUN_DIR"

AP_SSID="ReelOS-Setup"
AP_PASS="reelos123"
AP_IP="192.168.4.1"
AP_SUBNET="192.168.4.0/24"

wifi_iface() {
  ip -o link show | awk -F': ' '/wlp|wlan|wlx/{print $2; exit}'
}

has_active_lan() {
  ip -4 -br addr show | awk '
    $2 ~ /UP/ && $1 !~ /^(lo|docker|br-|veth|cni)/ {
      split($3,a,"/")
      if (a[1] !~ /^172\.(1[7-9]|2[0-9]|3[01])\./ && a[1] !~ /^192\.168\.4\./) { print a[1]; exit }
    }' | grep -q .
}

start_hotspot() {
  if [ -f "$STATE/provisioned" ]; then
    echo "ReelOS: already provisioned, skipping setup hotspot."
    exit 0
  fi

  local dev
  dev=$(wifi_iface)
  if [ -z "$dev" ]; then
    echo "ReelOS hotspot: no Wi-Fi interface found. Plug Ethernet or USB Wi-Fi."
    exit 0
  fi

  echo "ReelOS hotspot: starting on $dev..."

  # Configure IP on interface
  ip link set "$dev" up || true
  ip addr flush dev "$dev" || true
  ip addr add "${AP_IP}/24" dev "$dev" || true

  # 1. Start hostapd or NetworkManager hotspot
  if command -v nmcli >/dev/null 2>&1; then
    nmcli con delete "$AP_SSID" 2>/dev/null || true
    nmcli con add type wifi ifname "$dev" con-name "$AP_SSID" autoconnect no ssid "$AP_SSID" || true
    nmcli con modify "$AP_SSID" 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method manual ipv4.addresses "${AP_IP}/24" || true
    nmcli con modify "$AP_SSID" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$AP_PASS" || true
    nmcli con up "$AP_SSID" || true
  fi

  # 2. Start dnsmasq for DHCP and Captive Portal DNS redirection
  cat >"$RUN_DIR/hotspot-dnsmasq.conf" <<EOF
interface=$dev
bind-interfaces
dhcp-range=192.168.4.10,192.168.4.50,255.255.255.0,12h
dhcp-option=3,$AP_IP
dhcp-option=6,$AP_IP
# Captive portal resolution for iOS, Android, and Windows
address=/captive.apple.com/$AP_IP
address=/connectivitycheck.gstatic.com/$AP_IP
address=/connectivitycheck.android.com/$AP_IP
address=/msftconnecttest.com/$AP_IP
address=/#/$AP_IP
EOF

  pkill -f "dnsmasq.*hotspot-dnsmasq.conf" 2>/dev/null || true
  if command -v dnsmasq >/dev/null 2>&1; then
    dnsmasq -C "$RUN_DIR/hotspot-dnsmasq.conf" || true
  fi

  touch "$STATE/hotspot-active"
  echo "Waiting for phone to connect to ${AP_SSID}..." >"$STATE/setup-status"
  echo "ReelOS hotspot active on $dev (${AP_SSID})."
}

stop_hotspot() {
  local dev
  dev=$(wifi_iface)
  echo "ReelOS hotspot: stopping..."

  if command -v nmcli >/dev/null 2>&1; then
    nmcli con down "$AP_SSID" 2>/dev/null || true
    nmcli con delete "$AP_SSID" 2>/dev/null || true
  fi
  pkill -f "dnsmasq.*hotspot-dnsmasq.conf" 2>/dev/null || true
  rm -f "$STATE/hotspot-active" "$RUN_DIR/hotspot-dnsmasq.conf"

  if [ -n "$dev" ]; then
    ip addr flush dev "$dev" || true
  fi

  echo "Home Wi-Fi connected. Setup AP stopped." >"$STATE/setup-status"
  echo "ReelOS hotspot stopped."
}

status_hotspot() {
  if [ -f "$STATE/hotspot-active" ]; then
    echo '{"active":true,"ssid":"'"$AP_SSID"'","ip":"'"$AP_IP"'"}'
  else
    echo '{"active":false}'
  fi
}

case "${1:-status}" in
  start)  start_hotspot ;;
  stop)   stop_hotspot ;;
  status) status_hotspot ;;
  *)      echo "Usage: $0 {start|stop|status}" >&2; exit 1 ;;
esac
