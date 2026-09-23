import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting to 192.168.1.234...")
ssh.connect('192.168.1.234', username='reelos', password='reelos', timeout=10)

cmds = [
    "echo reelos | sudo -S systemctl stop reelos",
    "echo reelos | sudo -S systemctl disable reelos",
    "echo reelos | sudo -S pkill -9 -f node || true",
    "echo reelos | sudo -S pkill -9 -f vite || true",
    "echo reelos | sudo -S rm -rf /opt/reelos /tmp/reelos* /home/reelos/reelos-native.zip",
    "systemctl is-active reelos || true",
    "ps aux | grep -iE 'node|reelos|vite' | grep -v grep || echo 'ALL NUKED CLEAN'"
]

for cmd in cmds:
    print(f">> Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out.strip())
    if err and "password for reelos" not in err:
        print(f"ERR: {err.strip()}")

ssh.close()
print("Done! Machine 192.168.1.234 is completely nuked clean.")
