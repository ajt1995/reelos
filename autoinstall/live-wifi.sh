#!/bin/bash
# Run from the live installer (early-commands) on tty1.
# Join Wi-Fi BEFORE Subiquity apt. Never calls the network to install packages.
# Uses wpasupplicant already on the Ubuntu ISO pool when needed.
set -u
export DEBIAN_FRONTEND=noninteractive

has_net() {
  ip route get 1.1.1.1 >/dev/null 2>&1
}

wifi_dev() {
  ip -o link show | awk -F': ' '/wlp|wlan|wlx/{print $2; exit}'
}

pool_dpkg() {
  local dir
  for dir in /cdrom/nocloud/debs /cdrom/pool/main/w/wpa /cdrom/pool/main/libn/libnl3; do
    [ -d "$dir" ] || continue
    dpkg -i "$dir"/*.deb >/tmp/reelos-wifi-dpkg.log 2>&1 || true
  done
  apt-get -y -f install >/dev/null 2>&1 || true
}

join() {
  local dev ssid pass
  dev=$(wifi_dev)
  if [ -z "$dev" ]; then
    echo "No Wi-Fi radio. Plug ethernet or skip."
    return 1
  fi
  command -v wpa_supplicant >/dev/null 2>&1 || pool_dpkg
  if ! command -v wpa_supplicant >/dev/null 2>&1; then
    echo "wpasupplicant is not on this disc."
    return 1
  fi
  rfkill unblock wifi >/dev/null 2>&1 || rfkill unblock all >/dev/null 2>&1 || true
  ip link set "$dev" up || true
  echo
  echo "Wi-Fi device: $dev"
  printf "Network name: "
  read -r ssid
  [ -n "${ssid:-}" ] || return 1
  printf "Password: "
  stty -echo 2>/dev/null || true
  read -r pass
  stty echo 2>/dev/null || true
  echo
  umask 077
  wpa_passphrase "$ssid" "$pass" >/tmp/reelos-live-wifi.conf
  pkill wpa_supplicant >/dev/null 2>&1 || true
  wpa_supplicant -B -i "$dev" -c /tmp/reelos-live-wifi.conf
  rm -f /tmp/reelos-live-wifi.conf
  dhclient -v "$dev" >/tmp/reelos-dhclient.log 2>&1 || true
  sleep 2
  has_net
}

if [ ! -t 0 ] || [ ! -t 1 ]; then
  if [ -e /dev/tty1 ]; then
    exec </dev/tty1 >/dev/tty1 2>&1
    chvt 1 2>/dev/null || true
  fi
fi

if has_net; then
  echo "ReelOS: network is up."
  exit 0
fi

clear
echo "========================================"
echo "  ReelOS 1.2  ·  network"
echo "========================================"
echo
echo "This machine has no network. Ubuntu will fail"
echo "if it has to download packages. Join Wi-Fi now."
echo
echo "1  Join Wi-Fi"
echo "S  Skip (ethernet later, or first-boot card)"
echo
printf "Choice [1]: "
read -r choice
choice=${choice:-1}
case "$choice" in
  S|s) echo "Skipping. Installer continues." ; exit 0 ;;
  *)
    if join && has_net; then
      echo
      echo "Network is up. Installer continues."
      ping -c 1 -W 3 1.1.1.1 >/dev/null 2>&1 || true
      exit 0
    fi
    echo "Still no network. Installer continues anyway."
    exit 0
    ;;
esac
