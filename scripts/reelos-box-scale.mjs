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

export function cpuShort(model, cpus) {
  const raw = String(model || "")
    .replace(/\((?:R|TM)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = raw.match(/(Pentium|Celeron|Xeon|Ryzen|Athlon|Core i[3579]|Apple M\d)(?:\s+CPU)?\s+([A-Z0-9-]+)/i);
  const name = m ? `${m[1]} ${m[2]}` : (raw.split("@")[0].trim() || "CPU").slice(0, 28);
  return `${Math.max(1, Number(cpus) || 1)}c ${name}`;
}

export function ramLabel(ramGb, ramKb = 0) {
  let gb = Number(ramGb) || 0;
  if (gb <= 0 && ramKb) gb = ramGbFromKb(ramKb);
  let gi = 0;
  if (gb > 0 && gb <= 4.5) gi = gb >= 2.5 ? 4 : Math.max(1, Math.round(gb));
  else if (gb) gi = Math.max(1, Math.round(gb));
  return gi ? `${gi}Gi RAM` : "RAM unknown";
}

export function summaryFromProfile(profile = {}) {
  if (profile.summary) return String(profile.summary);
  const ram = ramLabel(profile.ramGb ?? profile.ram_gb, profile.ramKb ?? profile.ram_kb);
  const cpu = cpuShort(profile.cpuModel || profile.cpu_model || "", profile.cpus || 1);
  const kind = String(profile.diskKind || profile.disk_kind || "unknown");
  const disk = kind === "rotational" ? "HDD" : kind === "ssd" ? "SSD" : "disk";
  const root = profile.rootOnUsb || profile.root_on_usb ? "root-on-usb" : "root-on-internal";
  return `${ram} · ${cpu} · ${disk} · ${root}`;
}

export function splashTuneFromProfile(profile = {}) {
  if (profile.splashTune || profile.splash_tune) return String(profile.splashTune || profile.splash_tune);
  const tiny = Boolean(profile.tiny);
  const kind = String(profile.diskKind || profile.disk_kind || "");
  if (tiny && kind === "rotational") return "Tuning for 4GB HDD…";
  if (tiny) return "Tuning for 4GB RAM…";
  if (kind === "rotational") return "Tuning for HDD…";
  return "";
}

export function hardwareProfilePath(state = process.env.REELOS_STATE || "/var/lib/reelos") {
  return `${String(state || "/var/lib/reelos").replace(/\/$/, "")}/hardware-profile.json`;
}

export const HARDWARE_PROFILE_PATH = hardwareProfilePath();

export function loadSavedHardware({ path = hardwareProfilePath(), readFile = readFileSync } = {}) {
  try {
    const doc = JSON.parse(readFile(path, "utf8"));
    if (!doc || !(doc.ram_kb || doc.ramKb)) return null;
    return doc;
  } catch {
    return null;
  }
}

export function hardwareProfile({
  ramKb = 0,
  cpus = 1,
  diskKind = "unknown",
  diskFreeGb = 0,
  cpuModel = "",
  product = "",
  rootOnUsb = false,
  kdumpReservedKb = 0,
} = {}) {
  const kb = Number(ramKb) || 0;
  const tiny = kb > 0 && kb <= SMALL_MEM_KB;
  const kind = ["ssd", "rotational", "unknown"].includes(diskKind) ? diskKind : "unknown";
  const prof = {
    ramKb: kb,
    ram_kb: kb,
    ramGb: ramGbFromKb(kb),
    ram_gb: ramGbFromKb(kb),
    cpus: Math.max(1, Number(cpus) || 1),
    diskKind: kind,
    disk_kind: kind,
    diskFreeGb: Number(diskFreeGb) || 0,
    disk_free_gb: Number(diskFreeGb) || 0,
    tiny,
    boxIsSmall: tiny,
    box_is_small: tiny,
    cpuModel: String(cpuModel || ""),
    cpu_model: String(cpuModel || ""),
    product: String(product || ""),
    rootOnUsb: Boolean(rootOnUsb),
    root_on_usb: Boolean(rootOnUsb),
    kdumpReservedKb: Number(kdumpReservedKb) || 0,
    kdump_reserved_kb: Number(kdumpReservedKb) || 0,
  };
  prof.summary = summaryFromProfile(prof);
  prof.splashTune = splashTuneFromProfile(prof);
  prof.splash_tune = prof.splashTune;
  return prof;
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
    // Keep RAM caps. Scale CPU/SSD; HDD stays on today's 6/12/8/20. Not a Pi.
    catchupMemoryMax = "768M";
    jellyfinMem = null;
    sonarrMem = null;
    radarrMem = null;
    nice = 10;
    if (kind === "ssd") {
      catchupFolders = Math.min(24, Math.max(6, cpus * 2));
      provisionFolders = Math.min(48, Math.max(12, cpus * 4));
      catchupChunk = Math.min(24, Math.max(8, cpus * 2));
      provisionChunk = Math.min(40, Math.max(20, cpus * 4));
      ioprio = 4;
    } else {
      catchupFolders = 6;
      provisionFolders = 12;
      catchupChunk = 8;
      provisionChunk = 20;
      ioprio = 7;
    }
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
  const hdd = kind === "rotational";
  const constrained = tiny || hdd;
  const parallel = constrained ? 1 : Math.min(4, cpus);
  return {
    tiny,
    lowPerf: tiny,
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
    fuseCount: 1,
    skipDumpFfprobe: constrained,
    zram: hdd,
    disableKdump: tiny,
    searchParallelism: parallel,
    indexerParallelism: parallel,
    splashTune: splashTuneFromProfile({ tiny, diskKind: kind }),
  };
}

export function publicHardware(saved, fallbackMemKb = 0) {
  const memKb = Number(fallbackMemKb) || 0;
  if (saved && (saved.summary || saved.ram_kb || saved.ramKb)) {
    const tiny = Boolean(saved.tiny) || boxIsSmall(saved.ram_kb || saved.ramKb || memKb);
    const knobs = saved.knobs || {};
    return {
      probed: Boolean(saved.probed_at || saved.probe_version),
      probeVersion: saved.probe_version || 0,
      probedAt: saved.probed_at || null,
      summary: saved.summary || summaryFromProfile(saved),
      splashTune: knobs.splash_tune || saved.splash_tune || splashTuneFromProfile(saved),
      ramGb: saved.ram_gb ?? saved.ramGb ?? ramGbFromKb(saved.ram_kb || saved.ramKb || 0),
      cpus: saved.cpus || 1,
      cpuModel: saved.cpu_model || saved.cpuModel || "",
      diskKind: saved.disk_kind || saved.diskKind || "unknown",
      product: saved.product || "",
      rootOnUsb: Boolean(saved.root_on_usb || saved.rootOnUsb),
      tiny,
      knobs: {
        lowPerf: knobs.low_perf ?? tiny,
        fuseCount: knobs.fuse_count ?? 1,
        skipDumpFfprobe: knobs.skip_dump_ffprobe ?? (tiny || saved.disk_kind === "rotational"),
        zram: knobs.zram ?? saved.disk_kind === "rotational",
        disableKdump: knobs.disable_kdump ?? tiny,
        searchParallelism: knobs.search_parallelism ?? 1,
        indexerParallelism: knobs.indexer_parallelism ?? 1,
      },
    };
  }
  const tiny = boxIsSmall(memKb);
  return {
    probed: false,
    probeVersion: 0,
    probedAt: null,
    summary: tiny
      ? "4Gi RAM · unknown CPU · disk unknown · root-on-internal"
      : "Not measured yet — ReelOS will probe on the next update or door start.",
    splashTune: tiny ? "Tuning for 4GB RAM…" : "",
    ramGb: tiny ? ramGbFromKb(memKb) : 0,
    cpus: 1,
    cpuModel: "",
    diskKind: "unknown",
    product: "",
    rootOnUsb: false,
    tiny,
    knobs: {
      lowPerf: tiny,
      fuseCount: 1,
      skipDumpFfprobe: tiny,
      zram: false,
      disableKdump: tiny,
      searchParallelism: 1,
      indexerParallelism: 1,
    },
  };
}
export function importChunkSize(profile, { catchUp = false, dState = 0 } = {}) {
  if (Number(dState) > 0) return 0;
  const lim = hardwareLimits(profile);
  return catchUp ? lim.importChunkCatchup : lim.importChunkProvision;
}
