/** 4GB detect: MemTotal/load, not only the low-perf toggle. GPU = /dev/dri render/card. */
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const SMALL_MEM_KB = 4_718_592; // 4.5 Gi
export const LOAD_HIGH = 2;

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
