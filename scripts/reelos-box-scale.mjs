/** Hardware profile: CPU/RAM/disk. 4GB fixture stays conservative; laptops scale up. */
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const SMALL_MEM_KB = 4_718_592; // 4.5 Gi
export const LOAD_HIGH = 2;
export const TINY_RAM_GB = 4.5;

export const FIXTURE_TINY_4GB = { ramKb: 3_383_440, cpus: 4, diskKind: "rotational", diskFreeGb: 410 };
export const FIXTURE_LAPTOP_16GB = { ramKb: 16 * 1024 * 1024, cpus: 8, diskKind: "ssd", diskFreeGb: 200 };
export const FIXTURE_LAPTOP_32GB = { ramKb: 32 * 1024 * 1024, cpus: 16, diskKind: "ssd", diskFreeGb: 400 };

export function memTotalKb(meminfoText) {
  const m = String(meminfoText || "").match(/^MemTotal:\s+(\d+)/m);
  return m ? Number(m[1]) : 0;
}

export function loadavg1(loadavgText) {
  const n = Number(String(loadavgText || "").trim().split(/\s+/)[0]);
  return Number.isFinite(n) ? n : 0;
}

export function boxIsSmall(memKb) {
  return memKb > 0 && memKb <= SMALL_MEM_KB;
}

/** Host VAAPI node. Missing or empty /dev/dri ⇒ DirectPlay/DirectStream only. */
export function hasVaapiDri({ driPath = "/dev/dri", entries = null, exists = existsSync, readdir = readdirSync } = {}) {
  if (!exists(driPath)) return false;
  if (Array.isArray(entries)) {
    return entries.some((n) => String(n).startsWith("renderD") || String(n).startsWith("card"));
  }
  try {
    return readdir(driPath).some((n) => n.startsWith("renderD") || n.startsWith("card"));
  } catch {
    return true;
  }
}

export function loadHigh(load1, threshold = LOAD_HIGH) {
  return Number(load1) >= threshold;
}

export function anythingPlaying({ psArgs = "", sessionsJson = "" } = {}) {
  const ps = String(psArgs);
  if (/jellyfin/i.test(ps) && /ffmpeg/i.test(ps)) return true;
  if (String(sessionsJson) && /NowPlayingItem/i.test(String(sessionsJson))) return true;
  return false;
}

export function shouldSkipIdleWork({ playing = false, load1 = 0, ffprobeD = 0 } = {}) {
  if (Number(ffprobeD) > 0) return { skip: true, reason: "ffprobe D-state" };
  if (!playing && loadHigh(load1)) return { skip: true, reason: "idle load" };
  return { skip: false, reason: "" };
}

export function readHostMemKb() {
  try {
    return memTotalKb(readFileSync("/proc/meminfo", "utf8"));
  } catch {
    return 0;
  }
}

export function readHostLoad1() {
  try {
    return loadavg1(readFileSync("/proc/loadavg", "utf8"));
  } catch {
    return 0;
  }
}

export function ramGbFromKb(ramKb) {
  return Math.round(((Number(ramKb) || 0) / 1024 / 1024) * 100) / 100;
}

export function hardwareProfile({ ramKb = 0, cpus = 1, diskKind = "unknown", diskFreeGb = 0 } = {}) {
  const kb = Number(ramKb) || 0;
  const tiny = kb > 0 && kb <= SMALL_MEM_KB;
  const kind = ["ssd", "rotational", "unknown"].includes(diskKind) ? diskKind : "unknown";
  return {
    ramKb: kb,
    ramGb: ramGbFromKb(kb),
    cpus: Math.max(1, Number(cpus) || 1),
    diskKind: kind,
    diskFreeGb: Number(diskFreeGb) || 0,
    tiny,
    boxIsSmall: tiny,
  };
}

export function hardwareLimits(profile) {
  const ramGb = Number(profile.ramGb) || 0;
  const ramKb = Number(profile.ramKb) || 0;
  const cpus = Math.max(1, Number(profile.cpus) || 1);
  const kind = String(profile.diskKind || "unknown");
  const free = Number(profile.diskFreeGb) || 0;
  const tiny = Boolean(profile.tiny) || (ramKb > 0 && ramKb <= SMALL_MEM_KB) || ramGb <= TINY_RAM_GB;
  let catchupMemoryMax;
  let jellyfinMem;
  let sonarrMem;
  let radarrMem;
  let catchupFolders;
  let provisionFolders;
  let catchupChunk;
  let provisionChunk;
  let nice;
  let ioprio;
  if (tiny) {
    catchupMemoryMax = "768M";
    jellyfinMem = null;
    sonarrMem = null;
    radarrMem = null;
    catchupFolders = 6;
    provisionFolders = 12;
    catchupChunk = 8;
    provisionChunk = 20;
    nice = 10;
    ioprio = 7;
  } else {
    catchupMemoryMax = ramGb < 12 ? "1G" : ramGb < 20 ? "2G" : ramGb < 28 ? "4G" : "8G";
    jellyfinMem = `${Math.max(2, Math.trunc(ramGb * 0.35))}G`;
    sonarrMem = `${Math.max(1, Math.trunc(ramGb * 0.15))}G`;
    radarrMem = `${Math.max(1, Math.trunc(ramGb * 0.12))}G`;
    if (kind === "rotational") {
      catchupFolders = Math.min(48, Math.max(16, cpus * 4));
      provisionFolders = Math.min(96, Math.max(32, cpus * 6));
    } else {
      catchupFolders = Math.min(128, Math.max(24, cpus * 8));
      provisionFolders = Math.min(256, Math.max(48, cpus * 12));
    }
    catchupChunk = Math.min(64, Math.max(16, cpus * 4));
    provisionChunk = Math.min(80, Math.max(40, cpus * 6));
    nice = 0;
    ioprio = 4;
  }
  if (free > 0 && free < 5) {
    catchupFolders = Math.max(4, Math.floor(catchupFolders / 2));
    provisionFolders = Math.max(6, Math.floor(provisionFolders / 2));
  }
  return {
    tiny,
    catchupMemoryMax,
    jellyfinMem,
    sonarrMem,
    radarrMem,
    importFolderCapCatchup: catchupFolders,
    importFolderCapProvision: provisionFolders,
    importChunkCatchup: catchupChunk,
    importChunkProvision: provisionChunk,
    dBackoffLimit: 1,
    nice,
    ioprio,
  };
}

/** High D-state is I/O backpressure — concurrency 0 on any hardware. */
export function importChunkSize(profile, { catchUp = false, dState = 0 } = {}) {
  if (Number(dState) > 0) return 0;
  const lim = hardwareLimits(profile);
  return catchUp ? lim.importChunkCatchup : lim.importChunkProvision;
}
