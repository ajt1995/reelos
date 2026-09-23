#!/usr/bin/env python3
import sys
import subprocess
from PIL import Image

def capture(device_id, output_path):
    adb = r'C:\Users\austi\AppData\Local\Android\Sdk\platform-tools\adb.exe'
    if device_id and ':' in device_id:
        subprocess.run([adb, 'connect', device_id], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = [adb]
    if device_id:
        cmd.extend(['-s', device_id])
    cmd.extend(['exec-out', 'screencap', '-p'])
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    data = p.stdout
    idx = data.find(b'\x89PNG\r\n\x1a\n')
    if idx == -1:
        print(f"Error: No PNG stream found from {device_id}: {p.stderr.decode('utf-8', errors='ignore')}")
        sys.exit(1)
    clean_png = data[idx:]
    with open(output_path, 'wb') as f:
        f.write(clean_png)
    im = Image.open(output_path)
    print(f"Captured {output_path} ({im.size[0]}x{im.size[1]}) from {device_id}")

if __name__ == '__main__':
    device = sys.argv[1] if len(sys.argv) > 1 else 'R5GL64PC0CF'
    out = sys.argv[2] if len(sys.argv) > 2 else '.reelos-audit/screen.png'
    capture(device, out)
