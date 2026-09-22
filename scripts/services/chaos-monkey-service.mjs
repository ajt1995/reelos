import { Transform } from "node:stream";
import { torBoxRateLimiter } from "./debrid-service.mjs";

/**
 * Adversarial Chaos Monkey & Network Degrader Service for ReelOS.
 * Provides programmatic injection of network faults, upstream outages,
 * stream corruption, bandwidth throttling, and storage pool exhaustion.
 *
 * Vector A: Packet Loss & Chunk Corruption
 * Vector B: Mid-Stream TCP Socket Resets (ECONNRESET)
 * Vector C: TorBox Upstream Rate-Limit (429) & Outage (503) Bursts
 * Vector D: Slow-Drip Bandwidth Throttling (e.g. 50KB/s)
 * Vector E: Storage Headroom Exhaustion (<1% disk) & LRU Trigger
 */

function createMockHeaders(headersObj = {}) {
  const map = new Map();
  for (const [k, v] of Object.entries(headersObj)) {
    map.set(k.toLowerCase(), String(v));
  }
  return {
    get(name) {
      return map.get(String(name).toLowerCase()) || null;
    },
    has(name) {
      return map.has(String(name).toLowerCase());
    },
    entries() {
      return map.entries();
    },
  };
}

export function createMockDebridResponse(status, options = {}) {
  if (status === 429) {
    const retryAfter = options.retryAfter ?? 2;
    return {
      status: 429,
      statusText: "Too Many Requests",
      ok: false,
      headers: createMockHeaders({
        "retry-after": String(retryAfter),
        "content-type": "application/json",
      }),
      async text() {
        return JSON.stringify({ error: "TorBox rate limit exceeded (429)", retryAfter });
      },
      async json() {
        return { error: "TorBox rate limit exceeded (429)", retryAfter };
      },
    };
  }

  if (status === 503) {
    return {
      status: 503,
      statusText: "Service Unavailable",
      ok: false,
      headers: createMockHeaders({
        "content-type": "text/html; charset=UTF-8",
      }),
      async text() {
        return "<html><head><title>503 Service Temporarily Unavailable</title></head><body><center><h1>503 Service Temporarily Unavailable</h1></center><hr><center>cloudflare</center></body></html>";
      },
      async json() {
        throw new SyntaxError("Unexpected token '<', \"<html><head>\"... is not valid JSON");
      },
    };
  }

  return {
    status: 200,
    statusText: "OK",
    ok: true,
    headers: createMockHeaders({ "content-type": "application/json" }),
    async text() {
      return JSON.stringify(options.data || { ok: true });
    },
    async json() {
      return options.data || { ok: true };
    },
  };
}

export class ChaosMonkeyService {
  constructor(initialConfig = {}) {
    this.resetHooks = [];
    this.reset();
    if (Object.keys(initialConfig).length > 0) {
      this.configure(initialConfig);
    }
  }

  registerResetHook(fn) {
    if (typeof fn === "function" && !this.resetHooks.includes(fn)) {
      this.resetHooks.push(fn);
    }
  }

  registerCircuitBreaker(breaker) {
    if (breaker && typeof breaker.resetCircuit === "function") {
      this.registerResetHook(() => breaker.resetCircuit());
    }
  }

  reset() {
    this.config = {
      enabled: false,
      packetLossRate: 0,
      corruptChunkRate: 0,
      socketResetBytes: 0,
      slowDripRateBps: 0,
      debridFaults: {
        enabled: false,
        rateLimitBurst: 0,
        retryAfterSec: 2,
        outage503Burst: 0,
      },
      simulateStorageExhaustion: false,
      exhaustedFreePercent: 0.8,
    };

    this.telemetry = {
      droppedChunks: 0,
      corruptedChunks: 0,
      resetSockets: 0,
      rateLimitsInjected: 0,
      outagesInjected: 0,
      throttledBytes: 0,
      throttledSeconds: 0,
      storageExhaustionChecks: 0,
      evictionsTriggered: 0,
    };

    // Reset torBoxRateLimiter singleton circuit breaker
    try {
      if (typeof torBoxRateLimiter?.resetCircuit === "function") {
        torBoxRateLimiter.resetCircuit();
      }
    } catch {}

    // Execute any registered circuit breaker reset hooks
    if (Array.isArray(this.resetHooks)) {
      for (const hook of this.resetHooks) {
        try { hook(); } catch {}
      }
    }
  }

  configure(updates = {}) {
    if (updates.enabled !== undefined) this.config.enabled = Boolean(updates.enabled);
    if (updates.packetLossRate !== undefined) this.config.packetLossRate = Math.min(1, Math.max(0, Number(updates.packetLossRate) || 0));
    if (updates.packetLoss !== undefined) this.config.packetLossRate = Math.min(1, Math.max(0, Number(updates.packetLoss) || 0));
    if (updates.corruptChunkRate !== undefined) this.config.corruptChunkRate = Math.min(1, Math.max(0, Number(updates.corruptChunkRate) || 0));
    if (updates.socketResetBytes !== undefined) this.config.socketResetBytes = Math.max(0, Number(updates.socketResetBytes) || 0);
    if (updates.socketReset !== undefined) this.config.socketResetBytes = Math.max(0, Number(updates.socketReset) || 0);
    if (updates.slowDripRateBps !== undefined) this.config.slowDripRateBps = Math.max(0, Number(updates.slowDripRateBps) || 0);
    if (updates.slowDripBps !== undefined) this.config.slowDripRateBps = Math.max(0, Number(updates.slowDripBps) || 0);

    if (updates.debridFaults && typeof updates.debridFaults === "object") {
      if (updates.debridFaults.enabled !== undefined) this.config.debridFaults.enabled = Boolean(updates.debridFaults.enabled);
      if (updates.debridFaults.rateLimitBurst !== undefined) this.config.debridFaults.rateLimitBurst = Math.max(0, Number(updates.debridFaults.rateLimitBurst) || 0);
      if (updates.debridFaults.retryAfterSec !== undefined) this.config.debridFaults.retryAfterSec = Math.max(0, Number(updates.debridFaults.retryAfterSec) || 0);
      if (updates.debridFaults.outage503Burst !== undefined) this.config.debridFaults.outage503Burst = Math.max(0, Number(updates.debridFaults.outage503Burst) || 0);
    }
    if (updates.injectDebridBurst && typeof updates.injectDebridBurst === "object") {
      this.injectDebridBurst(updates.injectDebridBurst);
    }

    if (updates.simulateStorageExhaustion !== undefined) {
      this.config.simulateStorageExhaustion = Boolean(updates.simulateStorageExhaustion);
    }
    if (updates.storageExhaustion !== undefined) {
      this.config.simulateStorageExhaustion = Boolean(updates.storageExhaustion);
    }
    if (updates.exhaustedFreePercent !== undefined) {
      this.config.exhaustedFreePercent = Math.max(0, Number(updates.exhaustedFreePercent) || 0.8);
    }

    // Auto-enable if any fault vector is active
    if (
      this.config.packetLossRate > 0 ||
      this.config.corruptChunkRate > 0 ||
      this.config.socketResetBytes > 0 ||
      this.config.slowDripRateBps > 0 ||
      this.config.debridFaults.enabled ||
      this.config.simulateStorageExhaustion
    ) {
      this.config.enabled = true;
    }

    return this.getConfig();
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  getTelemetry() {
    return { ...this.telemetry };
  }

  resetTelemetry() {
    for (const key of Object.keys(this.telemetry)) {
      this.telemetry[key] = 0;
    }
  }

  injectPacketLoss(probability = 0.1) {
    this.configure({ packetLossRate: probability });
  }

  injectSocketReset(thresholdBytes = 131072) {
    this.configure({ socketResetBytes: thresholdBytes });
  }

  injectSlowDrip(bps = 51200) {
    this.configure({ slowDripRateBps: bps });
  }

  injectDebridBurst(options = {}) {
    this.config.debridFaults.enabled = true;
    this.config.enabled = true;
    if (options.rateLimitBurst !== undefined) this.config.debridFaults.rateLimitBurst = Number(options.rateLimitBurst) || 0;
    if (options.retryAfterSec !== undefined) this.config.debridFaults.retryAfterSec = Number(options.retryAfterSec) || 2;
    if (options.outage503Burst !== undefined) this.config.debridFaults.outage503Burst = Number(options.outage503Burst) || 0;
  }

  injectStorageExhaustion(simulateFull = true, freePercent = 0.8) {
    this.configure({ simulateStorageExhaustion: simulateFull, exhaustedFreePercent: freePercent });
  }

  generateDebridFault() {
    if (!this.config.enabled || !this.config.debridFaults.enabled) return null;

    if (this.config.debridFaults.outage503Burst > 0) {
      this.config.debridFaults.outage503Burst--;
      this.telemetry.outagesInjected++;
      return createMockDebridResponse(503);
    }

    if (this.config.debridFaults.rateLimitBurst > 0) {
      this.config.debridFaults.rateLimitBurst--;
      this.telemetry.rateLimitsInjected++;
      return createMockDebridResponse(429, { retryAfter: this.config.debridFaults.retryAfterSec || 2 });
    }

    return null;
  }

  getStorageHeadroomOverride(poolPath = null) {
    if (!this.config.enabled || !this.config.simulateStorageExhaustion) return null;
    this.telemetry.storageExhaustionChecks++;
    const freePercent = this.config.exhaustedFreePercent;
    const totalBytes = 500 * 1024 * 1024 * 1024;
    const freeBytes = Math.round(totalBytes * (freePercent / 100));
    return {
      ok: true,
      totalBytes,
      freeBytes,
      freePercent,
      usedPercent: Math.round((100 - freePercent) * 10) / 10,
      lowHeadroom: true,
      criticalHeadroom: true,
      simulatedByChaosMonkey: true,
    };
  }

  async triggerEvictionUnderExhaustion(poolPath = null) {
    if (!this.config.enabled || !this.config.simulateStorageExhaustion) return null;
    this.telemetry.evictionsTriggered++;
    const { runBackgroundLruEviction } = await import("./storage-service.mjs");
    return runBackgroundLruEviction(poolPath, {
      forcedFreePercent: this.config.exhaustedFreePercent,
      dryRun: false,
    });
  }

  createChaosStreamTransform(options = {}) {
    return createChaosStreamTransform(options, this);
  }
}

export const chaosMonkeyService = new ChaosMonkeyService();

/**
 * Creates a Transform stream injecting stream-level chaos:
 * - Packet loss (chunks dropped)
 * - Chunk corruption (bitflips)
 * - Mid-stream TCP socket resets (ECONNRESET after N bytes)
 * - Slow-drip bandwidth throttling (pacing chunks via delay)
 */
export function createChaosStreamTransform(options = {}, chaosInstance = null) {
  const service = chaosInstance || chaosMonkeyService;
  const cfg = {
    packetLossRate: options.packetLossRate ?? (service.config.packetLossRate || 0),
    corruptChunkRate: options.corruptChunkRate ?? (service.config.corruptChunkRate || 0),
    socketResetBytes: options.socketResetBytes ?? (service.config.socketResetBytes || 0),
    slowDripRateBps: options.slowDripRateBps ?? (service.config.slowDripRateBps || 0),
    res: options.res || null,
    socket: options.socket || null,
  };

  let transferredBytes = 0;
  let resetTriggered = false;
  let dripTimer = null;

  const transform = new Transform({
    async transform(chunk, encoding, callback) {
      if (this.destroyed) return;

      // 1. Check socket reset threshold
      if (cfg.socketResetBytes > 0 && !resetTriggered) {
        transferredBytes += chunk.length;
        if (transferredBytes >= cfg.socketResetBytes) {
          resetTriggered = true;
          service.telemetry.resetSockets++;
          const targetSocket = cfg.socket || cfg.res?.socket;
          const resetErr = new Error("ECONNRESET: Mid-stream socket reset injected by Chaos Monkey");
          resetErr.code = "ECONNRESET";
          if (targetSocket && !targetSocket.destroyed) {
            targetSocket.destroy(resetErr);
          }
          callback(resetErr);
          return;
        }
      }

      // 2. Check packet loss
      if (cfg.packetLossRate > 0 && Math.random() < cfg.packetLossRate) {
        service.telemetry.droppedChunks++;
        // Drop the chunk silently
        callback();
        return;
      }

      // 3. Check chunk corruption
      let processedChunk = chunk;
      if (cfg.corruptChunkRate > 0 && Math.random() < cfg.corruptChunkRate) {
        service.telemetry.corruptedChunks++;
        // Mutate buffer bytes
        processedChunk = Buffer.from(chunk);
        if (processedChunk.length > 0) {
          const corruptPos = Math.floor(Math.random() * processedChunk.length);
          processedChunk[corruptPos] ^= 0xff;
        }
      }

      // 4. Check slow-drip throttling
      if (cfg.slowDripRateBps > 0) {
        const delayMs = Math.max(1, Math.round((chunk.length / cfg.slowDripRateBps) * 1000));
        service.telemetry.throttledBytes += chunk.length;
        service.telemetry.throttledSeconds += delayMs / 1000;
        await new Promise((resolve) => {
          dripTimer = setTimeout(() => {
            dripTimer = null;
            resolve();
          }, delayMs);
        });
        if (this.destroyed) return;
      }

      if (this.destroyed) return;
      this.push(processedChunk);
      callback();
    },
    destroy(err, callback) {
      if (dripTimer) {
        clearTimeout(dripTimer);
        dripTimer = null;
      }
      callback(err);
    },
  });

  return transform;
}

/**
 * Express / Node HTTP request router for /api/chaos/* REST control plane.
 */
export async function handleChaosRoute(req, res, chaosInstance = null) {
  const service = chaosInstance || chaosMonkeyService;
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();

  res.setHeader("Content-Type", "application/json");

  // GET /api/chaos/config
  if (pathname === "/api/chaos/config" && method === "GET") {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, config: service.getConfig() }));
    return true;
  }

  // POST /api/chaos/configure
  if (pathname === "/api/chaos/configure" && method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || "{}");
      service.configure(data);
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, config: service.getConfig() }));
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: `Invalid configuration: ${err.message}` }));
    }
    return true;
  }

  // POST /api/chaos/reset
  if (pathname === "/api/chaos/reset" && method === "POST") {
    service.reset();
    try {
      if (typeof torBoxRateLimiter?.resetCircuit === "function") {
        torBoxRateLimiter.resetCircuit();
      }
    } catch {}
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, config: service.getConfig(), message: "All chaos monkey faults cleared" }));
    return true;
  }

  // GET /api/chaos/telemetry
  if (pathname === "/api/chaos/telemetry" && method === "GET") {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, telemetry: service.getTelemetry() }));
    return true;
  }

  return false;
}
