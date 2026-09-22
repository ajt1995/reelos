/**
 * Machine Overseer Service (Section 53, Master Vision Ledger v1.5)
 *
 * Coordinator for local maintenance and future measured model adapters.
 *
 * Inviolable Invariants:
 * 1. Strict TorBox Air-Gap (Law 3): Zero access to TorBox tokens or debrid queues.
 * 2. The Leash Constraint: model updates require an injected signature verifier.
 * 3. Shared machines yield optional background work to foreground activity.
 * 4. Autonomous Zero-Debugger (Law 7): Heals empty metadata and corrupt state JSONs silently.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveTitleMetadata, enrichTitleSync } from "./metadata-enricher.mjs";
import { getAdaptiveMemoryCeiling } from "../reelos-box-scale.mjs";

const DEFAULT_STATE_DIR =
  process.env.REELOS_STATE ||
  (process.platform === "win32"
    ? path.join(process.cwd(), ".reelos-state")
    : "/var/lib/reelos");

export class MachineOverseer {
  constructor({
    stateDir = DEFAULT_STATE_DIR,
    isDedicated,
    manifestVerifier = null,
    totalMemoryBytes = os.totalmem(),
    freeMemoryBytes = () => os.freemem(),
  } = {}) {
    this.stateDir = stateDir;
    this.isDedicated =
      isDedicated !== undefined
        ? isDedicated
        : fs.existsSync("/var/lib/reelos") ||
          process.env.REELOS_DEDICATED === "1";
    this.activeModel = null;
    this.manifestVerifier = manifestVerifier;
    this.totalMemoryBytes = totalMemoryBytes;
    this.freeMemoryBytes = freeMemoryBytes;
    this.isYielding = false;
    this.diagnosticLoopTimer = null;
    this.lastHealthCheck = 0;
    this.quarantinedKeys = new Set([
      "torbox",
      "torbox_key",
      "torboxtoken",
      "debridkey",
      "debrid_token",
      "debridauth",
      "debrid",
    ]);
  }

  /**
   * Determine hardware tier and model capacity (Law 1 & Austin's Yielding Standard)
   */
  resolveAllocation() {
    const totalMemBytes = this.totalMemoryBytes;
    const totalMemMB = Math.round(totalMemBytes / (1024 * 1024));
    const systemBudget = getAdaptiveMemoryCeiling({
      platform: this.isDedicated ? "linux" : process.platform,
      totalMem: totalMemBytes,
      freeMem: this.freeMemoryBytes(),
      isDedicated: this.isDedicated,
      isStealth: !this.isDedicated && this.isYielding,
    });

    if (this.isDedicated) {
      const maxAllocMB = Math.min(
        systemBudget.targetMemoryMb,
        Math.min(
          2048,
          Math.max(128, Math.round(systemBudget.targetMemoryMb * 0.25)),
        ),
      );
      return {
        tier: totalMemMB <= 6144 ? "potato" : "dedicated",
        modelSize: null,
        maxAllocMB,
        systemBudgetMB: systemBudget.targetMemoryMb,
        systemHeadroomMB: systemBudget.videoHeadroomMb,
        budgetScope: "model-within-system",
        stealthFloorMB: 64,
        adapterRequired: true,
      };
    }

    // Shared Customer PC: Zero Eyebrows profile
    return {
      tier: "shared_pc",
      modelSize: null,
      baselineIdleMB: Math.min(128, systemBudget.targetMemoryMb),
      systemBudgetMB: systemBudget.targetMemoryMb,
      systemHeadroomMB: systemBudget.videoHeadroomMb,
      budgetScope: "model-within-system",
      stealthFloorMB: 64, // Safe 32MB-64MB stealth floor (Section 17/53.3)
      activeUserYield: true,
      adapterRequired: true,
    };
  }

  /**
   * Enforce the strict TorBox Air-Gap Boundary (Law 3)
   * Sanitizes all inputs/outputs so the Overseer model never sees or stores TorBox keys.
   */
  sanitizeContext(contextObj) {
    if (!contextObj || typeof contextObj !== "object") return contextObj;
    const sanitized = Array.isArray(contextObj) ? [] : {};
    for (const [k, v] of Object.entries(contextObj)) {
      const keyLower = k.toLowerCase();
      if (
        this.quarantinedKeys.has(keyLower) ||
        /torbox|debrid|apikey|api_key|token|secret/i.test(keyLower) ||
        (typeof v === "string" && /torbox|debrid|secret/i.test(v))
      ) {
        continue; // Quarantined: completely stripped from Overseer context
      }
      if (typeof v === "object" && v !== null) {
        sanitized[k] = this.sanitizeContext(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Verify the "Leash" Constraint before loading new model weights (Section 53.2)
   */
  verifyModelManifest(modelName, sha256Hex) {
    try {
      const manifestPath = path.join(
        this.stateDir,
        "distilled-models",
        "manifest.json",
      );
      if (!fs.existsSync(manifestPath)) return false;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const record = manifest?.models?.[modelName];
      if (!record) return false;
      if (
        record.sha256 !== sha256Hex ||
        typeof this.manifestVerifier !== "function"
      )
        return false;
      return Boolean(
        this.manifestVerifier({ modelName, sha256Hex, record, manifest }),
      );
    } catch {
      return false;
    }
  }

  /**
   * Check for active user games or heavy creative apps to yield immediately (Zero Eyebrows)
   */
  checkActiveUserYield() {
    if (this.isDedicated) return false; // Dedicated appliances do not yield to foreign games

    // On shared customer PCs, if user apps are active, yield compute
    const alloc = this.resolveAllocation();
    if (this.isYielding) {
      return true;
    }
    return false;
  }

  /**
   * Set stealth yielding state (<100ms response to gaming / creator apps)
   */
  setYieldState(shouldYield) {
    this.isYielding = Boolean(shouldYield);
  }

  /**
   * Atomic JSON writer that protects against power failure and truncation.
   */
  writeJsonAtomic(filePath, data) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const str = JSON.stringify(data, null, 2);
      const tmpPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, str, "utf8");

      // Maintain continuous mirror in .bak snapshot
      try {
        fs.writeFileSync(`${filePath}.bak`, str, "utf8");
      } catch {}

      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (e) {
      console.error(
        `[overseer] Atomic write failed for ${filePath}:`,
        e.message,
      );
      return false;
    }
  }

  /**
   * Resilient JSON reader that falls back to .bak or fallback on corruption.
   */
  readJsonSafe(filePath, fallback = null) {
    try {
      if (fs.existsSync(filePath)) {
        const text = fs.readFileSync(filePath, "utf8");
        if (text && text.trim().length > 0) {
          return JSON.parse(text);
        }
      }
    } catch (err) {
      console.warn(
        `[overseer] Corrupt JSON detected at ${filePath}, attempting .bak recovery...`,
      );
    }

    // Try .bak
    const bakPath = `${filePath}.bak`;
    try {
      if (fs.existsSync(bakPath)) {
        const text = fs.readFileSync(bakPath, "utf8");
        if (text && text.trim().length > 0) {
          const parsed = JSON.parse(text);
          // Restore the primary file from backup
          this.writeJsonAtomic(filePath, parsed);
          return parsed;
        }
      }
    } catch {}

    return fallback;
  }

  /**
   * Cleans stale temporary files (.tmp files > 1hr old)
   */
  cleanStaleTempFiles() {
    try {
      if (!fs.existsSync(this.stateDir)) return;
      const files = fs.readdirSync(this.stateDir);
      const now = Date.now();
      for (const file of files) {
        if (file.includes(".tmp")) {
          const fullPath = path.join(this.stateDir, file);
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > 3600000) {
            try {
              fs.unlinkSync(fullPath);
            } catch {}
          }
        }
      }
    } catch {}
  }

  /**
   * Autonomous Self-Healing: Verify library shelf metadata integrity (Law 7)
   */
  async sweepLibraryMetadata() {
    try {
      const shelfPath = path.join(this.stateDir, "library-shelf.json");
      let raw = this.readJsonSafe(shelfPath, null);
      if (!raw || !Array.isArray(raw.titles)) {
        // Auto-heal empty or unparseable shelf from metadata-cache or default
        const cachePath = path.join(this.stateDir, "metadata-cache.json");
        const cache = this.readJsonSafe(cachePath, {});
        const titles = Object.values(cache);
        raw = { titles: titles.length > 0 ? titles : [] };
        if (raw.titles.length > 0) {
          this.writeJsonAtomic(shelfPath, raw);
        }
      }
      const titles = raw.titles || [];
      let fixed = 0;

      for (let i = 0; i < titles.length; i++) {
        const t = titles[i];
        const isSynthetic =
          !t.overview ||
          t.overview.startsWith("jf-") ||
          t.overview.includes("presents an evocative");
        const needsGenres = !t.genres || t.genres.length === 0;

        if (isSynthetic || needsGenres) {
          const query = t.title && !t.title.startsWith("jf-") ? t.title : t.id;
          const meta = await resolveTitleMetadata(query, {
            kind: t.kind,
            year: t.year,
          });
          if (meta) {
            if (meta.overview && !meta.overview.startsWith("jf-"))
              t.overview = meta.overview;
            if (meta.genres?.length) t.genres = meta.genres;
            if (meta.director) t.director = meta.director;
            fixed++;
          }
          titles[i] = enrichTitleSync(t);
        }
      }

      if (fixed > 0) {
        raw.titles = titles;
        this.writeJsonAtomic(shelfPath, raw);
      }

      return { fixed, total: titles.length };
    } catch (e) {
      return { fixed: 0, error: String(e) };
    }
  }

  /**
   * Start the Overseer's background sentry loop
   */
  start(intervalMs = 60000) {
    if (this.diagnosticLoopTimer) return;
    this.diagnosticLoopTimer = setInterval(async () => {
      this.lastHealthCheck = Date.now();
      if (!this.checkActiveUserYield()) {
        await this.sweepLibraryMetadata();
        this.cleanStaleTempFiles();
        try {
          const { neuroCache } = await import("./neuro-cache.mjs");
          neuroCache.prune(15 * 60 * 1000);
        } catch {}
        try {
          const { watchPartyService } =
            await import("./watchparty-service.mjs");
          watchPartyService.sweepStaleRooms(2 * 3600 * 1000);
        } catch {}
      }
    }, intervalMs);
    // Unref so it doesn't hold up node exit in test environments
    if (this.diagnosticLoopTimer.unref) this.diagnosticLoopTimer.unref();
  }

  inspectTelemetry() {
    const alloc = this.resolveAllocation();
    return {
      active: true,
      tier: alloc.tier,
      modelSize: alloc.modelSize,
      isYielding: this.isYielding,
      torboxQuarantine: true,
      stealthFloorMB: alloc.stealthFloorMB,
      memoryMode: this.isDedicated ? "dedicated" : "yield",
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  stop() {
    if (this.diagnosticLoopTimer) {
      clearInterval(this.diagnosticLoopTimer);
      this.diagnosticLoopTimer = null;
    }
  }
}

let overseerInstance = null;

export function getMachineOverseer(opts) {
  if (!overseerInstance) {
    overseerInstance = new MachineOverseer(opts);
  }
  return overseerInstance;
}
