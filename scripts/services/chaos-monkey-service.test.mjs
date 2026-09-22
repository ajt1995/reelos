import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ChaosMonkeyService,
  chaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
  createMockDebridResponse,
} from "./chaos-monkey-service.mjs";
import { saveProfile, setActiveProfileId, safeWriteFileSync } from "./profile-service.mjs";
import { checkStorageHeadroom } from "./storage-service.mjs";
import { torBoxRateLimiter, TorBoxRateLimiter } from "./debrid-service.mjs";
import { pipeStreamWithPacing, resetStreamPacingState, streamPacingState } from "./neural-stream-server.mjs";

function createMockHttp(method, url, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:8080" };
  req[Symbol.asyncIterator] = async function* () {
    if (body) {
      yield typeof body === "string" ? body : JSON.stringify(body);
    }
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    writeHead(code, headers = {}) {
      this.statusCode = code;
      for (const [k, v] of Object.entries(headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.ended = true;
    },
  };

  return { req, res };
}

test("ChaosMonkeyService initializes with default clean config and zero telemetry", () => {
  const chaos = new ChaosMonkeyService();
  const config = chaos.getConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.packetLossRate, 0);
  assert.equal(config.socketResetBytes, 0);
  assert.equal(config.slowDripRateBps, 0);
  assert.equal(config.debridFaults.enabled, false);
  assert.equal(config.simulateStorageExhaustion, false);

  const telemetry = chaos.getTelemetry();
  assert.equal(telemetry.droppedChunks, 0);
  assert.equal(telemetry.corruptedChunks, 0);
  assert.equal(telemetry.resetSockets, 0);
  assert.equal(telemetry.rateLimitsInjected, 0);
  assert.equal(telemetry.outagesInjected, 0);
});

test("ChaosMonkeyService configure and reset updates state and clears faults", () => {
  const chaos = new ChaosMonkeyService();
  chaos.configure({
    packetLossRate: 0.25,
    socketResetBytes: 65536,
    slowDripRateBps: 51200,
    simulateStorageExhaustion: true,
  });

  const cfg = chaos.getConfig();
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.packetLossRate, 0.25);
  assert.equal(cfg.socketResetBytes, 65536);
  assert.equal(cfg.slowDripRateBps, 51200);
  assert.equal(cfg.simulateStorageExhaustion, true);

  chaos.reset();
  const resetCfg = chaos.getConfig();
  assert.equal(resetCfg.enabled, false);
  assert.equal(resetCfg.packetLossRate, 0);
  assert.equal(resetCfg.socketResetBytes, 0);
  assert.equal(resetCfg.slowDripRateBps, 0);
  assert.equal(resetCfg.simulateStorageExhaustion, false);
});

test("Vector A (Packet Loss): drops chunks with probability P and updates telemetry", async () => {
  const chaos = new ChaosMonkeyService();
  const transform = createChaosStreamTransform({ packetLossRate: 1.0 }, chaos);

  const chunks = [];
  transform.on("data", (c) => chunks.push(c));

  const source = Readable.from([
    Buffer.from("chunk-1"),
    Buffer.from("chunk-2"),
    Buffer.from("chunk-3"),
    Buffer.from("chunk-4"),
  ]);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  assert.equal(chunks.length, 0, "All chunks should have been dropped with packetLossRate=1.0");
  assert.equal(chaos.getTelemetry().droppedChunks, 4);
});

test("Vector A (Chunk Corruption): mutates bytes in chunks when corruptChunkRate is set", async () => {
  const chaos = new ChaosMonkeyService();
  const transform = createChaosStreamTransform({ corruptChunkRate: 1.0 }, chaos);

  const originalPayload = Buffer.from("CRITICAL_MEDIA_HEADER_BYTES_12345");
  const received = [];

  transform.on("data", (c) => received.push(c));

  const source = Readable.from([Buffer.from(originalPayload)]);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  assert.equal(received.length, 1);
  assert.notDeepEqual(received[0], originalPayload, "Payload should be corrupted");
  assert.equal(chaos.getTelemetry().corruptedChunks, 1);
});

test("Vector B (Socket Reset): triggers ECONNRESET once threshold bytes are exceeded", async () => {
  const chaos = new ChaosMonkeyService();
  const mockSocket = {
    destroyed: false,
    destroy(err) {
      this.destroyed = true;
      this.error = err;
    },
  };

  // Threshold: 10 bytes
  const transform = createChaosStreamTransform(
    { socketResetBytes: 10, socket: mockSocket },
    chaos
  );

  const source = Readable.from([
    Buffer.from("12345"), // 5 bytes - passes
    Buffer.from("67890_OVERFLOW"), // 15 bytes - trips reset
    Buffer.from("SHOULD_NOT_ARRIVE"),
  ]);

  let gotError = null;
  transform.on("error", (err) => {
    gotError = err;
  });

  source.pipe(transform);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(gotError, "Transform should emit an error on socket reset");
  assert.equal(gotError.code, "ECONNRESET");
  assert.equal(mockSocket.destroyed, true);
  assert.equal(mockSocket.error?.code, "ECONNRESET");
  assert.equal(chaos.getTelemetry().resetSockets, 1);
});

test("Vector C (Debrid Bursts): injects 429 with retry-after and 503 Cloudflare HTML blocks", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.injectDebridBurst({
    outage503Burst: 1,
    rateLimitBurst: 2,
    retryAfterSec: 7,
  });

  // 1st request: 503 Outage
  const resp1 = chaos.generateDebridFault();
  assert.ok(resp1);
  assert.equal(resp1.status, 503);
  assert.equal(resp1.headers.get("content-type"), "text/html; charset=UTF-8");
  await assert.rejects(async () => {
    await resp1.json();
  }, SyntaxError);

  // 2nd request: 429 Rate limit with retry-after
  const resp2 = chaos.generateDebridFault();
  assert.ok(resp2);
  assert.equal(resp2.status, 429);
  assert.equal(resp2.headers.get("retry-after"), "7");
  const data2 = await resp2.json();
  assert.equal(data2.retryAfter, 7);

  // 3rd request: 429 Rate limit
  const resp3 = chaos.generateDebridFault();
  assert.ok(resp3);
  assert.equal(resp3.status, 429);

  // 4th request: bursts exhausted, returns null to allow normal request
  const resp4 = chaos.generateDebridFault();
  assert.equal(resp4, null);

  const telemetry = chaos.getTelemetry();
  assert.equal(telemetry.outagesInjected, 1);
  assert.equal(telemetry.rateLimitsInjected, 2);
});

test("Vector D (Slow-Drip): throttles stream bandwidth to specified bytes/sec", async () => {
  const chaos = new ChaosMonkeyService();
  // 50 KB/s: 10 KB chunk should take ~200ms
  const transform = createChaosStreamTransform({ slowDripRateBps: 50 * 1024 }, chaos);

  const chunk10k = Buffer.alloc(10 * 1024, 0xaa);
  const start = Date.now();

  const source = Readable.from([chunk10k]);
  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 150, `Elapsed time ${elapsed}ms should reflect throttling delay >= 150ms`);
  assert.equal(chaos.getTelemetry().throttledBytes, 10 * 1024);
  assert.ok(chaos.getTelemetry().throttledSeconds > 0);
});

test("Vector E (Storage Headroom Exhaustion): reports <1% free disk and unavailable managed retention without changing originals", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.injectStorageExhaustion(true, 0.8);

  const headroom = chaos.getStorageHeadroomOverride();
  assert.ok(headroom);
  assert.equal(headroom.freePercent, 0.8);
  assert.equal(headroom.lowHeadroom, true);
  assert.equal(headroom.criticalHeadroom, true);
  assert.equal(headroom.simulatedByChaosMonkey, true);

  const pool = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-chaos-retention-"));
  const fixtures = [
    [path.join(pool, "personal-original.mp4"), "irreplaceable personal original"],
    [path.join(pool, "pinned-favorite.mkv"), "retained favorite bytes"],
    [path.join(pool, "unrecognized.webm"), "unclassified media bytes"],
    [path.join(pool, "pins.json"), '{"pinned":["pinned-favorite"]}'],
  ];
  try {
    const oldTime = new Date("2000-01-01T00:00:00Z");
    for (const [file, contents] of fixtures) {
      fs.writeFileSync(file, contents);
      fs.utimesSync(file, oldTime, oldTime);
    }
    const eviction = await chaos.triggerEvictionUnderExhaustion(pool);
    assert.ok(eviction);
    assert.equal(eviction.ok, false);
    assert.equal(eviction.available, false);
    assert.equal(eviction.code, "managed_retention_unavailable");
    assert.equal(eviction.freePercent, 0.8);
    assert.equal(eviction.lowHeadroom, true);
    assert.equal(eviction.evicted, false);
    assert.equal(eviction.freedBytes, 0);
    assert.deepEqual(eviction.items, []);
    assert.equal(chaos.getTelemetry().storageExhaustionChecks, 1);
    // The telemetry counts a cleanup attempt, never successful file removal.
    assert.equal(chaos.getTelemetry().evictionsTriggered, 1);
    for (const [file, contents] of fixtures) {
      assert.equal(fs.readFileSync(file, "utf8"), contents);
      assert.equal(fs.statSync(file).mtimeMs, oldTime.getTime());
    }
    assert.deepEqual(fs.readdirSync(pool).sort(), fixtures.map(([file]) => path.basename(file)).sort());
  } finally {
    fs.rmSync(pool, { recursive: true, force: true });
  }
});

test("REST Control Plane: GET /api/chaos/config returns active config", async () => {
  const chaos = new ChaosMonkeyService({ packetLossRate: 0.1 });
  const { req, res } = createMockHttp("GET", "/api/chaos/config");

  const handled = await handleChaosRoute(req, res, chaos);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);

  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.config.packetLossRate, 0.1);
});

test("REST Control Plane: POST /api/chaos/configure updates fault settings", async () => {
  const chaos = new ChaosMonkeyService();
  const payload = {
    packetLossRate: 0.15,
    socketResetBytes: 131072,
    slowDripRateBps: 25600,
    storageExhaustion: true,
  };
  const { req, res } = createMockHttp("POST", "/api/chaos/configure", payload);

  const handled = await handleChaosRoute(req, res, chaos);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);

  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.config.packetLossRate, 0.15);
  assert.equal(body.config.socketResetBytes, 131072);
  assert.equal(body.config.slowDripRateBps, 25600);
  assert.equal(body.config.simulateStorageExhaustion, true);
});

test("REST Control Plane: POST /api/chaos/reset deactivates all faults", async () => {
  const chaos = new ChaosMonkeyService({ packetLossRate: 0.5, socketResetBytes: 1000 });
  const { req, res } = createMockHttp("POST", "/api/chaos/reset");

  const handled = await handleChaosRoute(req, res, chaos);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);

  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.config.enabled, false);
  assert.equal(body.config.packetLossRate, 0);
  assert.equal(body.config.socketResetBytes, 0);
});

test("REST Control Plane: GET /api/chaos/telemetry returns metrics counters", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.telemetry.droppedChunks = 42;
  chaos.telemetry.resetSockets = 3;

  const { req, res } = createMockHttp("GET", "/api/chaos/telemetry");

  const handled = await handleChaosRoute(req, res, chaos);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);

  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.telemetry.droppedChunks, 42);
  assert.equal(body.telemetry.resetSockets, 3);
});

test("Vector E (Safe Write Guard): saveProfile, setActiveProfileId, and safeWriteFileSync survive ENOSPC gracefully", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-test-enospc-guard-"));
  const originalWriteFileSync = fs.writeFileSync;

  try {
    saveProfile({ id: "res-existing-user", name: "Existing User" }, tmpDir);
    // Simulate disk full (ENOSPC)
    fs.writeFileSync = function () {
      const err = new Error("ENOSPC: no space left on device, write");
      err.code = "ENOSPC";
      throw err;
    };

    // 1. Failed persistence must never be acknowledged as a saved profile.
    assert.throws(() => saveProfile({ id: "res-enospc-user", name: "Surviving User" }, tmpDir), /storage is full/);
    assert.equal(fs.existsSync(path.join(tmpDir, "res-enospc-user.json")), false);

    // 2. Existing-profile activation reports failure without claiming persistence.
    const activeRes = setActiveProfileId("res-existing-user", tmpDir);
    assert.ok(activeRes);
    assert.equal(activeRes.ok, false);
    assert.equal(activeRes.persisted, false);

    // 3. safeWriteFileSync returns false
    const writeRes = safeWriteFileSync(path.join(tmpDir, "dummy.json"), "{}");
    assert.equal(writeRes, false);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});

test("Remediation 1: checkStorageHeadroom dynamically reflects Chaos Monkey storage override", () => {
  chaosMonkeyService.reset();
  try {
    chaosMonkeyService.injectStorageExhaustion(true, 0.4);
    const result = checkStorageHeadroom();
    assert.equal(result.freePercent, 0.4);
    assert.equal(result.criticalHeadroom, true);
    assert.equal(result.lowHeadroom, true);
    assert.equal(result.simulatedByChaosMonkey, true);

    chaosMonkeyService.reset();
    const cleanResult = checkStorageHeadroom();
    assert.equal(cleanResult.simulatedByChaosMonkey, undefined);
  } finally {
    chaosMonkeyService.reset();
  }
});

test("Remediation 2: chaosMonkeyService.reset and /api/chaos/reset restore circuit breakers", async () => {
  const customLimiter = new TorBoxRateLimiter({ failureThreshold: 2 });
  const chaos = new ChaosMonkeyService();
  chaos.registerCircuitBreaker(customLimiter);

  // Trip both limiters
  customLimiter.circuitState = "OPEN";
  torBoxRateLimiter.circuitState = "OPEN";

  assert.equal(customLimiter.getCircuitState().state, "OPEN");
  assert.equal(torBoxRateLimiter.getCircuitState().state, "OPEN");

  // Reset through chaos service
  chaos.reset();
  assert.equal(customLimiter.getCircuitState().state, "CLOSED");

  // Re-trip torBoxRateLimiter and reset through REST endpoint
  torBoxRateLimiter.circuitState = "OPEN";
  const { req, res } = createMockHttp("POST", "/api/chaos/reset");
  const handled = await handleChaosRoute(req, res, chaosMonkeyService);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(torBoxRateLimiter.getCircuitState().state, "CLOSED");
});

test("Remediation 3: createChaosStreamTransform destroy cancels dripTimer and discards late chunks cleanly", async () => {
  const chaos = new ChaosMonkeyService();
  const transform = createChaosStreamTransform({ slowDripRateBps: 10 * 1024 }, chaos);

  const readable = new Readable({
    read() {
      this.push(Buffer.alloc(20 * 1024, 0x77));
    },
  });

  const emittedChunks = [];
  readable.on("error", () => {});
  transform.on("data", (c) => emittedChunks.push(c));
  transform.on("error", () => {}); // Catch expected abort error

  readable.pipe(transform);

  // Allow transform to begin delay
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Destroy mid-drip
  const abortErr = new Error("ECONNRESET: Client abort");
  abortErr.code = "ECONNRESET";
  transform.destroy(abortErr);
  readable.destroy(abortErr);

  // Wait 100ms to confirm no unhandled exception fires from canceled timer
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(transform.destroyed, true);
});

test("Remediation 4: safeWriteFileSync atomic writes preserve destination file on disk during ENOSPC", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-atomic-write-test-"));
  const targetFile = path.join(tmpDir, "precious-profile.json");
  const originalContent = JSON.stringify({ id: "res-precious", notes: "Irreplaceable cinephile notes" });

  fs.writeFileSync(targetFile, originalContent, "utf8");
  assert.ok(fs.existsSync(targetFile));

  const origWriteFileSync = fs.writeFileSync;
  try {
    // Intercept fs.writeFileSync to simulate ENOSPC during update
    fs.writeFileSync = function (filePath, data, options) {
      if (filePath.includes("precious-profile")) {
        const err = new Error("ENOSPC: no space left on device");
        err.code = "ENOSPC";
        throw err;
      }
      return origWriteFileSync(filePath, data, options);
    };

    const saved = saveProfile({ id: "res-precious", notes: "Corrupted overwrite attempt" }, tmpDir);
    assert.ok(saved);

    // Verify original file on disk was NOT truncated or overwritten
    const contentOnDisk = fs.readFileSync(targetFile, "utf8");
    assert.equal(contentOnDisk, originalContent, "Destination file must remain untruncated and identical on disk");
  } finally {
    fs.writeFileSync = origWriteFileSync;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});
