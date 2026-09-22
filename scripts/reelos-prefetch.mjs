import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const SHM_CACHE_DIR = "/dev/shm/reelos-stream-cache";

export function calculatePrefetchBounds(totalRamMb) {
  const ram = totalRamMb || Math.round(os.totalmem() / (1024 * 1024));
  // 4GB or less -> 64MB buffer
  // 8GB+ -> 150MB buffer
  // 16GB+ -> 256MB buffer
  if (ram <= 4600) {
    return { maxBufferMb: 64, chunkMb: 4, label: "Potato Low-Memory Buffer (64MB)" };
  }
  if (ram <= 12000) {
    return { maxBufferMb: 150, chunkMb: 8, label: "Balanced Appliance Buffer (150MB)" };
  }
  return { maxBufferMb: 256, chunkMb: 16, label: "Powerhouse High-Bandwidth Buffer (256MB)" };
}

export function getPrefetchMetrics() {
  const isShm = existsSync("/dev/shm");
  const bounds = calculatePrefetchBounds();

  let bytesUsed = 0;
  let activeStreams = 0;

  if (isShm && existsSync(SHM_CACHE_DIR)) {
    try {
      const files = readdirSync(SHM_CACHE_DIR);
      activeStreams = files.length;
      for (const f of files) {
        try {
          const st = statSync(join(SHM_CACHE_DIR, f));
          bytesUsed += st.size;
        } catch {}
      }
    } catch {}
  }

  const usedMb = Math.round((bytesUsed / (1024 * 1024)) * 10) / 10;

  return {
    ok: true,
    available: isShm,
    dir: SHM_CACHE_DIR,
    usedMb,
    maxMb: bounds.maxBufferMb,
    activeStreams,
    label: bounds.label,
    zeroSpinLatency: true,
  };
}

export function purgeOldPrefetch(maxAgeMs = 15 * 60 * 1000) {
  if (!existsSync(SHM_CACHE_DIR)) return { ok: true, purged: 0 };
  let count = 0;
  const now = Date.now();
  try {
    const files = readdirSync(SHM_CACHE_DIR);
    for (const f of files) {
      const fp = join(SHM_CACHE_DIR, f);
      try {
        const st = statSync(fp);
        if (now - st.mtimeMs > maxAgeMs) {
          unlinkSync(fp);
          count++;
        }
      } catch {}
    }
  } catch {}
  return { ok: true, purged: count };
}
