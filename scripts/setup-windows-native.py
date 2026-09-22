import os
import sys
import json
import paramiko

ROOT = r"C:\Users\austi\reelos"
STATE_DIR = os.path.join(ROOT, ".reelos-state")
HOST = "192.168.1.234"
USER = "reelos"
PASS = "reelos"

print("Setting up ReelOS Native Windows Environment...")
os.makedirs(STATE_DIR, exist_ok=True)

# 1. Pull household library and profiles from the appliance
try:
    print(f"Connecting to appliance at {HOST} to sync household state...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=10)
    sftp = ssh.open_sftp()
    
    for filename in ["library-shelf.json", "profiles.json", "answers.json"]:
        remote_path = f"/var/lib/reelos/{filename}"
        local_path = os.path.join(STATE_DIR, filename)
        try:
            sftp.get(remote_path, local_path)
            print(f"  Synced {filename} ({os.path.getsize(local_path):,} bytes)")
        except Exception as e:
            print(f"  Warning: could not sync {filename}: {e}")
            
    sftp.close()
    ssh.close()
except Exception as e:
    print(f"  Could not connect to appliance ({e}), using local defaults.")

# 2. Generate Native Windows Hardware Profile
hw_profile = {
    "probe_version": 2,
    "ram_kb": 16535940,
    "ram_gb": 15.77,
    "cpus": 16,
    "disk_kind": "ssd",
    "disk_free_gb": 250.0,
    "tiny": False,
    "box_is_small": False,
    "product": "Windows 11 Native Workstation (Direct Hardware)",
    "cpu_model": "11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz",
    "gpu": "NVIDIA GeForce RTX 3050 Ti Laptop GPU (NVENC) / Intel UHD (QSV)",
    "not_a_pi": True,
    "has_dri": True,
    "summary": "16Gi RAM · 16c Core i7-11800H · RTX 3050 Ti · SSD · Zero-VM Windows Native",
    "knobs": {
        "low_perf": False,
        "zram": False,
        "search_parallelism": 4,
        "indexer_parallelism": 4,
        "splash_tune": "Direct Windows Acceleration · Zero-VM Native"
    }
}

with open(os.path.join(STATE_DIR, "hardware-profile.json"), "w") as f:
    json.dump(hw_profile, f, indent=2)
print("  Generated Windows hardware-profile.json")

# 3. Create provisioned flag
with open(os.path.join(STATE_DIR, "provisioned"), "w") as f:
    f.write("1\n")
with open(os.path.join(STATE_DIR, "installed-version"), "w") as f:
    f.write("1.5.19\n")

print("\nReelOS Native Windows state initialized at .reelos-state/!")
