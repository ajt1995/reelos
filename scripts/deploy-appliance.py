import os
import sys
import time
import paramiko

HOST = "192.168.1.234"
USER = "reelos"
PASS = "reelos"
LOCAL_ZIP = os.path.join(os.path.dirname(__file__), "..", "public", "install", "reelos-native.zip")
LOCAL_ZIP = os.path.abspath(LOCAL_ZIP)

def print_progress(transferred, total):
    pct = (transferred / total) * 100
    mb_trans = transferred / (1024 * 1024)
    mb_total = total / (1024 * 1024)
    sys.stdout.write(f"\r[SFTP] Uploading bundle: {pct:.1f}% ({mb_trans:.2f}/{mb_total:.2f} MB)")
    sys.stdout.flush()

def main():
    print("=" * 60)
    print(f"  ReelOS Appliance Deployer -> {HOST}")
    print("=" * 60)

    if not os.path.exists(LOCAL_ZIP):
        print(f"ERROR: Local package not found: {LOCAL_ZIP}")
        sys.exit(1)

    print(f"\n[1/4] Connecting to {USER}@{HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected via SSH.")

    print(f"\n[2/4] Uploading {os.path.basename(LOCAL_ZIP)} via SFTP...")
    sftp = ssh.open_sftp()
    remote_zip = "/home/reelos/reelos-native.zip"
    sftp.put(LOCAL_ZIP, remote_zip, callback=print_progress)
    sftp.close()
    print("\nUpload complete!")

    print(f"\n[3/4] Executing clean installation on {HOST}...")
    install_commands = [
        "echo reelos | sudo -S systemctl stop reelos || true",
        "rm -rf /tmp/reelos_pkg && mkdir -p /tmp/reelos_pkg",
        "unzip -q -o /home/reelos/reelos-native.zip -d /tmp/reelos_pkg",
        "cd /tmp/reelos_pkg && echo reelos | sudo -S bash install.sh",
    ]
    full_cmd = " && ".join(install_commands)
    stdin, stdout, stderr = ssh.exec_command(full_cmd, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()

    exit_status = stdout.channel.recv_exit_status()
    print(f"\nInstallation finished with exit code: {exit_status}")

    print(f"\n[4/4] Verifying ReelOS service status...")
    stdin, stdout, stderr = ssh.exec_command("systemctl status reelos --no-pager", get_pty=True)
    out = stdout.read().decode('utf-8', errors='replace')
    print(out)

    stdin, stdout, stderr = ssh.exec_command("curl -s -I http://127.0.0.1:8080/ | head -n 5", get_pty=True)
    curl_out = stdout.read().decode('utf-8', errors='replace')
    print("Local curl probe on :8080:")
    print(curl_out)

    ssh.close()
    print("=" * 60)
    print("  Deployment and verification completed successfully!")
    print("=" * 60)

if __name__ == '__main__':
    main()
