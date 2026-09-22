import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

const CABIN_FILE = "/var/lib/reelos/cabin-mode.json";
const VAULT_DIR = "/srv/media/offline_vault";

export function getCabinStatus(filePath = CABIN_FILE, vaultDir = VAULT_DIR) {
  let active = false;
  if (existsSync(filePath)) {
    try {
      const data = JSON.parse(readFileSync(filePath, "utf8"));
      active = Boolean(data.active);
    } catch {
      active = false;
    }
  }

  let itemCount = 0;
  let totalBytes = 0;
  if (existsSync(vaultDir)) {
    try {
      const entries = readdirSync(vaultDir);
      itemCount = entries.length;
      for (const e of entries) {
        try {
          const st = statSync(join(vaultDir, e));
          totalBytes += st.size;
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  return {
    ok: true,
    active,
    vaultDir,
    itemCount,
    totalBytes,
    totalMb: Math.round(totalBytes / (1024 * 1024)),
    label: active ? "Cabin Mode (Offline Standalone Active)" : "Connected Living Room Mode",
  };
}

export function setCabinMode(active, filePath = CABIN_FILE) {
  const state = { active: Boolean(active), updatedAt: Date.now() };
  try {
    writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
    return { ok: true, active: state.active };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function syncTitleToVault(titleId, titleName, sourcePath, vaultDir = VAULT_DIR) {
  if (!existsSync(vaultDir)) {
    try {
      mkdirSync(vaultDir, { recursive: true });
    } catch (e) {
      return { ok: false, error: `Failed to create vault dir: ${e}` };
    }
  }

  const safeName = (titleName || titleId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const destPath = join(vaultDir, safeName);

  if (sourcePath && existsSync(sourcePath)) {
    try {
      copyFileSync(sourcePath, destPath);
      return { ok: true, synced: true, destPath };
    } catch {
      try {
        symlinkSync(sourcePath, destPath);
        return { ok: true, synced: true, destPath, symlink: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
  }

  return { ok: true, registered: true, destPath };
}
