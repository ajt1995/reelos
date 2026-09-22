import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const VAULT_DIR = process.env.REELOS_VAULT_DIR || "/srv/media/offline_vault";

/**
 * Offline & Cabin Service for ReelOS.
 * Manages the local offline media vault and local Wi-Fi Access Point hotspot.
 */

export function getOfflineVaultStatus() {
  if (!existsSync(VAULT_DIR)) {
    try {
      mkdirSync(VAULT_DIR, { recursive: true });
    } catch {
      // Ignore if read-only or in test env
    }
  }

  const files = [];
  let totalBytes = 0;

  if (existsSync(VAULT_DIR)) {
    try {
      const entries = readdirSync(VAULT_DIR, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile()) {
          const p = join(VAULT_DIR, e.name);
          const s = statSync(p);
          totalBytes += s.size;
          files.push({
            name: e.name,
            sizeBytes: s.size,
            sizeMb: Math.round((s.size / (1024 * 1024)) * 10) / 10,
            modified: s.mtime,
          });
        }
      }
    } catch (e) {
      // Return partial
    }
  }

  const hotspot = getHotspotStatus();

  return {
    ok: true,
    vaultDir: VAULT_DIR,
    count: files.length,
    totalBytes,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
    files,
    hotspot,
  };
}

export function getHotspotStatus() {
  try {
    const r = spawnSync("nmcli", ["-t", "-f", "NAME,TYPE,DEVICE", "connection", "show", "--active"], {
      encoding: "utf8",
      timeout: 3000,
    });
    if (r.status === 0 && r.stdout) {
      const isHotspot = r.stdout.includes("Hotspot") || r.stdout.includes("ReelOS-Cabin");
      return {
        active: isHotspot,
        ssid: isHotspot ? "ReelOS-Cabin" : null,
        gateway: "10.42.0.1",
      };
    }
  } catch {
    // nmcli not present or not on Linux
  }

  return { active: false, ssid: null, gateway: null };
}

export function toggleHotspot(enable, ssid = "ReelOS-Cabin", password = "reelosmedia") {
  if (process.platform !== "linux") {
    return {
      ok: false,
      active: false,
      supported: false,
      simulated: false,
      error: "Cabin hotspot control is only available on a ReelOS Linux appliance with NetworkManager.",
    };
  }

  try {
    if (enable) {
      // Start hotspot on wlan0
      const r = spawnSync(
        "nmcli",
        ["dev", "wifi", "hotspot", "ifname", "wlan0", "ssid", ssid, "password", password],
        { encoding: "utf8", timeout: 10000 },
      );
      if (r.status !== 0) {
        return { ok: false, error: r.stderr || "Failed to start Wi-Fi hotspot" };
      }
      return { ok: true, active: true, ssid, password };
    } else {
      // Stop hotspot
      spawnSync("nmcli", ["con", "down", ssid], { encoding: "utf8", timeout: 8000 });
      return { ok: true, active: false };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function purgeVaultFile(filename) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!clean) return { ok: false, error: "Invalid filename" };

  const target = join(VAULT_DIR, clean);
  if (existsSync(target)) {
    try {
      unlinkSync(target);
      return { ok: true, removed: clean };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: "File not found" };
}

export {
  getCabinStatus,
  setCabinMode,
  syncTitleToVault,
} from "../reelos-cabin.mjs";
