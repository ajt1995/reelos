import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const STATE_DIR = process.env.REELOS_STATE || "/var/lib/reelos";
const BENCHMARK_FILE = join(STATE_DIR, "benchmark.json");
// `os.totalmem()` can vary slightly between boots on some platforms. This is
// deliberately much smaller than a normal RAM tier boundary, while tolerating
// harmless accounting differences.
const RAM_IDENTITY_TOLERANCE_BYTES = 256 * 1024 * 1024;
const VALID_SILICON_TIERS = new Set(["potato", "balanced", "powerhouse"]);

function normalizeCpuModel(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function getLocalHardwareIdentity(system = os) {
  const cpuInfo = system.cpus();
  return {
    cpuModel: normalizeCpuModel(cpuInfo?.[0]?.model),
    cpuCount: Array.isArray(cpuInfo) ? cpuInfo.length : 0,
    totalRamBytes: system.totalmem(),
  };
}

export function isValidHardwareIdentity(identity) {
  return Boolean(
    identity
    && normalizeCpuModel(identity.cpuModel)
    && Number.isSafeInteger(identity.cpuCount)
    && identity.cpuCount > 0
    && Number.isSafeInteger(identity.totalRamBytes)
    && identity.totalRamBytes > 0,
  );
}

export function isCompatibleBenchmarkCache(cachedBenchmark, currentHardware) {
  if (
    !cachedBenchmark
    || cachedBenchmark.ok !== true
    || !VALID_SILICON_TIERS.has(cachedBenchmark.tier)
    || !isValidHardwareIdentity(cachedBenchmark.hardware)
    || !isValidHardwareIdentity(currentHardware)
  ) {
    return false;
  }

  const cachedHardware = cachedBenchmark.hardware;
  return normalizeCpuModel(cachedHardware.cpuModel) === normalizeCpuModel(currentHardware.cpuModel)
    && cachedHardware.cpuCount === currentHardware.cpuCount
    && Math.abs(cachedHardware.totalRamBytes - currentHardware.totalRamBytes)
      <= RAM_IDENTITY_TOLERANCE_BYTES;
}

export function classifySiliconTier(metrics = {}) {
  const ramGb = metrics.ramGb ?? (os.totalmem() / (1024 * 1024 * 1024));
  const cpus = metrics.cpus ?? os.cpus().length;
  const cpuScoreMs = metrics.cpuScoreMs ?? 500;
  const ramThroughputMBs = metrics.ramThroughputMBs ?? 1000;
  const isRotational = Boolean(metrics.isRotational);

  // Criteria for Tier 1: Potato / Ultra-Budget Appliance
  // - Low RAM (<= 4.5 GB) OR weak CPU (score > 900ms) OR mechanical HDD root
  if (ramGb <= 4.5 || cpus <= 4 && cpuScoreMs > 700 || isRotational && ramGb <= 6) {
    return {
      tier: "potato",
      tierNumber: 1,
      label: "Tier 1 · Potato / Ultra-Budget",
      badge: "Conservative Resource Policy",
      description: "Conservative appliance resource policy with DirectPlay-oriented limits and 64MB memory prefetch. Encoding support must be verified separately.",
      knobs: {
        directPlayOnly: true,
        maxTranscodes: 0,
        prefetchMb: 64,
        apmSpindownMin: 5,
        concurrentScans: 1,
        enableMotion: false,
        dotnetGcServer: 0,
        dotnetGcHeapHardLimit: "0x6000000",
        nodeMaxOldSpaceMb: 64,
        memLimitJellyfin: "256m",
        memLimitRadarr: "96m",
        memLimitSonarr: "96m",
        memLimitProwlarr: "64m",
        memLimitDecypharr: "128m",
        memLimitSeerr: "64m",
        enableBazarr: false,
      },
    };
  }

  // Criteria for Tier 3: Powerhouse
  // - 16GB+ RAM AND fast CPU (score < 250ms) AND fast RAM (> 2500 MB/s)
  if (ramGb >= 14 && cpuScoreMs < 300 && ramThroughputMBs > 2000) {
    return {
      tier: "powerhouse",
      tierNumber: 3,
      label: "Tier 3 · Powerhouse Server",
      badge: "High-throughput Policy",
      description: "High-throughput server policy with higher concurrency and 256MB RAM stream prefetch. Encoding support must be verified separately.",
      knobs: {
        directPlayOnly: false,
        maxTranscodes: 6,
        prefetchMb: 256,
        apmSpindownMin: 30,
        concurrentScans: 4,
        enableMotion: true,
        dotnetGcServer: 1,
        dotnetGcHeapHardLimit: "",
        nodeMaxOldSpaceMb: 512,
        memLimitJellyfin: "2048m",
        memLimitRadarr: "384m",
        memLimitSonarr: "384m",
        memLimitProwlarr: "256m",
        memLimitDecypharr: "512m",
        memLimitSeerr: "192m",
        enableBazarr: true,
      },
    };
  }

  // Default: Tier 2: Balanced Appliance
  return {
    tier: "balanced",
    tierNumber: 2,
    label: "Tier 2 · Balanced Appliance",
    badge: "Balanced Resource Policy",
    description: "Balanced media appliance policy with 128MB RAM stream prefetch. Encoding support must be verified separately.",
    knobs: {
      directPlayOnly: false,
      maxTranscodes: 2,
      prefetchMb: 128,
      apmSpindownMin: 15,
      concurrentScans: 2,
      enableMotion: true,
      dotnetGcServer: 0,
      dotnetGcHeapHardLimit: "0xC000000",
      nodeMaxOldSpaceMb: 128,
      memLimitJellyfin: "512m",
      memLimitRadarr: "192m",
      memLimitSonarr: "192m",
      memLimitProwlarr: "128m",
      memLimitDecypharr: "256m",
      memLimitSeerr: "96m",
      enableBazarr: true,
    },
  };
}

export function runSiliconBenchmarkSync() {
  const startCpu = performance.now();
  let acc = 0;
  for (let i = 0; i < 50_000; i++) {
    acc += Math.sqrt(i) * Math.sin(i);
  }
  const cpuScoreMs = Math.max(1, Math.round(performance.now() - startCpu));

  // RAM throughput microbenchmark (16MB buffer copy)
  const bufSize = 16 * 1024 * 1024;
  const startRam = performance.now();
  const buf = Buffer.alloc(bufSize);
  for (let i = 0; i < bufSize; i += 4096) {
    buf[i] = (acc + i) & 0xff;
  }
  const ramElapsedMs = Math.max(1, performance.now() - startRam);
  const ramThroughputMBs = Math.round((bufSize / (1024 * 1024)) / (ramElapsedMs / 1000));

  const hardware = getLocalHardwareIdentity();
  const ramGb = Math.round((hardware.totalRamBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const cpus = hardware.cpuCount;

  // Rotational check on root
  let isRotational = false;
  try {
    const rot = readFileSync("/sys/block/sda/queue/rotational", "utf8").trim();
    isRotational = rot === "1";
  } catch {}

  const tierInfo = classifySiliconTier({
    ramGb,
    cpus,
    cpuScoreMs,
    ramThroughputMBs,
    isRotational,
  });

  const benchmark = {
    ok: true,
    tier: tierInfo.tier,
    tierNumber: tierInfo.tierNumber,
    label: tierInfo.label,
    badge: tierInfo.badge,
    description: tierInfo.description,
    knobs: tierInfo.knobs,
    cpuScoreMs,
    ramThroughputMBs,
    benchmarkType: "local-cpu-memory-microbenchmark",
    capabilityNote: "This local CPU and memory microbenchmark guides resource policy only; it does not verify codec, accelerator, or media encoding capability.",
    hardware,
    metrics: {
      cpuScoreMs,
      ramThroughputMBs,
      ramGb,
      cpus,
      cpuModel: hardware.cpuModel || "Unknown",
      isRotational,
      durationMs: cpuScoreMs + Math.round(ramElapsedMs),
    },
    benchmarkedAt: Date.now(),
  };

  try {
    writeFileSync(BENCHMARK_FILE, JSON.stringify(benchmark, null, 2), "utf8");
  } catch {}

  return benchmark;
}

export function getSiliconBenchmark({
  benchmarkFile = BENCHMARK_FILE,
  exists = existsSync,
  readFile = readFileSync,
  getHardware = getLocalHardwareIdentity,
  runBenchmark = runSiliconBenchmarkSync,
} = {}) {
  try {
    const currentHardware = getHardware();
    if (exists(benchmarkFile)) {
      const data = JSON.parse(readFile(benchmarkFile, "utf8"));
      if (isCompatibleBenchmarkCache(data, currentHardware)) return data;
    }
  } catch {}
  return runBenchmark();
}
