import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

export function isSafeUsbTarget(disk, osDisks = [], rootMountDev = "") {
  if (!disk || typeof disk !== "string") return false;
  const clean = disk.replace(/[^a-z0-9]/gi, "");
  if (!clean || clean !== disk) return false;

  // Never allow formatting sda or root drive
  if (clean === "sda" || clean.startsWith("sda")) return false;
  if (rootMountDev && (clean === rootMountDev || rootMountDev.includes(clean))) return false;
  if (osDisks.some((d) => d === clean || clean.startsWith(d))) return false;

  return true;
}

export function generateMountPath(label, name) {
  if (label && typeof label === "string" && label.trim().length > 0) {
    const cleanLabel = label
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32);
    if (cleanLabel) return `/mnt/usb/${cleanLabel}`;
  }
  return `/mnt/usb/usb-${name}`;
}

export function listUsbDrives() {
  const r = spawnSync("lsblk", ["-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,TRAN,HOTPLUG,MODEL"], {
    encoding: "utf8",
    timeout: 5000,
  });

  if (r.status !== 0 || !r.stdout) {
    return { ok: false, error: r.stderr || "lsblk failed", drives: [] };
  }

  try {
    const parsed = JSON.parse(r.stdout);
    const devices = parsed.blockdevices || [];
    const usbDrives = devices.filter((d) => {
      return d.tran === "usb" || d.hotplug === true || d.hotplug === "1";
    });

    const drives = usbDrives.map((d) => {
      const parts = (d.children || []).map((c) => ({
        name: c.name,
        size: c.size,
        mount: c.mountpoint || null,
        label: c.label || null,
        fstype: c.fstype || null,
      }));

      const isMounted = parts.some((p) => Boolean(p.mount)) || Boolean(d.mountpoint);

      return {
        name: d.name,
        size: d.size,
        model: d.model || "USB Storage",
        partitions: parts,
        isMounted,
        canFormat: isSafeUsbTarget(d.name, ["sda"], "sda"),
      };
    });

    return { ok: true, drives };
  } catch (e) {
    return { ok: false, error: e.message, drives: [] };
  }
}

export function autoMountUsb() {
  const result = listUsbDrives();
  if (!result.ok) return result;

  const mounted = [];
  mkdirSync("/mnt/usb", { recursive: true });

  for (const drive of result.drives) {
    for (const part of drive.partitions) {
      if (!part.mount && part.fstype) {
        const mountpoint = generateMountPath(part.label, part.name);
        mkdirSync(mountpoint, { recursive: true });

        // Safe mount options
        const opts = /fat|ntfs/i.test(part.fstype)
          ? "noatime,async,nofail,uid=1000,gid=1000"
          : "noatime,async,nofail";

        const m = spawnSync("mount", ["-o", opts, `/dev/${part.name}`, mountpoint], {
          encoding: "utf8",
          timeout: 8000,
        });

        if (m.status === 0) {
          mounted.push({ device: `/dev/${part.name}`, mountpoint, fstype: part.fstype });
        }
      }
    }
  }

  return { ok: true, mounted };
}

export function formatUsbDrive(disk, confirmPhrase) {
  if (confirmPhrase !== "FORMAT") {
    return { ok: false, error: "Must confirm with exact phrase 'FORMAT'" };
  }

  if (!isSafeUsbTarget(disk, ["sda"], "sda")) {
    return { ok: false, error: `Drive /dev/${disk} is an internal/system disk and cannot be formatted.` };
  }

  const devPath = `/dev/${disk}`;
  if (!existsSync(devPath)) {
    return { ok: false, error: `Block device ${devPath} not found.` };
  }

  // 1. Unmount all partitions of this disk
  spawnSync("sh", ["-c", `umount ${devPath}* 2>/dev/null || true`], { timeout: 10000 });

  // 2. Wipe existing signatures
  spawnSync("wipefs", ["-a", devPath], { timeout: 10000 });

  // 3. Create fresh GPT partition table and primary partition
  spawnSync("parted", ["-s", devPath, "mklabel", "gpt", "mkpart", "primary", "ext4", "1MiB", "100%"], {
    timeout: 15000,
  });

  // Target partition is usually ${disk}1
  const partDev = `${devPath}1`;

  // 4. Format to ext4 with fast commit & minimal reserved blocks
  const mk = spawnSync("mkfs.ext4", ["-F", "-m", "1", "-L", "ReelOS-Storage", partDev], {
    timeout: 30000,
  });

  if (mk.status !== 0) {
    return { ok: false, error: mk.stderr || "mkfs.ext4 failed" };
  }

  // 5. Mount to /mnt/storage
  mkdirSync("/mnt/storage", { recursive: true });
  const m = spawnSync("mount", ["-o", "noatime", partDev, "/mnt/storage"], { timeout: 8000 });
  if (m.status !== 0) {
    return { ok: false, error: m.stderr || "mount failed after formatting" };
  }

  return {
    ok: true,
    device: partDev,
    mountpoint: "/mnt/storage",
    label: "ReelOS-Storage",
    formatted: true,
  };
}
