import sys
import paramiko

if sys.version_info >= (3, 7):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.234', username='reelos', password='reelos', timeout=10)

kiosk_sh = """#!/bin/bash
# ReelOS Appliance Kiosk Display
set -eu

if [ ! -e /dev/dri ] && [ ! -d /sys/class/drm ]; then
  exit 0
fi

# Wait for ReelOS Box Engine to become ready
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8080/ >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

bin=""
command -v chromium >/dev/null && bin=chromium
command -v chromium-browser >/dev/null && bin=chromium-browser
[ -n "$bin" ] || exit 0

export XDG_RUNTIME_DIR="/run/user/$(id -u)"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

rm -rf /tmp/reelos-kiosk-profile
mkdir -p /tmp/reelos-kiosk-profile

exec cage -s -- "$bin" \
  --kiosk \
  --app=http://127.0.0.1:8080/ \
  --user-data-dir=/tmp/reelos-kiosk-profile \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --ozone-platform=wayland \
  --enable-features=VaapiVideoDecoder,VaapiVideoEncoder \
  --disable-features=Translate,OptimizationHints \
  --autoplay-policy=no-user-gesture-required
"""

kiosk_service = """[Unit]
Description=ReelOS Appliance Local Display Kiosk
After=reelos.service systemd-user-sessions.service
Wants=reelos.service
Conflicts=getty@tty1.service

[Service]
Type=simple
User=reelos
Group=reelos
PAMName=login
StandardInput=tty
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=WLR_LIBINPUT_NO_DEVICES=1
ExecStart=/opt/reelos/bin/kiosk.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/kiosk.sh', 'w') as f:
    f.write(kiosk_sh)
with sftp.open('/tmp/reelos-kiosk.service', 'w') as f:
    f.write(kiosk_service)
sftp.close()

cmds = """
echo 'reelos' | sudo -S cp /tmp/kiosk.sh /opt/reelos/bin/kiosk.sh
echo 'reelos' | sudo -S chmod +x /opt/reelos/bin/kiosk.sh
echo 'reelos' | sudo -S cp /tmp/reelos-kiosk.service /etc/systemd/system/reelos-kiosk.service
echo 'reelos' | sudo -S systemctl daemon-reload
echo 'reelos' | sudo -S systemctl enable reelos-kiosk.service
echo 'reelos' | sudo -S systemctl restart reelos-kiosk.service
sleep 3
systemctl status reelos-kiosk.service --no-pager
"""

stdin, stdout, stderr = ssh.exec_command(cmds)
print(stdout.read().decode('utf-8', errors='replace'))
print('ERR:', stderr.read().decode('utf-8', errors='replace'))
ssh.close()
