#!/bin/bash
# Appliance: closing the lid must not suspend the house box.
set -euo pipefail
mkdir -p /etc/systemd/logind.conf.d
cat >/etc/systemd/logind.conf.d/reelos-lid.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null 2>&1 || true
systemctl kill -s HUP systemd-logind >/dev/null 2>&1 || true
