#!/bin/bash
# Autoinstall late-command body. Runs inside the installed system via
# `curtin in-target`. Fresh disk only.
#
# Enables firstboot once, installs SSH, runs install.sh (docker/caddy/app).
# Does not skip the 7-step wizard. Does not plant TorBox or admin PIN.
set -u
export DEBIAN_FRONTEND=noninteractive

SEED=/opt/reelos/seed
ROOT=/opt/reelos
STATE=/var/lib/reelos
mkdir -p "$ROOT" "$STATE" /etc/systemd/system "$ROOT/bin"

if [ -f "$SEED/seed-reelos.sh" ]; then
  bash "$SEED/seed-reelos.sh" || echo seed-failed >"$STATE/install-failed"
fi

copy_unit() {
  local name="$1"
  if [ -f "$ROOT/systemd/$name" ]; then
    cp "$ROOT/systemd/$name" "/etc/systemd/system/$name"
  fi
}

copy_unit reelos.service
copy_unit reelos-firstboot.service
copy_unit reelos-console.service
copy_unit reelos-lock-clients.service
copy_unit reelos-lock-clients.timer
copy_unit reelos-mnt-rshared.service
copy_unit reelos-selfheal.service
copy_unit reelos-selfheal.timer

chmod 755 "$ROOT/bin/"* "$ROOT/install.sh" "$ROOT/reelos-install.sh" 2>/dev/null || true

# Firstboot once on this fresh disk. ConditionPathExists=!stack-installed so
# a finished install.sh is a no-op after reboot. Apply on a live house must
# not enable this unit — ISO owns that.
systemctl enable reelos-firstboot.service || true
systemctl enable reelos-console.service || true
systemctl enable reelos-lock-clients.timer || true
systemctl enable reelos-mnt-rshared.service || true
systemctl disable getty@tty1.service || true

apt-get update -y || true
apt-get install -y --no-install-recommends openssh-server || true
systemctl enable ssh.service 2>/dev/null || systemctl enable sshd.service 2>/dev/null || true

if id reelos >/dev/null 2>&1; then
  usermod -aG sudo reelos 2>/dev/null || true
fi

if [ -x "$ROOT/install.sh" ]; then
  bash "$ROOT/install.sh" || echo failed >"$STATE/install-failed"
else
  echo "missing /opt/reelos/install.sh" >"$STATE/install-failed"
fi

# Belt: a late-command must never skip the wizard.
if [ -f "$STATE/provisioned" ]; then
  echo "ISO late-command found provisioned — removing so the 7-step wizard runs" >&2
  rm -f "$STATE/provisioned"
fi
exit 0
