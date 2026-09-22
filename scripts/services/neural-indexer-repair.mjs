import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const VALID_ROLES = new Set(["movie", "tv", "both"]);
const VALID_TYPES = new Set(["search", "rss", "torznab", "newznab"]);

export function ownerIndexerPresetPath(env = process.env) {
  if (env.REELOS_INDEXER_PRESETS_FILE) {
    return resolve(env.REELOS_INDEXER_PRESETS_FILE);
  }
  if (process.platform === "win32") {
    return join(
      env.LOCALAPPDATA || "C:\\ProgramData",
      "ReelOS",
      "private",
      "indexer-presets.json",
    );
  }
  return "/var/lib/reelos/private/indexer-presets.json";
}

function safePreset(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  const name = String(value.name || "").trim();
  const displayName = String(value.displayName || name).trim();
  const role = VALID_ROLES.has(value.role) ? value.role : "both";
  const type = VALID_TYPES.has(value.type) ? value.type : "torznab";
  const mirrors = Array.isArray(value.mirrors)
    ? value.mirrors
        .map((entry) => String(entry || "").trim())
        .filter((entry) => /^https?:\/\//i.test(entry))
    : [];
  if (!id || !name || !displayName || mirrors.length === 0) return null;
  return {
    id,
    name,
    displayName,
    role,
    type,
    mirrors,
    activeMirror: mirrors.includes(value.activeMirror)
      ? value.activeMirror
      : mirrors[0],
  };
}

export function loadOwnerIndexerPresets(options = {}) {
  const presetPath = options.path || ownerIndexerPresetPath(options.env);
  if (!existsSync(presetPath)) return [];
  try {
    const document = JSON.parse(readFileSync(presetPath, "utf8"));
    const rows = Array.isArray(document) ? document : document?.presets;
    if (!Array.isArray(rows)) return [];
    const seen = new Set();
    return rows
      .map(safePreset)
      .filter((preset) => preset && !seen.has(preset.id) && seen.add(preset.id));
  } catch {
    return [];
  }
}

// Only private/custom release indexers require owner configuration.
// Built-in public-domain catalogs are separate and always enabled in public-catalogs.mjs.
// An appliance owner can supply a private, untracked preset file explicitly.
export const PUBLIC_INDEXER_ROSTER = loadOwnerIndexerPresets();

/**
 * Neural classification of indexer telemetry vector:
 * [latencyMs, statusCode, errorOccurred, cloudflareBlocked]
 * Returns normalized health score 0.0 - 1.0 and state.
 */
export function classifyIndexerHealth(telemetry) {
  const { latencyMs = 250, statusCode = 200, isError = false, isCloudflare = false } = telemetry;

  let score = 1.0;

  if (isError || statusCode >= 500) {
    score -= 0.6;
  } else if (isCloudflare || statusCode === 403) {
    score -= 0.5;
  } else if (statusCode >= 400) {
    score -= 0.35;
  }

  // Latency penalty: >1000ms begins diminishing score
  if (latencyMs > 2500) {
    score -= 0.3;
  } else if (latencyMs > 1000) {
    score -= 0.15;
  }

  score = Math.max(0, Math.min(1, score));

  let status = "healthy";
  if (score < 0.45) {
    status = "dead";
  } else if (score < 0.8) {
    status = "degraded";
  }

  return {
    score: Math.round(score * 100) / 100,
    status,
    requiresRepair: status !== "healthy",
  };
}

/**
 * Autonomous Neural Indexer Repair Engine
 */
export class NeuralIndexerRepair {
  constructor(options = {}) {
    this.stateDir = options.stateDir || (process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || "C:\\ProgramData", "ReelOS", "indexers")
      : "/var/lib/reelos/indexers");
    this.indexers = JSON.parse(
      JSON.stringify(options.indexers || PUBLIC_INDEXER_ROSTER),
    );
    this.repairHistory = [];
    this.inRepair = new Set();
  }

  /**
   * Diagnoses an individual indexer using provided fetchImpl
   */
  async diagnoseIndexer(indexer, fetchImpl = globalThis.fetch) {
    const start = Date.now();
    try {
      const res = await fetchImpl(indexer.activeMirror, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
      });
      const latency = Date.now() - start;
      const isCloudflare = res.status === 403 || res.headers?.get?.("server")?.toLowerCase()?.includes("cloudflare");

      const classification = classifyIndexerHealth({
        latencyMs: latency,
        statusCode: res.status,
        isError: !res.ok && res.status >= 500,
        isCloudflare,
      });

      return {
        name: indexer.name,
        activeMirror: indexer.activeMirror,
        latencyMs: latency,
        statusCode: res.status,
        ...classification,
      };
    } catch {
      const latency = Date.now() - start;
      const classification = classifyIndexerHealth({
        latencyMs: latency,
        statusCode: 0,
        isError: true,
        isCloudflare: false,
      });

      return {
        name: indexer.name,
        activeMirror: indexer.activeMirror,
        latencyMs: latency,
        statusCode: 0,
        ...classification,
      };
    }
  }

  /**
   * Autonomous self-repair: when an indexer is degraded or dead,
   * searches for the best healthy alternative mirror and rotates.
   */
  async repairIndexer(name, fetchImpl = globalThis.fetch) {
    if (this.inRepair.has(name)) {
      return { repaired: false, indexer: name, error: "Repair already in progress" };
    }
    this.inRepair.add(name);
    try {
      const target = this.indexers.find((ix) => ix.name === name);
      if (!target) return { repaired: false, error: "Unknown indexer" };

      const originalMirror = target.activeMirror;
      const candidates = target.mirrors.filter((m) => m !== originalMirror);

      for (const mirror of candidates) {
        const start = Date.now();
        try {
          const res = await fetchImpl(mirror, {
            method: "HEAD",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelOS/2.0" },
          });
          const latency = Date.now() - start;
          if (res.ok || (res.status >= 200 && res.status < 400)) {
            target.activeMirror = mirror;
            const repairLog = {
              indexer: name,
              timestamp: new Date().toISOString(),
              from: originalMirror,
              to: mirror,
              latencyMs: latency,
              action: "swapped_mirror",
            };
            this.repairHistory.unshift(repairLog);
            return {
              repaired: true,
              indexer: name,
              activeMirror: mirror,
              latencyMs: latency,
              action: "swapped_mirror",
            };
          }
        } catch {
          continue;
        }
      }

      return {
        repaired: false,
        indexer: name,
        activeMirror: originalMirror,
        error: "No responsive mirrors found",
      };
    } finally {
      this.inRepair.delete(name);
    }
  }

  /**
   * Runs complete diagnosis across all public indexers and auto-repairs any unhealthy nodes.
   */
  async runAutoDiagnostics(fetchImpl = globalThis.fetch) {
    const results = [];
    let repairedCount = 0;

    for (const ix of this.indexers) {
      const diag = await this.diagnoseIndexer(ix, fetchImpl);
      if (diag.requiresRepair) {
        const repairRes = await this.repairIndexer(ix.name, fetchImpl);
        if (repairRes.repaired) {
          repairedCount++;
          diag.activeMirror = repairRes.activeMirror;
          diag.status = "repaired";
          diag.repaired = true;
        }
      }
      results.push(diag);
    }

    const healthyCount = results.filter((r) => r.status === "healthy" || r.status === "repaired").length;

    return {
      timestamp: new Date().toISOString(),
      total: results.length,
      healthyCount,
      repairedCount,
      overallHealth: healthyCount === results.length ? "optimal" : healthyCount >= 4 ? "functional" : "degraded",
      indexers: results,
      repairHistory: this.repairHistory.slice(0, 10),
    };
  }
}

export const neuralIndexerRepair = new NeuralIndexerRepair();
