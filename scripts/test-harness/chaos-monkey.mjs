#!/usr/bin/env node
/**
 * ReelOS Adversarial Chaos Monkey & Upstream Resilience CLI Harness
 *
 * Demonstrates and verifies all 5 fault injection vectors and the REST control plane:
 * 1. packet-loss: Drops stream chunks with probability P
 * 2. chunk-corruption: Injects bitflips into media chunks
 * 3. socket-reset: Forces mid-stream TCP socket reset (ECONNRESET) at byte threshold
 * 4. debrid-bursts: Intercepts and tests TorBox 429 backoff & 503 circuit breaking
 * 5. slow-drip: Paces streams at 50KB/s using token-bucket chunk delay
 * 6. storage-exhaustion: Simulates <1% disk headroom and verifies ENOSPC write guards
 * 7. rest-control: Verifies /api/chaos/* REST control plane dispatch
 */

import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ChaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
} from "../services/chaos-monkey-service.mjs";
import { TorBoxRateLimiter } from "../services/debrid-service.mjs";
import { saveProfile, setActiveProfileId, safeWriteFileSync } from "../services/profile-service.mjs";

const scenarios = {};

// Scenario 1: Packet Loss
scenarios["packet-loss"] = async function runPacketLoss() {
  console.log("  [Vector 1] Running Packet Loss Fault Injection...");
  const chaos = new ChaosMonkeyService();
  const lossRate = 0.3; // 30% drop
  const transform = createChaosStreamTransform({ packetLossRate: lossRate }, chaos);

  const totalChunks = 50;
  const sourceChunks = Array.from({ length: totalChunks }, (_, i) => Buffer.from(`chunk-${i}`));
  const delivered = [];

  transform.on("data", (chunk) => delivered.push(chunk));
  const source = Readable.from(sourceChunks);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const dropped = chaos.getTelemetry().droppedChunks;
  console.log(`    Total chunks: ${totalChunks}, Delivered: ${delivered.length}, Dropped: ${dropped}`);
  if (delivered.length >= totalChunks) {
    throw new Error(`Expected packet loss but all ${totalChunks} chunks were delivered`);
  }
  if (dropped === 0) {
    throw new Error("Telemetry did not record any dropped chunks");
  }
  return { ok: true, total: totalChunks, delivered: delivered.length, dropped };
};

// Scenario 2: Chunk Corruption
scenarios["chunk-corruption"] = async function runChunkCorruption() {
  console.log("  [Vector 1b] Running Chunk Corruption Fault Injection...");
  const chaos = new ChaosMonkeyService();
  const corruptRate = 1.0;
  const transform = createChaosStreamTransform({ corruptChunkRate: corruptRate }, chaos);

  const testBuffer = Buffer.from("VIDEO_FRAME_SYNC_BYTE_0x47_HEADER");
  const received = [];
  transform.on("data", (c) => received.push(c));

  const source = Readable.from([testBuffer]);
  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const corruptedCount = chaos.getTelemetry().corruptedChunks;
  if (corruptedCount !== 1) {
    throw new Error(`Expected 1 corrupted chunk, got ${corruptedCount}`);
  }
  if (testBuffer.equals(received[0])) {
    throw new Error("Chunk was delivered uncorrupted despite corruptChunkRate=1.0");
  }
  console.log(`    Corrupted ${corruptedCount} chunk(s) successfully.`);
  return { ok: true, corrupted: corruptedCount };
};

// Scenario 3: Mid-Stream Socket Resets
scenarios["socket-reset"] = async function runSocketReset() {
  console.log("  [Vector 2] Running Mid-Stream Socket Reset Fault Injection...");
  const chaos = new ChaosMonkeyService();
  const resetThresholdBytes = 128 * 1024; // 128 KB
  let socketDestroyed = false;
  let socketErr = null;

  const mockSocket = {
    destroyed: false,
    destroy(err) {
      this.destroyed = true;
      socketDestroyed = true;
      socketErr = err;
    },
  };

  const transform = createChaosStreamTransform(
    { socketResetBytes: resetThresholdBytes, socket: mockSocket },
    chaos
  );

  // Generate 256KB of data in 32KB chunks
  const chunkSize = 32 * 1024;
  const chunks = Array.from({ length: 8 }, () => Buffer.alloc(chunkSize, 0x55));

  let pipelineError = null;
  transform.on("error", (err) => {
    pipelineError = err;
  });

  const source = Readable.from(chunks);
  transform.resume();
  source.pipe(transform);

  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!socketDestroyed || !socketErr || socketErr.code !== "ECONNRESET") {
    throw new Error("Expected mock socket to be destroyed with ECONNRESET");
  }
  if (!pipelineError || pipelineError.code !== "ECONNRESET") {
    throw new Error("Expected transform stream to emit ECONNRESET error");
  }
  console.log(`    Socket reset triggered at threshold ${resetThresholdBytes} bytes (ECONNRESET).`);
  return { ok: true, resetSockets: chaos.getTelemetry().resetSockets };
};

// Scenario 4: TorBox Upstream Rate-Limit & Outage Bursts
scenarios["debrid-bursts"] = async function runDebridBursts() {
  console.log("  [Vector 3] Running TorBox Upstream Rate-Limit & Outage Resilience Test...");
  const chaos = new ChaosMonkeyService();
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 20,
    jitterMs: 5,
    maxRetries: 3,
    failureThreshold: 3,
    resetTimeoutMs: 100,
  });

  // Inject 2 bursts of 429
  chaos.injectDebridBurst({ rateLimitBurst: 2, retryAfterSec: 0 });
  limiter.setFaultInterceptor(() => chaos.generateDebridFault());

  let successCalls = 0;
  const res1 = await limiter.executeRequest("stream_key_1", async () => {
    successCalls++;
    return { ok: true, url: "https://torbox.app/stream/direct.mp4" };
  });

  if (!res1?.data?.ok || res1.data.url !== "https://torbox.app/stream/direct.mp4") {
    throw new Error("Expected successful recovery after 2 rate limit bursts");
  }
  console.log("    Recovered seamlessly from two 429 rate-limit bursts via exponential backoff.");

  // Test 503 Cloudflare outage handling and circuit breaker tripping
  const breakerLimiter = new TorBoxRateLimiter({
    baseBackoffMs: 10,
    jitterMs: 0,
    maxRetries: 0,
    failureThreshold: 3,
    resetTimeoutMs: 50,
  });

  const html503 = async () => ({
    status: 503,
    headers: { get: () => "text/html" },
    async json() {
      throw new SyntaxError("Unexpected token '<'");
    },
    async text() {
      return "<html><body>503 Cloudflare</body></html>";
    },
  });

  // 3 consecutive failures trip circuit to OPEN
  for (let i = 1; i <= 3; i++) {
    try {
      await breakerLimiter.executeRequest(`outage_${i}`, html503);
    } catch {}
  }

  const state = breakerLimiter.getCircuitState();
  if (state.state !== "OPEN") {
    throw new Error(`Expected circuit state OPEN, got ${state.state}`);
  }
  console.log("    Circuit breaker tripped to OPEN after 3 consecutive 503 errors.");

  // Probe in HALF_OPEN after timeout
  await new Promise((r) => setTimeout(r, 60));
  const probe = await breakerLimiter.executeRequest("probe", async () => ({
    status: 200,
    async json() {
      return { ok: true, recovered: true };
    },
  }));

  if (breakerLimiter.getCircuitState().state !== "CLOSED") {
    throw new Error("Expected circuit to reset to CLOSED after successful probe");
  }
  console.log("    Circuit breaker probed in HALF_OPEN and reset to CLOSED upon recovery.");
  return { ok: true };
};

// Scenario 5: Slow-Drip Bandwidth
scenarios["slow-drip"] = async function runSlowDrip() {
  console.log("  [Vector 4] Running Slow-Drip Bandwidth Throttling (50KB/s)...");
  const chaos = new ChaosMonkeyService();
  const dripRateBps = 50 * 1024; // 50 KB/s
  const transform = createChaosStreamTransform({ slowDripRateBps: dripRateBps }, chaos);

  // Send 15KB chunk
  const chunk15k = Buffer.alloc(15 * 1024, 0x77);
  const start = Date.now();

  const source = Readable.from([chunk15k]);
  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const elapsedMs = Date.now() - start;
  // 15KB at 50KB/s should take ~300ms
  console.log(`    15KB chunk throttled at 50KB/s took ${elapsedMs}ms.`);
  if (elapsedMs < 200) {
    throw new Error(`Throttling was not enforced: elapsed ${elapsedMs}ms < 200ms`);
  }
  return { ok: true, elapsedMs };
};

// Scenario 6: Storage Headroom Exhaustion (<1%) & Safe Write Guard
scenarios["storage-exhaustion"] = async function runStorageExhaustion() {
  console.log("  [Vector 5] Running Storage Exhaustion (<1% headroom) & ENOSPC Write Guard...");
  const chaos = new ChaosMonkeyService();
  chaos.injectStorageExhaustion(true, 0.8);

  const headroom = chaos.getStorageHeadroomOverride();
  if (!headroom || headroom.freePercent > 1.0 || !headroom.lowHeadroom) {
    throw new Error("Expected critical headroom <1%");
  }
  console.log(`    Simulated critical storage headroom: ${headroom.freePercent}% free.`);

  // Test profile service safe write guard against ENOSPC
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-chaos-enospc-"));
  const originalWriteFileSync = fs.writeFileSync;

  try {
    // Inject ENOSPC into fs.writeFileSync
    fs.writeFileSync = function (...args) {
      const enospcErr = new Error("ENOSPC: no space left on device, write");
      enospcErr.code = "ENOSPC";
      throw enospcErr;
    };

    // saveProfile must handle ENOSPC gracefully without crashing
    const saved = saveProfile({ id: "res-test-enospc", name: "Safe Guard" }, tmpDir);
    if (!saved || saved.id !== "res-test-enospc") {
      throw new Error("saveProfile did not return gracefully under ENOSPC");
    }

    // setActiveProfileId must handle ENOSPC gracefully without crashing
    const activeRes = setActiveProfileId("res-test-enospc", tmpDir);
    if (!activeRes || !activeRes.ok) {
      throw new Error("setActiveProfileId did not return gracefully under ENOSPC");
    }

    // safeWriteFileSync must return false
    const guardRes = safeWriteFileSync(path.join(tmpDir, "test.txt"), "data");
    if (guardRes !== false) {
      throw new Error("safeWriteFileSync did not return false on ENOSPC");
    }
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  console.log("    Verified: synchronous ENOSPC handled gracefully with zero crashes.");
  return { ok: true };
};

// Scenario 7: REST Control Plane
scenarios["rest-control"] = async function runRestControl() {
  console.log("  [REST Control] Verifying /api/chaos/* REST Control Plane...");
  const chaos = new ChaosMonkeyService();

  function mockRequest(method, path, body = null) {
    const req = {
      method,
      url: path,
      headers: { host: "localhost:8080" },
      async *[Symbol.asyncIterator]() {
        if (body) yield JSON.stringify(body);
      },
    };
    let resData = "";
    let statusCode = 200;
    const res = {
      setHeader() {},
      set statusCode(code) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      end(chunk) {
        if (chunk) resData += chunk;
      },
    };
    return { req, res, getBody: () => JSON.parse(resData || "{}"), getStatusCode: () => statusCode };
  }

  // 1. GET /api/chaos/config
  const r1 = mockRequest("GET", "/api/chaos/config");
  await handleChaosRoute(r1.req, r1.res, chaos);
  if (r1.getStatusCode() !== 200 || !r1.getBody().ok) throw new Error("GET /api/chaos/config failed");

  // 2. POST /api/chaos/configure
  const r2 = mockRequest("POST", "/api/chaos/configure", { packetLossRate: 0.2 });
  await handleChaosRoute(r2.req, r2.res, chaos);
  if (r2.getStatusCode() !== 200 || r2.getBody().config.packetLossRate !== 0.2) throw new Error("POST /api/chaos/configure failed");

  // 3. POST /api/chaos/reset
  const r3 = mockRequest("POST", "/api/chaos/reset");
  await handleChaosRoute(r3.req, r3.res, chaos);
  if (r3.getStatusCode() !== 200 || r3.getBody().config.packetLossRate !== 0) throw new Error("POST /api/chaos/reset failed");

  // 4. GET /api/chaos/telemetry
  const r4 = mockRequest("GET", "/api/chaos/telemetry");
  await handleChaosRoute(r4.req, r4.res, chaos);
  if (r4.getStatusCode() !== 200 || !r4.getBody().telemetry) throw new Error("GET /api/chaos/telemetry failed");

  console.log("    REST control plane routes (/api/chaos/*) fully operational.");
  return { ok: true };
};

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const targetScenario = args.find((a) => a.startsWith("--scenario="))?.split("=")[1];

  console.log("===============================================================");
  console.log(" ReelOS Adversarial Chaos Monkey & Upstream Resilience Harness");
  console.log("===============================================================\n");

  const toRun = targetScenario ? [targetScenario] : Object.keys(scenarios);
  let failed = 0;

  for (const name of toRun) {
    const fn = scenarios[name];
    if (!fn) {
      console.error(`Unknown scenario: ${name}`);
      process.exit(1);
    }

    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}\n`);
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}: ${err.message}\n`);
      failed++;
    }
  }

  console.log("---------------------------------------------------------------");
  if (failed === 0) {
    console.log(` ALL ${toRun.length} SCENARIOS PASSED 100% GREEN.`);
    console.log("===============================================================");
    process.exit(0);
  } else {
    console.error(` ${failed} OF ${toRun.length} SCENARIOS FAILED.`);
    console.log("===============================================================");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error in chaos-monkey harness:", err);
  process.exit(1);
});
