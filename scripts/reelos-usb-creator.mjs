import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listStorageDevices } from "./services/storage-service.mjs";

export const UBUNTU_ISO_OFFICIAL_URL =
  "https://releases.ubuntu.com/24.04/ubuntu-24.04.1-live-server-amd64.iso";

/**
 * Detects whether an official Ubuntu or ReelOS ISO exists locally in common search directories.
 */
export function detectIsoFile(customDirs = []) {
  const searchDirs = [
    ...customDirs,
    path.join(process.cwd(), "iso"),
    path.join(process.cwd(), "downloads"),
    process.cwd(),
    path.join(os.homedir(), "Downloads"),
  ];

  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (
          file.toLowerCase().endsWith(".iso") &&
          (file.toLowerCase().includes("ubuntu") || file.toLowerCase().includes("reelos"))
        ) {
          const filePath = path.join(dir, file);
          let sizeGb = "0";
          try {
            const stat = fs.statSync(filePath);
            sizeGb = (stat.size / (1024 * 1024 * 1024)).toFixed(1);
          } catch {}
          return {
            found: true,
            path: filePath,
            filename: file,
            sizeGb,
            officialUrl: UBUNTU_ISO_OFFICIAL_URL,
          };
        }
      }
    } catch {}
  }

  return {
    found: false,
    path: null,
    filename: null,
    sizeGb: "0",
    officialUrl: UBUNTU_ISO_OFFICIAL_URL,
  };
}

/**
 * Lists external USB drives suitable for flashing.
 * Never includes primary system drives (Disk 0 or /dev/sda).
 */
export function listUsbDrives() {
  try {
    if (process.platform === "win32") {
      try {
        const psScript = `
          $drives = @()
          $disks = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Where-Object {
            $_.InterfaceType -eq 'USB' -and $_.Index -ne 0
          }
          foreach ($d in $disks) {
            $letter = ""
            $partitions = Get-CimAssociatedInstance -InputObject $d -ResultClassName Win32_DiskPartition -ErrorAction SilentlyContinue
            foreach ($part in $partitions) {
              $logical = Get-CimAssociatedInstance -InputObject $part -ResultClassName Win32_LogicalDisk -ErrorAction SilentlyContinue
              $logList = @($logical)
              if ($logList.Count -gt 0 -and $logList[0].DeviceID) { $letter = $logList[0].DeviceID; break }
            }
            $sizeGb = [math]::Round($d.Size / 1GB, 1)
            $drives += [PSCustomObject]@{
              id = "usb-win-$($d.Index)"
              device = $d.DeviceID
              name = if ($d.Model) { $d.Model } else { "USB Drive $($d.Index)" }
              sizeGb = $sizeGb
              driveLetter = $letter
              isRemovable = $true
            }
          }
          if ($drives.Count -gt 0) { $drives | ConvertTo-Json -Compress }
        `;
        const r = spawnSync(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", psScript],
          { encoding: "utf8", timeout: 4000 }
        );
        if (r.status === 0 && r.stdout?.trim()) {
          const parsed = JSON.parse(r.stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          if (list.length > 0) {
            return { ok: true, drives: list };
          }
        }
      } catch {}
    }

    const storage = listStorageDevices();
    const diskList = storage.usbPool?.length ? storage.usbPool : storage.disks || [];
    const safeDrives = diskList.filter((d) => {
      const dev = String(d.device || d.name || "");
      if (dev === "\\\\.\\PhysicalDrive0" || dev === "/dev/sda" || dev === "sda") return false;
      return d.isUsb || d.isRemovable || d.isExternal || !d.isInternal;
    });

    return {
      ok: true,
      drives: safeDrives.map((d, i) => ({
        id: d.id || `usb-${i}-${d.name || d.device || "drive"}`,
        device: d.device || (d.name ? `/dev/${d.name}` : `drive-${i}`),
        name: d.model || d.label || d.name || "USB Drive",
        sizeGb: typeof d.sizeGb === "number" ? d.sizeGb : parseInt(d.size) || 32,
        isRemovable: true,
        driveLetter: d.driveLetter || d.mount || "",
      })),
    };
  } catch {
    return { ok: true, drives: [] };
  }
}

/**
 * Prepares the cloud-init and ReelOS seed files in the target directory (e.g. FAT32 seed partition).
 */
export function prepareSeedDirectory(answers = {}, targetDir = process.cwd()) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const seedSubdir = path.join(targetDir, "seed");
    fs.mkdirSync(seedSubdir, { recursive: true });
    const nocloudSubdir = path.join(targetDir, "nocloud");
    fs.mkdirSync(nocloudSubdir, { recursive: true });

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const autoinstallDir = path.join(root, "autoinstall");

    // 1. cloud-init user-data
    let userData;
    const userDataPath = path.join(autoinstallDir, "user-data");
    if (fs.existsSync(userDataPath)) {
      userData = fs.readFileSync(userDataPath, "utf8");
    } else {
      userData = `#cloud-config
autoinstall:
  version: 1
  identity:
    hostname: reelos
    username: reelos
    password: "$6$reelos$uR1e4gX.XvU6bM1OQcW9oR8A8jNfM9e5"
  packages:
    - docker.io
    - docker-compose-v2
    - curl
    - git
`;
    }
    fs.writeFileSync(path.join(targetDir, "user-data"), userData, "utf8");
    fs.writeFileSync(path.join(nocloudSubdir, "user-data"), userData, "utf8");

    // 2. cloud-init meta-data
    let metaData;
    const metaDataPath = path.join(autoinstallDir, "meta-data");
    if (fs.existsSync(metaDataPath)) {
      metaData = fs.readFileSync(metaDataPath, "utf8");
    } else {
      metaData = `instance-id: reelos-installer-001\nlocal-hostname: reelos\n`;
    }
    fs.writeFileSync(path.join(targetDir, "meta-data"), metaData, "utf8");
    fs.writeFileSync(path.join(nocloudSubdir, "meta-data"), metaData, "utf8");

    // 3. Helper scripts
    const copyIfPresent = (src, destName) => {
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(targetDir, destName));
          fs.copyFileSync(src, path.join(nocloudSubdir, destName));
        }
      } catch {}
    };

    copyIfPresent(path.join(autoinstallDir, "live-wifi.sh"), "live-wifi.sh");
    copyIfPresent(path.join(root, "scripts", "install-reelos.sh"), "install-reelos.sh");
    copyIfPresent(path.join(root, "install", "bin", "reelos_os_tune.py"), "reelos_os_tune.py");
    copyIfPresent(path.join(root, "daemon", "reelos_os_tune.py"), "reelos_os_tune.py");
    copyIfPresent(path.join(root, "install", "bin", "reelos_hardware.py"), "reelos_hardware.py");

    // 4. ReelOS answers JSON
    const answersJson = JSON.stringify(answers || {}, null, 2) + "\n";
    fs.writeFileSync(path.join(seedSubdir, "answers.json"), answersJson, "utf8");
    fs.writeFileSync(path.join(nocloudSubdir, "answers.json"), answersJson, "utf8");
    fs.writeFileSync(path.join(targetDir, "answers.json"), answersJson, "utf8");

    // If targetDir ends with 'nocloud', also ensure parent volume root has user-data and meta-data
    const parentDir = path.dirname(targetDir);
    if (path.basename(targetDir).toLowerCase() === "nocloud" && parentDir && parentDir !== targetDir) {
      try {
        fs.writeFileSync(path.join(parentDir, "user-data"), userData, "utf8");
        fs.writeFileSync(path.join(parentDir, "meta-data"), metaData, "utf8");
      } catch {}
    }

    return { ok: true, targetDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log("ReelOS USB Flasher Engine initialized.");
  const iso = detectIsoFile();
  console.log("ISO Status:", iso.found ? `Found at ${iso.path}` : "Not found locally");
}
