import EventEmitter from "node:events";
import os from "node:os";
import { consoleSentinel } from "./console-sentinel.mjs";
import { isDedicatedMachine } from "./machine-classifier.mjs";
import { cinemaBrainLoader } from "./cinema-brain-loader.mjs";
import { getAdaptiveMemoryCeiling } from "../reelos-box-scale.mjs";

export const SCALE_STATES = {
  DEDICATED_MAX: "DEDICATED_MAX",
  EXPANDED: "EXPANDED",
  CONTRACTED: "CONTRACTED",
};

export const SCALE_CONFIGS = {
  DEDICATED_MAX: {
    state: "DEDICATED_MAX",
    get embeddingDim() {
      const ramGb = os.totalmem() / 1024 ** 3;
      if (ramGb > 12) return 512;
      if (ramGb >= 6) return 256;
      return 128;
    },
    get maxMemoryBudgetMb() {
      const totalMb = Math.round(os.totalmem() / (1024 * 1024));
      // A ceiling for a future measured model adapter, not a reservation.
      // Never consume the host simply to make an allocation claim.
      return Math.min(2048, Math.max(128, Math.round(totalMb * 0.25)));
    },
    concurrencyThreads: 4,
    quantized: false,
    label: "ReelOS Engine: Dedicated Turbo (Max RAM Utilization)",
  },
  EXPANDED: {
    state: "EXPANDED",
    embeddingDim: 64,
    maxMemoryBudgetMb: 128,
    concurrencyThreads: 2,
    quantized: false,
    label: "ReelOS Engine: Full High-Fidelity (128MB)",
  },
  CONTRACTED: {
    state: "CONTRACTED",
    embeddingDim: 16,
    maxMemoryBudgetMb: 48,
    concurrencyThreads: 1,
    quantized: true,
    label: "ReelOS Engine: Stealth Floor (48MB Machine Health)",
  },
};

/**
 * NeuralScaleEngine provides elastic dynamic scaling for ReelOS edge AI models.
 * Reports bounded budgets and uses lazy allocation. A model adapter owns and
 * reports its real memory; this coordinator never allocates dummy RAM.
 */
export class NeuralScaleEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sentinel = options.consoleSentinel || consoleSentinel;
    this.scheduler = options.politeScheduler || null;
    this.isDedicated = options.isDedicated ?? isDedicatedMachine();
    this.cinemaBrain = options.cinemaBrain || cinemaBrainLoader;
    this.totalMemoryBytes = options.totalMemoryBytes || os.totalmem();
    this.freeMemoryBytes = options.freeMemoryBytes || (() => os.freemem());

    this.state = this.isDedicated
      ? SCALE_STATES.DEDICATED_MAX
      : SCALE_STATES.EXPANDED;
    this.inFlightInferences = 0;
    this.totalInferences = 0;
    this.droppedInferences = 0;

    // No placeholder reservation: memory is allocated only by real workloads.
    this.residentBuffer = null;
    this.allocateResidentMemory();

    // Wire to console sentinel events
    if (this.sentinel && typeof this.sentinel.on === "function") {
      this.sentinel.on("CONSOLES_GAMING_YIELD", (info) => {
        this.contract("console_gaming_yield", info);
      });
      this.sentinel.on("CONSOLES_GAMING_RESUME", (info) => {
        if (this.isDedicated) {
          this.expandDedicatedMax("console_gaming_resume", info);
        } else {
          this.expand("console_gaming_resume", info);
        }
      });
    }

    // Wire to cooperative polite scheduler (creator laptop detection)
    if (this.scheduler && typeof this.scheduler.subscribe === "function") {
      this.scheduler.subscribe((hostState, isYielding, memPressure) => {
        if (
          hostState === "stealth_yield" ||
          memPressure === "hard" ||
          memPressure === "critical"
        ) {
          this.contract("creator_workstation_yield", {
            hostState,
            memPressure,
          });
        } else if (hostState === "turbo_maintenance" && this.isDedicated) {
          this.expandDedicatedMax("turbo_maintenance");
        } else if (
          !isYielding &&
          memPressure === "none" &&
          this.state === SCALE_STATES.CONTRACTED
        ) {
          if (this.isDedicated) {
            this.expandDedicatedMax("resources_recovered");
          } else {
            this.expand("resources_recovered");
          }
        }
      });
    }
  }

  /** Updates a budget without allocating dummy memory. */
  allocateResidentMemory() {
    let budgetMb = SCALE_CONFIGS[this.state].maxMemoryBudgetMb;
    if (this.isDedicated && this.state === SCALE_STATES.CONTRACTED) {
      budgetMb = SCALE_CONFIGS.DEDICATED_MAX.maxMemoryBudgetMb;
    }

    this.configuredBudgetMb = budgetMb;
    this.residentBuffer = null;
    if (
      this.state === SCALE_STATES.CONTRACTED &&
      typeof globalThis.gc === "function"
    )
      globalThis.gc();
  }

  contract(reason = "manual", details = null) {
    if (this.isDedicated && reason !== "console_gaming_yield") {
      return false; // NEVER contract memory budget or dims for local app yields
    }

    if (this.state === SCALE_STATES.CONTRACTED) return false;
    const previousState = this.state;
    this.state = SCALE_STATES.CONTRACTED;
    this.allocateResidentMemory();

    this.emit("STATE_CHANGED", {
      from: previousState,
      to: this.state,
      reason,
      details,
      config: this.getConfig(),
    });
    return true;
  }

  expand(reason = "manual", details = null) {
    if (this.state === SCALE_STATES.EXPANDED) return false;
    const previousState = this.state;
    this.state = SCALE_STATES.EXPANDED;
    this.allocateResidentMemory();

    this.emit("STATE_CHANGED", {
      from: previousState,
      to: this.state,
      reason,
      details,
      config: this.getConfig(),
    });
    return true;
  }

  expandDedicatedMax(reason = "dedicated_hardware", details = null) {
    if (this.state === SCALE_STATES.DEDICATED_MAX) return false;
    const previousState = this.state;
    this.state = SCALE_STATES.DEDICATED_MAX;
    this.allocateResidentMemory();

    this.emit("STATE_CHANGED", {
      from: previousState,
      to: this.state,
      reason,
      details,
      config: this.getConfig(),
    });
    return true;
  }

  getConfig() {
    const config = { ...SCALE_CONFIGS[this.state] };
    if (this.isDedicated && this.state === SCALE_STATES.CONTRACTED) {
      config.embeddingDim = SCALE_CONFIGS.DEDICATED_MAX.embeddingDim;
      config.maxMemoryBudgetMb = SCALE_CONFIGS.DEDICATED_MAX.maxMemoryBudgetMb;
      config.quantized = false;
    }

    const systemBudget = getAdaptiveMemoryCeiling({
      platform: this.isDedicated ? "linux" : process.platform,
      totalMem: this.totalMemoryBytes,
      freeMem: this.freeMemoryBytes(),
      isDedicated: this.isDedicated,
      isStealth: !this.isDedicated && this.state === SCALE_STATES.CONTRACTED,
    });
    const perModelBudgetMb = this.isDedicated
      ? Math.min(
          systemBudget.targetMemoryMb,
          Math.min(
            2048,
            Math.max(128, Math.round(systemBudget.targetMemoryMb * 0.25)),
          ),
        )
      : config.maxMemoryBudgetMb;

    const currentMb = this.residentBuffer
      ? Math.round((this.residentBuffer.byteLength / (1024 * 1024)) * 100) / 100
      : 0;

    return {
      ...config,
      maxMemoryBudgetMb: perModelBudgetMb,
      systemMemoryBudgetMb: systemBudget.targetMemoryMb,
      systemMemoryHeadroomMb: systemBudget.videoHeadroomMb,
      budgetScope: "model-within-system",
      systemMemoryMode: systemBudget.mode,
      currentMemoryMb: currentMb,
      allocationStrategy: "lazy-workload-owned",
      residentRssMb:
        Math.round((process.memoryUsage().rss / (1024 * 1024)) * 100) / 100,
      inFlightInferences: this.inFlightInferences,
      totalInferences: this.totalInferences,
      droppedInferences: this.droppedInferences,
      isDedicated: this.isDedicated,
    };
  }

  /**
   * Real dense semantic embedding projection for title/mood text.
   * Leverages the on-device Cinema Latent Brain manifold.
   */
  embedText(text) {
    this.inFlightInferences++;
    this.totalInferences++;
    try {
      const config = this.getConfig();
      const dim = config.embeddingDim;

      let vec;
      if (
        this.cinemaBrain &&
        typeof this.cinemaBrain.encodeTextToLatent === "function"
      ) {
        vec = this.cinemaBrain.encodeTextToLatent(text, dim);
      } else {
        // Fallback harmonic projection
        vec = new Float32Array(dim);
        const str = String(text || "").toLowerCase();
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          const idx = (code * 31 + i) % dim;
          vec[idx] += 1.0 / (1.0 + Math.exp(-((code % 10) - 5)));
        }
        let norm = 0;
        for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
        norm = Math.sqrt(norm) || 1.0;
        for (let i = 0; i < dim; i++) vec[i] /= norm;
      }

      if (config.quantized) {
        return this.quantize(Array.from(vec));
      }
      return Array.from(vec);
    } finally {
      this.inFlightInferences--;
    }
  }

  /**
   * Quantizes float vector into 16-bit compressed representation [-32767, 32767].
   */
  quantize(vector) {
    const q = new Int16Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      const clamped = Math.max(-1.0, Math.min(1.0, vector[i]));
      q[i] = Math.round(clamped * 32767);
    }
    return Array.from(q);
  }

  /**
   * Dequantizes 16-bit compressed representation back into float [-1.0, 1.0].
   */
  dequantize(qVector) {
    const floats = new Float32Array(qVector.length);
    for (let i = 0; i < qVector.length; i++) {
      floats[i] = qVector[i] / 32767.0;
    }
    return Array.from(floats);
  }

  /**
   * Cosine similarity computation with support for both float and quantized inputs.
   */
  cosineSimilarity(vecA, vecB) {
    this.inFlightInferences++;
    this.totalInferences++;
    try {
      if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
      const minLen = Math.min(vecA.length, vecB.length);
      if (minLen === 0) return 0;

      let dot = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < minLen; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }

      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      if (denom === 0) return 0;
      return Math.round((dot / denom) * 10000) / 10000;
    } finally {
      this.inFlightInferences--;
    }
  }

  getStatus() {
    return {
      state: this.state,
      ...this.getConfig(),
      brain:
        this.cinemaBrain && typeof this.cinemaBrain.getStats === "function"
          ? this.cinemaBrain.getStats()
          : { isLoaded: false },
    };
  }
}

export const neuralScaleEngine = new NeuralScaleEngine();

export async function handleNeuralScaleRoute(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/neural/scale") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, ...neuralScaleEngine.getStatus() }));
    return true;
  }

  if (url.pathname === "/api/neural/brain/status") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        brain: cinemaBrainLoader.getStats(),
        scale: neuralScaleEngine.getStatus(),
      }),
    );
    return true;
  }

  if (
    url.pathname === "/api/neural/embed" &&
    (req.method || "GET").toUpperCase() === "POST"
  ) {
    let body = "";
    for await (const chunk of req) body += chunk;
    let data = {};
    try {
      data = JSON.parse(body || "{}");
    } catch {}
    const text = data.text || "";
    const embedding = neuralScaleEngine.embedText(text);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ ok: true, text, embedding, dim: embedding.length }),
    );
    return true;
  }

  return false;
}
