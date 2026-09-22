/**
 * Challenger 2 Empirical Stress Test Harness for Milestone 1:
 * Chaos Monkey & Upstream Resilience
 *
 * Vector 1: Storage Pool Exhaustion (<1% headroom simulation) and ENOSPC write safety across repeated profile saves.
 * Vector 2: Slow-drip throttling (50KB/s) under backpressure: buffer leaks, unbounded memory growth, hanging pipelines.
 * Vector 3: Reset fault plane: /api/chaos/reset verification of hook clearance and 100% baseline throughput restoration.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable, Writable } from "node:stream";

import {
  ChaosMonkeyService,
  chaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
} from "../services/chaos-monkey-service.mjs";

import {
  saveProfile,
  getProfile,
  setActiveProfileId,
  getActiveProfileId,
  listProfiles,
  safeWriteFileSync,
} from "../services/profile-service.mjs";

import {
  checkStorageHeadroom,
  runBackgroundLruEviction,
} from "../services/storage-service.mjs";

import {
  torBoxRateLimiter,
  TorBoxRateLimiter,
} from "../services/debrid-service.mjs";

describe("Challenger 2 - Vector 1: Storage Pool Exhaustion & ENOSPC Write Safety", () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-stress-profile-"));
  });

  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    chaosMonkeyService.reset();
  });

  test("Probe 1.1: checkStorageHeadroom vs Chaos Monkey storage exhaustion override", () => {
    chaosMonkeyService.reset();
    chaosMonkeyService.injectStorageExhaustion(true, 0.5); // 0.5% headroom (<1%)

    const chaosHeadroom = chaosMonkeyService.getStorageHeadroomOverride();
    assert.equal(chaosHeadroom.freePercent, 0.5);
    assert.equal(chaosHeadroom.criticalHeadroom, true);

    // Verify actual production checkStorageHeadroom() function
    const actualHeadroom = checkStorageHeadroom();
    console.log("Actual checkStorageHeadroom() output under chaos injection:", actualHeadroom);

    // Verification: checkStorageHeadroom() calls chaosMonkeyService.getStorageHeadroomOverride()
    const isWiredToChaos = actualHeadroom.freePercent <= 1.0;
    console.log(`[HEADROOM OVERRIDE RESULT] checkStorageHeadroom is wired to chaos override: ${isWiredToChaos}`);
    assert.equal(typeof actualHeadroom.freePercent, "number");
    assert.equal(actualHeadroom.freePercent, 0.5);
    assert.equal(actualHeadroom.criticalHeadroom, true);
    assert.equal(isWiredToChaos, true, "checkStorageHeadroom must be wired to chaos override");
  });

  test("Probe 1.2: saveProfile handles 100 repeated ENOSPC write failures without crashing (with amplification measurement)", () => {
    const origWriteFileSync = fs.writeFileSync;
    let writeCalls = 0;
    let enospcThrownToCaller = 0;

    try {
      fs.writeFileSync = (filePath, data, options) => {
        writeCalls++;
        const err = new Error("ENOSPC: no space left on device, write");
        err.code = "ENOSPC";
        throw err;
      };

      for (let i = 0; i < 100; i++) {
        const payload = {
          id: `stress-user-${i % 5}`,
          name: `User ${i}`,
          watchlist: [`tmdb-${1000 + i}`],
        };
        try {
          const result = saveProfile(payload, tmpDir);
          assert.ok(result);
          assert.equal(result.name, `User ${i}`);
        } catch (err) {
          if (err.code === "ENOSPC") enospcThrownToCaller++;
          else throw err;
        }
      }

      console.log(`[ENOSPC STRESS] 100 saveProfile calls generated ${writeCalls} write attempts (write amplification: ${(writeCalls / 100).toFixed(1)}x)`);
      assert.equal(enospcThrownToCaller, 0, "saveProfile must catch ENOSPC and not crash callers");
      assert.equal(writeCalls, 100, "Zero write amplification: 100 saveProfile calls generate exactly 100 write attempts (1.0x)");
    } finally {
      fs.writeFileSync = origWriteFileSync;
    }
  });

  test("Probe 1.3: Data Integrity Test - Partial write / ENOSPC during saveProfile does not truncate file with atomic write", () => {
    const profileId = "integrity-test-user";
    const initialProfile = saveProfile(
      {
        id: profileId,
        name: "Valued Cinephile",
        watchlist: ["tmdb-101", "tmdb-102"],
        tasteVibe: "criterion",
      },
      tmpDir
    );

    const profilePath = path.join(tmpDir, `${profileId}.json`);
    assert.ok(fs.existsSync(profilePath), "Initial profile file must exist");
    const initialContent = fs.readFileSync(profilePath, "utf8");
    assert.ok(initialContent.includes("Valued Cinephile"));

    // Simulate an interrupted write / ENOSPC during update
    const origWriteFileSync = fs.writeFileSync;
    let fileTruncated = false;
    try {
      fs.writeFileSync = (p, data, opt) => {
        if (p.includes(profileId)) {
          // Standard fs.writeFileSync fails with ENOSPC on the .tmp file
          const err = new Error("ENOSPC: no space left on device");
          err.code = "ENOSPC";
          throw err;
        }
        return origWriteFileSync(p, data, opt);
      };

      saveProfile({ id: profileId, name: "Corrupted Update" }, tmpDir);

      const currentDiskContent = fs.readFileSync(profilePath, "utf8");
      fileTruncated = currentDiskContent.length === 0;
      console.log(`[PROFILE DISK INTEGRITY] File size on disk after failed save: ${currentDiskContent.length} bytes (Truncated: ${fileTruncated})`);
      assert.equal(fileTruncated, false, "Atomic write prevents file truncation on ENOSPC failure");
      assert.ok(currentDiskContent.includes("Valued Cinephile"), "Existing valid profile content is preserved on disk");
    } finally {
      fs.writeFileSync = origWriteFileSync;
    }

    assert.equal(fileTruncated, false, "Empirical proof: atomic write preserves file on ENOSPC failure");
  });

  test("Probe 1.4: setActiveProfileId handles 50 repeated ENOSPC failures gracefully", () => {
    const origWriteFileSync = fs.writeFileSync;
    try {
      fs.writeFileSync = (p, data, opt) => {
        const err = new Error("ENOSPC: disk full");
        err.code = "ENOSPC";
        throw err;
      };

      for (let i = 0; i < 50; i++) {
        const res = setActiveProfileId(`profile-${i}`, tmpDir);
        assert.equal(res.ok, true);
        assert.equal(res.persisted, false);
      }
    } finally {
      fs.writeFileSync = origWriteFileSync;
    }
  });
});

describe("Challenger 2 - Vector 2: Slow-Drip Throttling Under Backpressure", () => {
  after(() => {
    chaosMonkeyService.reset();
  });

  test("Probe 2.1: createChaosStreamTransform throttles at 50KB/s", async () => {
    const chaos = new ChaosMonkeyService();
    const dripBps = 50 * 1024; // 50KB/s
    const transform = createChaosStreamTransform({ slowDripRateBps: dripBps }, chaos);

    const testData = Buffer.alloc(100 * 1024, 0xaa);
    const chunks = [
      testData.subarray(0, 25 * 1024),
      testData.subarray(25 * 1024, 50 * 1024),
      testData.subarray(50 * 1024, 75 * 1024),
      testData.subarray(75 * 1024, 100 * 1024),
    ];

    const startTime = Date.now();
    let receivedBytes = 0;

    const readable = new Readable({
      read() {
        if (chunks.length > 0) {
          this.push(chunks.shift());
        } else {
          this.push(null);
        }
      },
    });

    await new Promise((resolve, reject) => {
      readable
        .pipe(transform)
        .on("data", (c) => {
          receivedBytes += c.length;
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`[SLOW-DRIP 50KB/s] 100KB transfer took ${elapsedMs}ms (${Math.round((receivedBytes / (elapsedMs / 1000)) / 1024)} KB/s)`);
    assert.equal(receivedBytes, 100 * 1024);
    assert.ok(elapsedMs >= 1500, `Expected elapsed >= 1500ms, got ${elapsedMs}ms`);
    assert.ok(chaos.getTelemetry().throttledBytes >= 100 * 1024);
  });

  test("Probe 2.2: Slow-drip backpressure handling - does transform honor downstream pause/drain without leaking memory?", async () => {
    const chaos = new ChaosMonkeyService();
    const dripBps = 100 * 1024; // 100KB/s
    const transform = createChaosStreamTransform({ slowDripRateBps: dripBps }, chaos);

    const totalChunks = 16;
    const chunkSize = 64 * 1024;
    let chunksPushed = 0;

    const source = new Readable({
      highWaterMark: 64 * 1024,
      read() {
        if (chunksPushed < totalChunks) {
          chunksPushed++;
          this.push(Buffer.alloc(chunkSize, 0x55));
        } else {
          this.push(null);
        }
      },
    });

    let consumerReceived = 0;
    const slowConsumer = new Writable({
      highWaterMark: 64 * 1024,
      write(chunk, encoding, callback) {
        consumerReceived += chunk.length;
        setTimeout(callback, 30);
      },
    });

    const memBefore = process.memoryUsage().heapUsed;

    await new Promise((resolve, reject) => {
      source
        .pipe(transform)
        .pipe(slowConsumer)
        .on("finish", resolve)
        .on("error", reject);
    });

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMb = (memAfter - memBefore) / (1024 * 1024);
    console.log(`[BACKPRESSURE STRESS] Processed ${consumerReceived / 1024}KB under backpressure. Heap delta: ${memDeltaMb.toFixed(2)}MB`);
    assert.equal(consumerReceived, totalChunks * chunkSize);
  });

  test("Probe 2.3: Stream cancellation mid-drip - does pipeline abort cleanly without hanging event loop?", async () => {
    const chaos = new ChaosMonkeyService();
    const dripBps = 10 * 1024; // 10KB/s
    const transform = createChaosStreamTransform({ slowDripRateBps: dripBps }, chaos);

    const source = new Readable({
      read() {
        this.push(Buffer.alloc(32 * 1024, 0x11)); // 32KB chunk -> ~3.2s delay
      },
    });

    const dest = new Writable({
      write(chunk, encoding, cb) {
        cb();
      },
    });

    // Attach error handlers to prevent uncaught test failure
    source.on("error", () => {});
    transform.on("error", () => {});
    dest.on("error", () => {});

    source.pipe(transform).pipe(dest);

    // Abruptly destroy destination after 50ms (client disconnected)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const destroyTime = Date.now();
    const clientAbortError = new Error("ECONNRESET: Client disconnected abruptly");
    clientAbortError.code = "ECONNRESET";
    dest.destroy(clientAbortError);
    transform.destroy(clientAbortError);
    source.destroy(clientAbortError);

    const cleanupElapsed = Date.now() - destroyTime;
    console.log(`[CLEANUP PROBE] Stream destroyed cleanly in ${cleanupElapsed}ms`);
    assert.ok(cleanupElapsed < 1000, `Cleanup took too long: ${cleanupElapsed}ms`);

    // Wait 200ms to verify no unhandled rejection or hang occurs
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  test("Probe 2.4: Architecture Check - Is slow-drip transform wired into live neural-stream-server or reelos-box?", async () => {
    const boxSrc = fs.readFileSync(path.join(process.cwd(), "scripts/reelos-box.mjs"), "utf8");
    const boxPipesChaos = boxSrc.includes("createChaosStreamTransform");
    console.log(`[WIRING PROBE] reelos-box.mjs pipes through createChaosStreamTransform: ${boxPipesChaos}`);

    const streamServerSrc = fs.readFileSync(path.join(process.cwd(), "scripts/services/neural-stream-server.mjs"), "utf8");
    const streamServerPipesChaos = streamServerSrc.includes("createChaosStreamTransform") && streamServerSrc.includes("chaosMonkeyService");
    console.log(`[WIRING PROBE] neural-stream-server.mjs pipes through chaos: ${streamServerPipesChaos}`);

    assert.equal(streamServerPipesChaos, true, "neural-stream-server.mjs pipes through createChaosStreamTransform and chaosMonkeyService");
  });
});

describe("Challenger 2 - Vector 3: Reset Fault Plane & Throughput Restoration", () => {
  after(() => {
    chaosMonkeyService.reset();
  });

  test("Probe 3.1: POST /api/chaos/reset completely clears active config and telemetry", async () => {
    const chaos = new ChaosMonkeyService();
    chaos.configure({
      packetLossRate: 0.5,
      corruptChunkRate: 0.2,
      socketResetBytes: 1024,
      slowDripRateBps: 51200,
      debridFaults: {
        enabled: true,
        rateLimitBurst: 5,
        retryAfterSec: 10,
        outage503Burst: 3,
      },
      simulateStorageExhaustion: true,
      exhaustedFreePercent: 0.5,
    });

    assert.equal(chaos.getConfig().enabled, true);
    assert.equal(chaos.getConfig().packetLossRate, 0.5);
    assert.equal(chaos.getConfig().slowDripRateBps, 51200);

    const mockReq = {
      url: "/api/chaos/reset",
      method: "POST",
      headers: { host: "localhost:8088" },
    };

    let statusCode = null;
    let responseBody = "";
    const mockRes = {
      setHeader() {},
      set statusCode(val) { statusCode = val; },
      get statusCode() { return statusCode; },
      end(payload) { responseBody = payload; },
    };

    const handled = await handleChaosRoute(mockReq, mockRes, chaos);
    assert.equal(handled, true);
    assert.equal(statusCode, 200);

    const parsed = JSON.parse(responseBody);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.config.enabled, false);
    assert.equal(parsed.config.packetLossRate, 0);
    assert.equal(parsed.config.slowDripRateBps, 0);
    assert.equal(parsed.config.simulateStorageExhaustion, false);
    assert.equal(parsed.config.debridFaults.enabled, false);

    const telemetry = chaos.getTelemetry();
    for (const [key, val] of Object.entries(telemetry)) {
      assert.equal(val, 0, `Telemetry ${key} should be 0`);
    }
  });

  test("Probe 3.2: Circuit Breaker Recovery after Reset - TorBoxRateLimiter circuit breaker reset check", async () => {
    const limiter = new TorBoxRateLimiter({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
    });

    const chaos = new ChaosMonkeyService();
    chaos.registerCircuitBreaker(limiter);
    limiter.setFaultInterceptor(() => chaos.generateDebridFault());

    // Inject 3 consecutive 503 outages to trip the circuit breaker
    chaos.configure({
      debridFaults: {
        enabled: true,
        outage503Burst: 3,
      },
    });

    // Run 3 failing requests to trip circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await limiter.executeRequest(`test-burst-${i}`, async () => ({ ok: true }), { maxRetries: 0 });
      } catch (err) {}
    }

    const stateBeforeReset = limiter.getCircuitState();
    console.log("[CIRCUIT BREAKER STATE BEFORE RESET]:", stateBeforeReset);
    assert.equal(stateBeforeReset.state, "OPEN", "Circuit breaker must be OPEN after 3 failures");

    // Reset chaos monkey (simulating POST /api/chaos/reset)
    chaos.reset();

    // Test executeRequest immediately after chaos.reset()
    let requestSucceeded = false;
    let failureReason = null;

    try {
      const res = await limiter.executeRequest("test-post-reset", async () => ({ success: true, latencyMs: 5 }));
      requestSucceeded = res?.data?.success === true;
    } catch (err) {
      failureReason = err.message;
    }

    console.log(`[CIRCUIT BREAKER POST-RESET RESULT]: Succeeded: ${requestSucceeded}, Error: ${failureReason}`);
    const stateAfterReset = limiter.getCircuitState();
    console.log("[CIRCUIT BREAKER STATE AFTER RESET]:", stateAfterReset);

    assert.equal(stateAfterReset.state, "CLOSED", "TorBox circuit breaker is CLOSED immediately after chaos reset");
    assert.equal(requestSucceeded, true, "Upstream debrid request succeeds immediately after chaos reset");

    // Also verify torBoxRateLimiter singleton is reset by chaosMonkeyService.reset()
    torBoxRateLimiter.circuitState = "OPEN";
    chaosMonkeyService.reset();
    assert.equal(torBoxRateLimiter.getCircuitState().state, "CLOSED", "Singleton torBoxRateLimiter is reset by chaosMonkeyService.reset()");
  });

  test("Probe 3.3: Throughput Restoration - Stream speed restores to unthrottled after reset", async () => {
    const chaos = new ChaosMonkeyService();
    chaos.injectSlowDrip(20 * 1024);
    assert.equal(chaos.getConfig().slowDripRateBps, 20 * 1024);

    chaos.reset();
    assert.equal(chaos.getConfig().slowDripRateBps, 0);

    const transform = createChaosStreamTransform({}, chaos);
    const testData = Buffer.alloc(100 * 1024, 0xbb);

    const start = Date.now();
    let received = 0;

    const readable = new Readable({
      read() {
        this.push(testData);
        this.push(null);
      },
    });

    await new Promise((resolve) => {
      readable.pipe(transform).on("data", (c) => { received += c.length; }).on("end", resolve);
    });

    const elapsedMs = Date.now() - start;
    console.log(`[POST-RESET THROUGHPUT] 100KB transferred in ${elapsedMs}ms (unthrottled baseline)`);
    assert.equal(received, 100 * 1024);
    assert.ok(elapsedMs < 100, `Baseline transfer took too long: ${elapsedMs}ms`);
  });
});
