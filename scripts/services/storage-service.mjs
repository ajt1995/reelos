import { spawnSync, execSync } from "node:child_process";
import fsMod, { existsSync, mkdirSync, statSync, readdirSync, unlinkSync, statfsSync } from "node:fs";
import { chaosMonkeyService } from "./chaos-monkey-service.mjs";

/**
 * Storage Service for ReelOS.
 * Provides safe USB disk enumeration, 1-click pool mounting,
 * ext4 formatting for adopted drives, and APM 127 silent spindown.
 */

export function isSafeStorageTarget(disk, osDisks = ["sda"], rootMountDev = "sda") {
  if (!disk || typeof disk !== "string") return false;
  const clean = disk.replace(/[^a-z0-9]/gi, "");
  if (!clean || clean !== disk) return false;

  // Never allow targeting internal OS drive (sda or root)
  if (clean === "sda" || clean.startsWith("sda")) return false;
  if (rootMountDev && (clean === rootMountDev || rootMountDev.includes(clean))) return false;
  if (osDisks.some((d) => d === clean || clean.startsWith(d))) return false;

  return true;
}

export function listStorageDevices(storageMode = "both") {
  if (process.platform !== "linux") {
    // Windows / macOS native host drive inspection
    if (process.platform === "win32") {
      try {
        const ps = spawnSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            "Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter, FileSystemLabel, DriveType, Size, SizeRemaining | ConvertTo-Json",
          ],
          { encoding: "utf8", timeout: 5000 }
        );
        if (ps.stdout && !ps.error) {
          const raw = JSON.parse(ps.stdout);
          const list = Array.isArray(raw) ? raw : [raw];
          const disks = list.map((v) => {
            const letter = String(v.DriveLetter || "").toUpperCase();
            const label = v.FileSystemLabel ? `${v.FileSystemLabel} (${letter}:)` : `Drive (${letter}:)`;
            const sizeGb = Math.round((Number(v.Size) || 0) / (1024 ** 3));
            const freeGb = Math.round((Number(v.SizeRemaining) || 0) / (1024 ** 3));
            const isUsb = String(v.DriveType || "").toLowerCase() === "removable";
            return {
              name: letter,
              label,
              size: `${sizeGb}G`,
              sizeGb,
              freeGb,
              model: isUsb ? `External USB Drive (${letter}:)` : `Local Drive (${letter}:)`,
              mount: `${letter}:\\`,
              path: `${letter}:\\`,
              os: letter === "C",
              isUsb,
              isInternal: !isUsb,
              osName: "Windows",
              kind: "ssd",
              rotational: false,
              powerState: "active",
              isStandby: false,
              apm: 127,
              spindownMode: isUsb ? "USB Drive (Spindown Ready)" : "Local SSD (Direct Access)",
            };
          });

          return {
            ok: true,
            simulated: false,
            disks,
            usbPool: disks.filter((d) => d.isUsb),
            internalDisks: disks.filter((d) => !d.isUsb),
            totalDevices: disks.length,
            storageMode,
            hasExternalStorage: disks.some((d) => d.isUsb),
            bootDriveRotational: false,
            hybridCachingAllowed: true,
            driveProtectionNotice: null,
            error: null,
          };
        }
      } catch (err) {
        // fallback below
      }
    }

    return {
      ok: false,
      supported: false,
      simulated: false,
      disks: [],
      usbPool: [],
      internalDisks: [],
      totalDevices: 0,
      storageMode,
      error: "Storage inventory could not be read on this host.",
    };
  }

  let r;
  try {
    r = spawnSync(
      "lsblk",
      ["-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,TRAN,HOTPLUG,MODEL,ROTA"],
      { encoding: "utf8", timeout: 8000 },
    );
  } catch (err) {
    return { ok: false, error: err.message, disks: [], usbPool: [], internalDisks: [], storageMode };
  }

  if (r.status !== 0 || !r.stdout) {
    return { ok: false, error: r.stderr || "lsblk failed", disks: [], usbPool: [], internalDisks: [], storageMode };
  }

  try {
    const parsed = JSON.parse(r.stdout);
    const all = (parsed.blockdevices || []).filter((d) => d.type === "disk");

    const usbPool = [];
    const internalDisks = [];
    const disks = [];

    for (const d of all) {
      const isUsb = d.tran === "usb" || d.hotplug === true || d.hotplug === "1";
      const parts = (d.children || []).map((c) => ({
        name: c.name,
        size: c.size,
        mount: c.mountpoint || null,
        label: c.label || null,
        fstype: c.fstype || null,
      }));

      const fstypes = [d.fstype, ...parts.map((c) => c.fstype)].filter(Boolean);
      const hasWindows = fstypes.some((f) => /ntfs|bitlocker/i.test(f));
      let osName = null;
      if (hasWindows) osName = "Windows";
      else if (fstypes.some((f) => /apfs|hfs/i.test(f))) osName = "macOS";
      else if (fstypes.some((f) => /ext4|btrfs|xfs/i.test(f))) osName = "Linux";

      let rotational = false;
      try {
        rotational = d.rota === true || d.rota === "1";
        const isVirtio = (d.kname && d.kname.startsWith("vd")) || (d.name && d.name.startsWith("vd"));
        if (isVirtio) {
          rotational = false;
        }
      } catch {
        rotational = false;
      }

      let powerState = "active";
      let isStandby = false;
      if (rotational) {
        try {
          const h = spawnSync("hdparm", ["-C", `/dev/${d.name}`], { encoding: "utf8", timeout: 3000 });
          const hout = (h.stdout || "").toLowerCase();
          if (hout.includes("standby") || hout.includes("sleeping")) {
            powerState = "standby";
            isStandby = true;
          } else if (hout.includes("active") || hout.includes("idle")) {
            powerState = "active";
            isStandby = false;
          }
        } catch {
          powerState = "unknown";
        }
      }

      const kind = rotational ? "rotational" : "ssd";
      const isDebrid = storageMode === "debrid";
      const spindownMode = rotational
        ? (isDebrid ? "APM 127 · 5m spindown (Pure RAM / SQLite cache)" : "Local download (spindown suspended during active writes)")
        : "N/A (SSD)";

      const isMounted = parts.some((p) => Boolean(p.mount)) || Boolean(d.mountpoint);
      const isOs = Boolean(
        d.mountpoint === "/" || parts.some((c) => c.mount === "/" || c.mount === "/boot"),
      );

      const devObj = {
        name: d.name,
        size: d.size,
        model: d.model || (isUsb ? "External USB Storage" : "Internal Disk"),
        mount: d.mountpoint || parts.map((c) => c.mount).find(Boolean) || "",
        os: isOs,
        isUsb,
        isInternal: !isUsb,
        osName,
        kind,
        rotational,
        powerState,
        isStandby,
        apm: rotational ? 127 : null,
        spindownMode,
        isMounted,
        partitions: parts,
        canAdopt: isUsb && isSafeStorageTarget(d.name),
      };

      disks.push(devObj);
      if (isUsb) {
        usbPool.push(devObj);
      } else {
        internalDisks.push(devObj);
      }
    }

    const osDisk = disks.find((d) => d.os) || internalDisks[0];
    const bootDriveRotational = Boolean(osDisk?.rotational);
    const hasExternalStorage = usbPool.some((u) => u.isMounted || u.canAdopt);
    const hybridCachingAllowed = !bootDriveRotational || hasExternalStorage;
    const driveProtectionNotice = bootDriveRotational && !hasExternalStorage
      ? "Protected: Your internal boot disk is a 5,400 RPM mechanical laptop hard drive. Local caching is blocked to prevent drive wear and system stutter. Plug in an external USB SSD to unlock local offline caching."
      : null;

    return {
      ok: true,
      disks,
      usbPool,
      internalDisks,
      totalDevices: all.length,
      storageMode,
      bootDriveRotational,
      hasExternalStorage,
      hybridCachingAllowed,
      driveProtectionNotice,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      disks: [],
      usbPool: [],
      internalDisks: [],
      storageMode,
      bootDriveRotational: false,
      hasExternalStorage: false,
      hybridCachingAllowed: true,
      driveProtectionNotice: null,
    };
  }
}

export function mountUsbPool(targetMountRoot = "/mnt/usb") {
  const result = listStorageDevices();
  if (!result.ok) return result;

  const mounted = [];
  mkdirSync(targetMountRoot, { recursive: true });

  for (const drive of result.usbPool) {
    for (const part of drive.partitions) {
      if (!part.mount && part.fstype) {
        const cleanLabel = (part.label || `drive-${part.name}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        const mountpoint = `${targetMountRoot}/${cleanLabel}`;
        mkdirSync(mountpoint, { recursive: true });

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

export function adoptAndFormatUsb(disk, confirmPhrase) {
  if (confirmPhrase !== "FORMAT") {
    return { ok: false, error: "Must confirm with exact phrase 'FORMAT'" };
  }

  if (!isSafeStorageTarget(disk)) {
    return { ok: false, error: `Drive /dev/${disk} is a system or internal drive and cannot be formatted.` };
  }

  const devPath = `/dev/${disk}`;
  if (!existsSync(devPath)) {
    return { ok: false, error: `Block device ${devPath} not found.` };
  }

  // 1. Unmount all partitions
  spawnSync("sh", ["-c", `umount ${devPath}* 2>/dev/null || true`], { timeout: 10000 });

  // 2. Wipe filesystem signatures
  spawnSync("wipefs", ["-a", devPath], { timeout: 10000 });

  // 3. Create fresh GPT partition table
  spawnSync("parted", ["-s", devPath, "mklabel", "gpt", "mkpart", "primary", "ext4", "1MiB", "100%"], {
    timeout: 15000,
  });

  const partDev = `${devPath}1`;

  // 4. Format to ext4 with 1% reserved blocks
  const mk = spawnSync("mkfs.ext4", ["-F", "-m", "1", "-L", "ReelOS-Pool", partDev], {
    timeout: 30000,
  });

  if (mk.status !== 0) {
    return { ok: false, error: mk.stderr || "mkfs.ext4 failed" };
  }

  // 5. Mount to /mnt/storage
  mkdirSync("/mnt/storage", { recursive: true });
  const m = spawnSync("mount", ["-o", "noatime", partDev, "/mnt/storage"], { timeout: 8000 });
  if (m.status !== 0) {
    return { ok: false, error: m.stderr || "mount failed" };
  }

  return {
    ok: true,
    device: partDev,
    mountpoint: "/mnt/storage",
    label: "ReelOS-Pool",
    adopted: true,
  };
}

export function applyDriveSpindown(disk = "sda", level = 127) {
  const clean = disk.replace(/[^a-z0-9]/gi, "");
  if (!clean) return { ok: false, error: "Invalid disk name" };

  try {
    // APM 127: aggressive power management with spindown enabled
    // -S 120: 10 minute standby timeout
    const cmd = `hdparm -B ${parseInt(level, 10)} -S 120 /dev/${clean}`;
    execSync(cmd, { stdio: "ignore", timeout: 5000 });
    return { ok: true, disk: clean, apm: level, standbyTimeoutMin: 10 };
  } catch (e) {
    return { ok: false, error: e.message, disk: clean };
  }
}

export function listUsbDrives() {
  const res = listStorageDevices();
  if (!res.ok) return { ok: false, error: res.error, drives: [] };
  return {
    ok: true,
    drives: (res.usbPool || []).map((d) => ({
      name: d.name,
      size: d.size,
      model: d.model,
      partitions: d.partitions,
      isMounted: d.isMounted,
      canFormat: d.canAdopt,
    })),
  };
}

export function autoMountUsb() {
  return mountUsbPool("/mnt/usb");
}

export function formatUsbDrive(disk, confirmPhrase) {
  return adoptAndFormatUsb(disk, confirmPhrase);
}

/**
 * Resolves the primary active ReelOS storage pool across platforms.
 * @returns {string}
 */
export function resolveDefaultPoolPath() {
  if (process.env.REELOS_STORAGE_DIR && existsSync(process.env.REELOS_STORAGE_DIR)) {
    return process.env.REELOS_STORAGE_DIR;
  }
  if (existsSync("/mnt/storage")) {
    return "/mnt/storage";
  }
  if (existsSync(".reelos-state/cache")) {
    return ".reelos-state/cache";
  }
  if (process.platform === "win32") {
    return existsSync(".reelos-state") ? ".reelos-state" : "C:\\";
  }
  return "/";
}

/**
 * Checks storage headroom for a given pool path or root.
 * Returns free percentage and byte metrics.
 * @param {string} [poolPath]
 * @returns {{ ok: boolean, totalBytes: number, freeBytes: number, freePercent: number, usedPercent: number, lowHeadroom: boolean, error?: string }}
 */
export function checkStorageHeadroom(poolPath = null, { allowSimulation = true } = {}) {
  // Check if Adversarial Chaos Monkey is actively simulating storage exhaustion
  if (allowSimulation && chaosMonkeyService && typeof chaosMonkeyService.getStorageHeadroomOverride === "function") {
    const chaosOverride = chaosMonkeyService.getStorageHeadroomOverride(poolPath);
    if (chaosOverride) {
      return chaosOverride;
    }
  }

  const resolved = poolPath || resolveDefaultPoolPath();
  try {
    const { statfsSync } = fsMod;
    if (typeof statfsSync === "function") {
      // An absent or inaccessible pool must not silently become the OS drive.
      const stats = statfsSync(resolved);
      const totalBytes = Number(stats.blocks) * Number(stats.bsize);
      const freeBytes = Number(stats.bavail) * Number(stats.bsize);
      if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || !Number.isSafeInteger(freeBytes)
        || freeBytes < 0 || freeBytes > totalBytes) throw new Error("Invalid filesystem measurement");
      const freePercent = (freeBytes / totalBytes) * 100;
      const usedPercent = 100 - freePercent;
      return {
        ok: true,
        available: true,
        totalBytes,
        freeBytes,
        freePercent: Math.round(freePercent * 10) / 10,
        usedPercent: Math.round(usedPercent * 10) / 10,
        lowHeadroom: freePercent < 10.0,
      };
    }
  } catch {}

  return {
    ok: false,
    available: false,
    totalBytes: null,
    freeBytes: null,
    freePercent: null,
    usedPercent: null,
    lowHeadroom: true,
    error: "Storage space could not be measured on this volume.",
  };
}

/**
 * Read-only media inventory. File age does not establish watched state or
 * disposable ownership, so these results must never authorize deletion.
 * @param {string} mediaDir
 * @param {Array<Object>} [results]
 * @returns {Array<{ path: string, sizeBytes: number, atime: number, mtime: number }>}
 */
export function scanWatchedMediaCandidates(mediaDir, results = []) {
  if (!existsSync(mediaDir)) return results;
  try {
    const entries = fsMod.readdirSync(mediaDir, { withFileTypes: true });
    for (const ent of entries) {
      const full = `${mediaDir}/${ent.name}`;
      if (ent.isDirectory()) {
        if (!ent.name.startsWith(".git") && !ent.name.startsWith("node_modules")) {
          scanWatchedMediaCandidates(full, results);
        }
      } else if (ent.isFile()) {
        const lower = ent.name.toLowerCase();
        if (
          lower.endsWith(".mp4") ||
          lower.endsWith(".mkv") ||
          lower.endsWith(".webm") ||
          lower.endsWith(".mov") ||
          lower.endsWith(".ts")
        ) {
          try {
            const st = fsMod.statSync(full);
            results.push({
              path: full,
              sizeBytes: st.size,
              atime: st.atimeMs || st.mtimeMs,
              mtime: st.mtimeMs,
            });
          } catch {}
        }
      }
    }
  } catch {}
  return results;
}

/**
 * Reports storage pressure without deleting media. Automatic cleanup remains
 * unavailable until a durable managed/disposable ownership registry can also
 * verify retention pins and active playback. Directory names, file age, caller
 * options, and a low-space reading are not ownership evidence.
 * @param {string} poolPath
 * @param {Object} [options]
 * @param {number} [options.targetFreePercent=15]
 * @param {string} [options.mediaDir]
 * @param {boolean} [options.dryRun=false]
 * @param {number} [options.forcedFreePercent]
 * @returns {{ ok: boolean, evicted: boolean, freePercent: number, freedBytes: number, items: Array<string> }}
 */
export function runBackgroundLruEviction(poolPath = null, options = {}) {
  const resolvedPool = poolPath || resolveDefaultPoolPath();
  const headroom = checkStorageHeadroom(resolvedPool);
  const currentFreePercent = Number.isFinite(options.forcedFreePercent)
    ? options.forcedFreePercent : headroom.freePercent;

  // In particular, never scan a default/root pool or honor a caller-supplied
  // mediaDir as permission to remove its contents. Dry runs cannot claim bytes
  // were freed either. There is currently no authoritative cleanup adapter.
  return {
    ok: false,
    available: false,
    code: "managed_retention_unavailable",
    reason: "Automatic cleanup is not connected to verified managed-media ownership, retention pins, and active playback. No files were scanned or changed.",
    evicted: false,
    freePercent: currentFreePercent,
    lowHeadroom: currentFreePercent < 10,
    freedBytes: 0,
    items: [],
  };
}

/**
 * Storage Pool Watchdog Service
 */
export class StoragePoolWatchdog {
  constructor() {
    this.intervalTimer = null;
    this.poolPath = resolveDefaultPoolPath();
    this.isActive = false;
    this.lastEvictionResult = null;
  }

  startWatchdog(intervalMs = 60000, poolPath = null) {
    if (poolPath) this.poolPath = poolPath;
    if (this.intervalTimer) return;

    this.isActive = true;
    this.intervalTimer = setInterval(() => {
      try {
        const headroom = checkStorageHeadroom(this.poolPath);
        if (headroom.lowHeadroom) {
          this.lastEvictionResult = runBackgroundLruEviction(this.poolPath);
        } else {
          this.lastEvictionResult = null;
        }
      } catch {}
    }, intervalMs);

    if (this.intervalTimer.unref) this.intervalTimer.unref();
  }

  stopWatchdog() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isActive = false;
  }

  getStatus() {
    return {
      isActive: this.isActive,
      poolPath: this.poolPath,
      headroom: checkStorageHeadroom(this.poolPath),
      cleanup: { available: false, status: "not-connected", code: "managed_retention_unavailable" },
      lastEvictionResult: this.lastEvictionResult,
    };
  }
}

export const storageWatchdog = new StoragePoolWatchdog();
