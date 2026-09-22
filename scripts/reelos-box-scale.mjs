/** Hardware profile: CPU/RAM/disk. 4GB fixture stays conservative; laptops scale up. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

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

/** Detect GPU hardware acceleration type: 'qsv' (Intel), 'nvenc' (Nvidia), 'vaapi' (AMD/generic), or 'none' (Potato mode). */
export function detectGpuType({
  driPath = "/dev/dri",
  entries = null,
  exists = existsSync,
  readdir = readdirSync,
  pciVendors = [],
  cpuModel = "",
} = {}) {
  if (
    exists("/dev/nvidiactl") ||
    exists("/dev/nvidia0") ||
    pciVendors.some((v) => ["0x10de", "10de"].includes(String(v).toLowerCase())) ||
    exists("C:\\Windows\\System32\\nvcuda.dll") ||
    exists("C:\\Windows\\System32\\nvapi64.dll")
  ) {
    return "nvenc";
  }
  if (pciVendors.some((v) => ["0x8086", "8086"].includes(String(v).toLowerCase()))) {
    return "qsv";
  }
  if (pciVendors.some((v) => ["0x1002", "1002"].includes(String(v).toLowerCase()))) {
    return "vaapi";
  }
  if (process.platform === "win32") {
    const mlow = String(cpuModel || "").toLowerCase();
    if (["intel", "pentium", "celeron", "core", "xeon"].some((b) => mlow.includes(b))) {
      return "qsv";
    }
    return "none";
  }
  if (!hasVaapiDri({ driPath, entries, exists, readdir })) {
    return "none";
  }
  const mlow = String(cpuModel || "").toLowerCase();
  if (["intel", "pentium", "celeron", "core", "xeon"].some((b) => mlow.includes(b))) {
    return "qsv";
  }
  return "vaapi";
}

export function loadHigh(load1, threshold = LOAD_HIGH) {
  return Number(load1) >= threshold;
}

export function anythingPlaying({ psArgs = "", sessionsJson = "" } = {}) {
  if (globalThis.__reelosActiveStreams && Number(globalThis.__reelosActiveStreams) > 0) return true;
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
    return Math.round(os.totalmem() / 1024);
  }
}

let _lastCpuSnapshot = null;
let _lastCalculatedLoad = 0;

export function readHostCpuUsage() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total, count: cpus.length || 1 };
}

export function readHostLoad1() {
  try {
    return loadavg1(readFileSync("/proc/loadavg", "utf8"));
  } catch {
    const avg = os.loadavg();
    if (Array.isArray(avg) && avg[0] && avg[0] > 0) return avg[0];

    const current = readHostCpuUsage();
    if (_lastCpuSnapshot) {
      const deltaIdle = current.idle - _lastCpuSnapshot.idle;
      const deltaTotal = current.total - _lastCpuSnapshot.total;
      if (deltaTotal > 0) {
        const usage = Math.max(0, Math.min(1, 1 - deltaIdle / deltaTotal));
        _lastCalculatedLoad = Math.round(usage * current.count * 100) / 100;
      }
    }
    _lastCpuSnapshot = current;
    return _lastCalculatedLoad;
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

export function diskTypeLabel(kind) {
  const k = String(kind || "");
  if (k === "rotational") return "spinning disk";
  if (k === "ssd") return "SSD";
  return "disk";
}

export function splashTuneFromProfile(profile = {}) {
  const tiny = Boolean(profile.tiny);
  const kind = String(profile.diskKind || profile.disk_kind || "");
  const model = String(profile.cpuModel || profile.cpu_model || "");
  const product = String(profile.product || "");
  const ramGb = Number(profile.ramGb ?? profile.ram_gb) || 0;
  const isApple = /(?:Apple\s+M\d|Apple\s+Silicon|VirtualApple)/i.test(`${model} ${product}`);
  if (isApple) {
    if (ramGb <= 2.5) return "Tuning for Apple Silicon (2GB Minimal VM)…";
    if (ramGb >= 7) return `Tuning for Apple Silicon (${Math.round(ramGb)}GB Performance VM)…`;
    return `Tuning for Apple Silicon (${Math.max(3, Math.round(ramGb))}GB VM)…`;
  }
  if (tiny && kind === "rotational") return "Tuning for 4GB RAM · spinning disk";
  if (tiny) return "Tuning for 4GB RAM…";
  if (kind === "rotational") return "Tuning for spinning disk…";
  return "";
}

export function hardwareProfilePath(state = process.env.REELOS_STATE || (process.platform === "win32" ? ".reelos-state" : "/var/lib/reelos")) {
  return join(state || (process.platform === "win32" ? ".reelos-state" : "/var/lib/reelos"), "hardware-profile.json");
}

export const HARDWARE_PROFILE_PATH = hardwareProfilePath();

export function loadSavedHardware({ path = hardwareProfilePath(), readFile = readFileSync } = {}) {
  try {
    const doc = JSON.parse(readFile(path, "utf8"));
    if (!doc || !(doc.ram_kb || doc.ramKb)) return null;
    return doc;
  } catch {
    if (process.platform === "win32" && (path.includes("/var/lib") || path.includes("\\var\\lib"))) {
      try {
        const localDoc = JSON.parse(readFile(".reelos-state/hardware-profile.json", "utf8"));
        if (localDoc && (localDoc.ram_kb || localDoc.ramKb)) return localDoc;
      } catch {}
    }
    return null;
  }
}

export function hardwareProfile({
  ramKb = 0,
  cpus = 1,
  diskKind = "unknown",
  diskFreeGb = 0,
  diskSizeGb = 0,
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
    diskSizeGb: Number(diskSizeGb) || 0,
    disk_size_gb: Number(diskSizeGb) || 0,
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
  const model = String(profile.cpuModel || profile.cpu_model || "");
  const product = String(profile.product || "");
  const isApple = /(?:Apple\s+M\d|Apple\s+Silicon|VirtualApple)/i.test(`${model} ${product}`);
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
  let transcodeCacheTarget;
  let tiny;

  if (isApple) {
    if (ramGb <= 2.5) {
      tiny = true;
      catchupMemoryMax = "512M";
      jellyfinMem = "512M";
      sonarrMem = "192M";
      radarrMem = "192M";
      nice = 10;
      ioprio = 4;
      catchupFolders = Math.min(24, Math.max(6, cpus * 2));
      provisionFolders = Math.min(48, Math.max(12, cpus * 4));
      catchupChunk = Math.min(24, Math.max(8, cpus * 2));
      provisionChunk = Math.min(40, Math.max(20, cpus * 4));
      transcodeCacheTarget = "disk";
    } else if (ramGb < 7) {
      tiny = false;
      catchupMemoryMax = "1G";
      jellyfinMem = "1024M";
      sonarrMem = "256M";
      radarrMem = "256M";
      nice = 0;
      ioprio = 4;
      catchupFolders = Math.min(48, Math.max(16, cpus * 4));
      provisionFolders = Math.min(96, Math.max(32, cpus * 6));
      catchupChunk = Math.min(32, Math.max(16, cpus * 4));
      provisionChunk = Math.min(60, Math.max(30, cpus * 6));
      transcodeCacheTarget = "disk";
    } else {
      tiny = false;
      catchupMemoryMax = ramGb < 20 ? "2G" : "4G";
      jellyfinMem = `${Math.max(2, Math.trunc(ramGb * 0.35))}G`;
      sonarrMem = `${Math.max(1, Math.trunc(ramGb * 0.15))}G`;
      radarrMem = `${Math.max(1, Math.trunc(ramGb * 0.12))}G`;
      nice = 0;
      ioprio = 4;
      catchupFolders = Math.min(128, Math.max(24, cpus * 8));
      provisionFolders = Math.min(256, Math.max(48, cpus * 12));
      catchupChunk = Math.min(64, Math.max(16, cpus * 4));
      provisionChunk = Math.min(80, Math.max(40, cpus * 6));
      transcodeCacheTarget = "shm";
    }
  } else {
    transcodeCacheTarget = ramGb < 12 ? "disk" : "shm";
    tiny = Boolean(profile.tiny) || (ramKb > 0 && ramKb <= SMALL_MEM_KB) || ramGb <= TINY_RAM_GB;
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
  }
  if (free > 0 && free < 5) {
    catchupFolders = Math.max(4, Math.floor(catchupFolders / 2));
    provisionFolders = Math.max(6, Math.floor(provisionFolders / 2));
  }
  const hdd = kind === "rotational";
  const constrained = tiny || hdd;
  const parallel = constrained ? 1 : Math.min(4, cpus);
  const gpuType = String(profile.gpuType || profile.gpu_type || "none");
  const hasHwGpu = ["qsv", "nvenc", "vaapi"].includes(gpuType) || isApple;
  const potatoMode = Boolean(profile.potatoMode ?? profile.potato_mode ?? !hasHwGpu);
  return {
    tiny,
    lowPerf: tiny,
    isAppleSilicon: isApple,
    transcodeCacheTarget,
    gpuType,
    potatoMode,
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
    zram: hdd && !isApple,
    disableKdump: tiny,
    searchParallelism: parallel,
    indexerParallelism: parallel,
    splashTune: splashTuneFromProfile({ tiny, diskKind: kind, cpuModel: model, product, ramGb }),
  };
}

export function publicHardware(saved, fallbackMemKb = 0) {
  const memKb = Number(fallbackMemKb) || 0;
  if (saved && (saved.summary || saved.ram_kb || saved.ramKb)) {
    const tiny = Boolean(saved.tiny) || boxIsSmall(saved.ram_kb || saved.ramKb || memKb);
    const knobs = saved.knobs || {};
    const diskKind = saved.disk_kind || saved.diskKind || "unknown";
    let gpuType = saved.gpu_type || saved.gpuType || knobs.gpu_type;
    if (!gpuType || gpuType === "none") {
      gpuType = detectGpuType({ cpuModel: saved.cpu_model || saved.cpuModel });
    }
    const hasHwGpu = ["qsv", "nvenc", "vaapi"].includes(gpuType);
    const potatoMode = Boolean(knobs.potato_mode ?? (tiny || !hasHwGpu));
    return {
      probed: Boolean(saved.probed_at || saved.probe_version),
      probeVersion: saved.probe_version || 0,
      probedAt: saved.probed_at || null,
      summary: saved.summary || summaryFromProfile(saved),
      splashTune: splashTuneFromProfile({ tiny, diskKind, disk_kind: diskKind }),
      ramGb: saved.ram_gb ?? saved.ramGb ?? ramGbFromKb(saved.ram_kb || saved.ramKb || 0),
      cpus: saved.cpus || 1,
      cpuModel: saved.cpu_model || saved.cpuModel || "",
      gpuType,
      potatoMode,
      diskKind,
      diskTypeLabel: diskTypeLabel(diskKind),
      diskSizeGb: Number(saved.disk_size_gb ?? saved.diskSizeGb) || 0,
      diskFreeGb: Number(saved.disk_free_gb ?? saved.diskFreeGb) || 0,
      product: saved.product || "",
      rootOnUsb: Boolean(saved.root_on_usb || saved.rootOnUsb),
      tiny,
      knobs: {
        lowPerf: knobs.low_perf ?? tiny,
        gpuType,
        potatoMode,
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
  let fallbackCpus = 1;
  let fallbackCpuModel = "";
  try {
    const cpusInfo = os.cpus();
    fallbackCpus = cpusInfo.length || 1;
    fallbackCpuModel = cpusInfo[0]?.model || "";
  } catch (e) {}

  const fallbackRamGb = ramGbFromKb(memKb);
  const fallbackGpuType = detectGpuType({ cpuModel: fallbackCpuModel });
  const hasHwGpu = ["qsv", "nvenc", "vaapi"].includes(fallbackGpuType);
  const fallbackPotato = tiny || !hasHwGpu;
  const rLabel = ramLabel(fallbackRamGb, memKb);

  if (tiny) {
    return {
      probed: false,
      probeVersion: 0,
      probedAt: null,
      summary: `${rLabel} · ${fallbackCpuModel || "unknown CPU"} · disk unknown · root-on-internal`,
      splashTune: "Tuning for 4GB RAM…",
      ramGb: fallbackRamGb,
      cpus: fallbackCpus,
      cpuModel: fallbackCpuModel,
      gpuType: fallbackGpuType,
      potatoMode: true,
      diskKind: "unknown",
      diskTypeLabel: "disk",
      diskSizeGb: 0,
      diskFreeGb: 0,
      product: "",
      rootOnUsb: false,
      tiny: true,
      knobs: {
        lowPerf: true,
        gpuType: fallbackGpuType,
        potatoMode: true,
        fuseCount: 1,
        skipDumpFfprobe: true,
        zram: false,
        disableKdump: true,
        searchParallelism: 1,
        indexerParallelism: 1,
      },
    };
  }

  return {
    probed: false,
    probeVersion: 0,
    probedAt: null,
    summary: "Hardware profile: Not measured yet (runs on first boot / calibration)",
    splashTune: "",
    ramGb: 0,
    cpus: fallbackCpus,
    cpuModel: fallbackCpuModel,
    gpuType: fallbackGpuType,
    potatoMode: fallbackPotato,
    diskKind: "unknown",
    diskTypeLabel: "disk",
    diskSizeGb: 0,
    diskFreeGb: 0,
    product: "",
    rootOnUsb: false,
    tiny: false,
    knobs: {
      lowPerf: false,
      gpuType: fallbackGpuType,
      potatoMode: fallbackPotato,
      fuseCount: 1,
      skipDumpFfprobe: false,
      zram: false,
      disableKdump: false,
      searchParallelism: fallbackCpus > 1 ? Math.min(4, fallbackCpus) : 1,
      indexerParallelism: fallbackCpus > 1 ? Math.min(4, fallbackCpus) : 1,
    },
  };
}
export function importChunkSize(profile, { catchUp = false, dState = 0 } = {}) {
  if (Number(dState) > 0) return 0;
  const lim = hardwareLimits(profile);
  return catchUp ? lim.importChunkCatchup : lim.importChunkProvision;
}

export function getAdaptiveMemoryCeiling(options = {}) {
  const platform = options.platform || process.platform;
  const totalMem = options.totalMem || os.totalmem();
  const freeMem = options.freeMem || os.freemem();
  const isDedicated = options.isDedicated ?? (platform !== "win32" && platform !== "darwin");
  const isStealth = Boolean(options.isStealth || options.gamingActive || options.creatorActive);

  const totalMb = Math.round(totalMem / (1024 * 1024));
  const freeMb = Math.round(freeMem / (1024 * 1024));
  const totalRamGb = totalMem / (1024 ** 3);

  if (isDedicated) {
    // Law 1: Dedicated appliances use 100% of RAM.
    // Potatoes (<6GB) preserve 1GB video/FUSE headroom; 8GB+ uses Total - 256MB.
    const applianceBudgetMb = totalRamGb < 6
      ? Math.max(128, totalMb - 1024)
      : Math.max(512, totalMb - 256);

    return {
      mode: "dedicated_appliance",
      targetMemoryMb: applianceBudgetMb,
      maxSystemMemoryMb: totalMb,
      freeMemoryMb: freeMb,
      allowEvictionOnPressure: false,
      stealthMemoryFloorMb: 64,
      videoHeadroomMb: totalRamGb < 6 ? 1024 : 256,
    };
  }

  // Shared PC (Windows / macOS)
  if (isStealth) {
    // Stealth mode upon gaming or heavy creator app launch: 32MB–64MB floor
    return {
      mode: "stealth_yield",
      targetMemoryMb: 32,
      maxSystemMemoryMb: totalMb,
      freeMemoryMb: freeMb,
      allowEvictionOnPressure: true,
      stealthMemoryFloorMb: 32,
      videoHeadroomMb: 1024,
    };
  }

  // Normal shared desktop: 128MB–256MB baseline, up to 10% free RAM when idle for Criterion manifolds
  const targetMb = Math.min(256, Math.max(128, Math.round(freeMb * 0.1)));
  return {
    mode: platform === "win32" ? "elastic_windows" : "elastic_shared",
    targetMemoryMb: targetMb,
    maxSystemMemoryMb: totalMb,
    freeMemoryMb: freeMb,
    allowEvictionOnPressure: true,
    stealthMemoryFloorMb: 32,
    videoHeadroomMb: 512,
  };
}

