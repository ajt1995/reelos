import os
import tarfile
import paramiko

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE_PATH = os.path.join(ROOT, "reelos-deploy-hp.tar.gz")
HOST = "192.168.1.234"
USER = "reelos"
PASS = "reelos"

print(">>> [1/4] Packaging ReelOS deploy archive for HP appliance...")
if os.path.exists(ARCHIVE_PATH):
    os.remove(ARCHIVE_PATH)

include_dirs = ["prebuilt", "scripts", "src", "server", ".reelos-state"]
include_files = ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "VERSION"]

with tarfile.open(ARCHIVE_PATH, "w:gz") as tar:
    for f in include_files:
        full = os.path.join(ROOT, f)
        if os.path.exists(full):
            tar.add(full, arcname=f)
            
    for d in include_dirs:
        full = os.path.join(ROOT, d)
        if os.path.exists(full):
            tar.add(full, arcname=d)

    # Add public files excluding large files
    public_dir = os.path.join(ROOT, "public")
    if os.path.exists(public_dir):
        for root, dirs, files in os.walk(public_dir):
            for file in files:
                if not (file.endswith(".iso") or file.endswith(".zip") or file.endswith(".tar.gz")):
                    fp = os.path.join(root, file)
                    rel = os.path.relpath(fp, ROOT)
                    tar.add(fp, arcname=rel)

size_mb = os.path.getsize(ARCHIVE_PATH) / (1024 * 1024)
print(f"  Archive created: {ARCHIVE_PATH} ({size_mb:.2f} MB)")

print(f">>> [2/4] Uploading to {HOST} via SFTP...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=10)

sftp = ssh.open_sftp()
sftp.put(ARCHIVE_PATH, "/tmp/reelos-deploy-hp.tar.gz")
sftp.close()
print("  Upload complete.")

print(">>> [3/4] Extracting into /opt/reelos/app and syncing models to /var/lib/reelos...")
cmd = (
    "echo reelos | sudo -S tar -xzf /tmp/reelos-deploy-hp.tar.gz -C /opt/reelos/app && "
    "echo reelos | sudo -S mkdir -p /var/lib/reelos/distilled-models && "
    "echo reelos | sudo -S cp -ru /opt/reelos/app/.reelos-state/* /var/lib/reelos/ 2>/dev/null || true && "
    "echo reelos | sudo -S chown -R root:root /opt/reelos/app && "
    "echo reelos | sudo -S chown -R reelos:reelos /var/lib/reelos && "
    "rm -f /tmp/reelos-deploy-hp.tar.gz"
)
stdin, stdout, stderr = ssh.exec_command(cmd)
stdout.channel.recv_exit_status()
print("  Extraction complete.")

print(">>> [4/4] Restarting reelos.service on HP appliance...")
cmd_restart = "echo reelos | sudo -S systemctl restart reelos"
stdin, stdout, stderr = ssh.exec_command(cmd_restart)
stdout.channel.recv_exit_status()

# Wait a brief moment and check service status
stdin, stdout, stderr = ssh.exec_command("systemctl is-active reelos")
status = stdout.read().decode().strip()
print(f"  Appliance Service Status: {status}")

# Verify endpoints
stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:8080/api/system/remote-compute")
res_rc = stdout.read().decode().strip()
print(f"  Remote Compute endpoint check: {res_rc}")

stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:8080/api/grid/profile")
res_grid = stdout.read().decode().strip()
print(f"  Grid Hardware Profile check: {res_grid}")

stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:8080/api/cinema/taste-bubbles")
res_bubbles = stdout.read().decode().strip()
print(f"  Cinema Taste Bubbles check (length: {len(res_bubbles)}): {res_bubbles[:150]}...")

ssh.close()
if os.path.exists(ARCHIVE_PATH):
    os.remove(ARCHIVE_PATH)

print(">>> Deployment to HP appliance complete!")
