import assert from "node:assert/strict";
import test from "node:test";
import { Readable, Writable } from "node:stream";
import { EventEmitter } from "node:events";
import {
  ChaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
  createMockDebridResponse,
} from "../services/chaos-monkey-service.mjs";
import { TorBoxRateLimiter } from "../services/debrid-service.mjs";

function createMockHttp(method, url, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:8080" };
  req[Symbol.asyncIterator] = async function* () {
    if (body !== null && body !== undefined) {
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

// ---------------------------------------------------------------------------
// SUITE 1: High-Frequency Concurrent /api/chaos/configure Calls
// ---------------------------------------------------------------------------

test("1.1 High-Frequency: 100 concurrent POST /api/chaos/configure calls execute cleanly without race conditions", async () => {
  const chaos = new ChaosMonkeyService();
  const concurrency = 100;

  const promises = Array.from({ length: concurrency }, (_, i) => {
    const payload = {
      packetLossRate: (i % 10) / 10,
      socketResetBytes: (i + 1) * 1024,
      slowDripRateBps: (i % 2 === 0) ? 50000 : 0,
      simulateStorageExhaustion: (i % 3 === 0),
    };
    const { req, res } = createMockHttp("POST", "/api/chaos/configure", payload);
    return handleChaosRoute(req, res, chaos).then(() => {
      assert.equal(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.equal(parsed.ok, true);
      assert.ok(parsed.config);
      return parsed.config;
    });
  });

  const results = await Promise.all(promises);
  assert.equal(results.length, concurrency);

  // Verify final configuration is healthy and valid
  const finalConfig = chaos.getConfig();
  assert.equal(typeof finalConfig.enabled, "boolean");
  assert.ok(finalConfig.packetLossRate >= 0 && finalConfig.packetLossRate <= 1);
  assert.ok(finalConfig.socketResetBytes > 0);
  assert.equal(typeof finalConfig.simulateStorageExhaustion, "boolean");
});

test("1.2 High-Frequency: 200 concurrent mixed REST operations (/configure, /config, /reset, /telemetry)", async () => {
  const chaos = new ChaosMonkeyService();
  const ops = [];

  for (let i = 0; i < 200; i++) {
    const type = i % 4;
    if (type === 0) {
      const { req, res } = createMockHttp("POST", "/api/chaos/configure", {
        packetLossRate: (i % 5) * 0.1,
        socketResetBytes: (i + 1) * 500,
      });
      ops.push(handleChaosRoute(req, res, chaos).then(() => {
        assert.equal(res.statusCode, 200);
        assert.equal(JSON.parse(res.body).ok, true);
      }));
    } else if (type === 1) {
      const { req, res } = createMockHttp("GET", "/api/chaos/config");
      ops.push(handleChaosRoute(req, res, chaos).then(() => {
        assert.equal(res.statusCode, 200);
        assert.equal(JSON.parse(res.body).ok, true);
      }));
    } else if (type === 2) {
      const { req, res } = createMockHttp("POST", "/api/chaos/reset");
      ops.push(handleChaosRoute(req, res, chaos).then(() => {
        assert.equal(res.statusCode, 200);
        assert.equal(JSON.parse(res.body).ok, true);
      }));
    } else {
      const { req, res } = createMockHttp("GET", "/api/chaos/telemetry");
      ops.push(handleChaosRoute(req, res, chaos).then(() => {
        assert.equal(res.statusCode, 200);
        assert.equal(JSON.parse(res.body).ok, true);
      }));
    }
  }

  await Promise.all(ops);
  assert.ok(true, "All 200 concurrent mixed calls resolved cleanly");
});

test("1.3 Adversarial: malformed, invalid, and extreme payloads return 400 or sanitize without crash", async () => {
  const chaos = new ChaosMonkeyService();

  const testCases = [
    { body: "{ broken json", expectCode: 400 },
    { body: "null", expectCode: [200, 400] },
    { body: "12345", expectCode: [200, 400] },
    { body: JSON.stringify({ packetLossRate: -50 }), expectCode: 200, check: (c) => c.packetLossRate === 0 },
    { body: JSON.stringify({ packetLossRate: 999 }), expectCode: 200, check: (c) => c.packetLossRate === 1 },
    { body: JSON.stringify({ packetLossRate: "not-a-number" }), expectCode: 200, check: (c) => c.packetLossRate === 0 },
    { body: JSON.stringify({ socketResetBytes: -1000 }), expectCode: 200, check: (c) => c.socketResetBytes === 0 },
    { body: JSON.stringify({ socketResetBytes: "invalid" }), expectCode: 200, check: (c) => c.socketResetBytes === 0 },
    { body: JSON.stringify({ debridFaults: null }), expectCode: 200 },
    { body: JSON.stringify({ debridFaults: { outage503Burst: -10 } }), expectCode: 200, check: (c) => c.debridFaults.outage503Burst === 0 },
  ];

  for (const tc of testCases) {
    const { req, res } = createMockHttp("POST", "/api/chaos/configure", tc.body);
    await handleChaosRoute(req, res, chaos);

    if (Array.isArray(tc.expectCode)) {
      assert.ok(tc.expectCode.includes(res.statusCode), `Status ${res.statusCode} not in ${tc.expectCode}`);
    } else {
      assert.equal(res.statusCode, tc.expectCode, `Expected status ${tc.expectCode} for body ${tc.body}, got ${res.statusCode}`);
    }

    if (res.statusCode === 200 && tc.check) {
      const parsed = JSON.parse(res.body);
      assert.ok(tc.check(parsed.config), `Validation failed for config: ${JSON.stringify(parsed.config)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// SUITE 2: Rapid Packet Loss Drops (10%, 50%, 90%) on Simulated Stream Chunks
// ---------------------------------------------------------------------------

test("2.1 Packet Loss: 10% packet loss drops statistically bounded chunks over 1,000 stream chunks", async () => {
  const chaos = new ChaosMonkeyService();
  const lossRate = 0.10;
  const totalChunks = 1000;
  const transform = createChaosStreamTransform({ packetLossRate: lossRate }, chaos);

  const received = [];
  transform.on("data", (chunk) => received.push(chunk));

  const sourceChunks = Array.from({ length: totalChunks }, (_, i) => Buffer.alloc(64, i % 256));
  const source = Readable.from(sourceChunks);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const dropped = chaos.getTelemetry().droppedChunks;
  const delivered = received.length;

  assert.equal(delivered + dropped, totalChunks, "Delivered + dropped chunks must equal total chunks");
  // 10% expectation: with 1,000 trials, dropped chunks should be within 40 to 180 (3-sigma tolerance)
  assert.ok(dropped >= 40 && dropped <= 180, `Dropped ${dropped} out of range [40, 180] for 10% loss`);
  assert.ok(delivered >= 820 && delivered <= 960, `Delivered ${delivered} out of range [820, 960] for 10% loss`);
});

test("2.2 Packet Loss: 50% packet loss drops statistically bounded chunks over 1,000 stream chunks", async () => {
  const chaos = new ChaosMonkeyService();
  const lossRate = 0.50;
  const totalChunks = 1000;
  const transform = createChaosStreamTransform({ packetLossRate: lossRate }, chaos);

  const received = [];
  transform.on("data", (chunk) => received.push(chunk));

  const sourceChunks = Array.from({ length: totalChunks }, (_, i) => Buffer.alloc(64, i % 256));
  const source = Readable.from(sourceChunks);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const dropped = chaos.getTelemetry().droppedChunks;
  const delivered = received.length;

  assert.equal(delivered + dropped, totalChunks, "Delivered + dropped chunks must equal total chunks");
  // 50% expectation: with 1,000 trials, dropped chunks should be within 400 to 600 (3-sigma tolerance)
  assert.ok(dropped >= 400 && dropped <= 600, `Dropped ${dropped} out of range [400, 600] for 50% loss`);
  assert.ok(delivered >= 400 && delivered <= 600, `Delivered ${delivered} out of range [400, 600] for 50% loss`);
});

test("2.3 Packet Loss: 90% packet loss drops statistically bounded chunks over 1,000 stream chunks", async () => {
  const chaos = new ChaosMonkeyService();
  const lossRate = 0.90;
  const totalChunks = 1000;
  const transform = createChaosStreamTransform({ packetLossRate: lossRate }, chaos);

  const received = [];
  transform.on("data", (chunk) => received.push(chunk));

  const sourceChunks = Array.from({ length: totalChunks }, (_, i) => Buffer.alloc(64, i % 256));
  const source = Readable.from(sourceChunks);

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  const dropped = chaos.getTelemetry().droppedChunks;
  const delivered = received.length;

  assert.equal(delivered + dropped, totalChunks, "Delivered + dropped chunks must equal total chunks");
  // 90% expectation: with 1,000 trials, dropped chunks should be within 820 to 960 (3-sigma tolerance)
  assert.ok(dropped >= 820 && dropped <= 960, `Dropped ${dropped} out of range [820, 960] for 90% loss`);
  assert.ok(delivered >= 40 && delivered <= 180, `Delivered ${delivered} out of range [40, 180] for 90% loss`);
});

test("2.4 Packet Loss: 100% loss drops all chunks without hanging pipeline; 0% loss delivers all", async () => {
  const chaos = new ChaosMonkeyService();

  // Test 100% loss
  const transform100 = createChaosStreamTransform({ packetLossRate: 1.0 }, chaos);
  const received100 = [];
  transform100.on("data", (c) => received100.push(c));

  const source100 = Readable.from(Array.from({ length: 100 }, () => Buffer.from("chunk")));
  await new Promise((resolve, reject) => {
    source100.pipe(transform100).on("finish", resolve).on("error", reject);
  });

  assert.equal(received100.length, 0);
  assert.equal(chaos.getTelemetry().droppedChunks, 100);

  // Test 0% loss
  chaos.reset();
  const transform0 = createChaosStreamTransform({ packetLossRate: 0.0 }, chaos);
  const received0 = [];
  transform0.on("data", (c) => received0.push(c));

  const source0 = Readable.from(Array.from({ length: 100 }, () => Buffer.from("chunk")));
  await new Promise((resolve, reject) => {
    source0.pipe(transform0).on("finish", resolve).on("error", reject);
  });

  assert.equal(received0.length, 100);
  assert.equal(chaos.getTelemetry().droppedChunks, 0);
});

// ---------------------------------------------------------------------------
// SUITE 3: Mid-Stream Socket Resets at Extreme Byte Thresholds (1 byte, 10 bytes, 1MB)
// ---------------------------------------------------------------------------

test("3.1 Socket Reset: Extreme minimum 1 byte threshold triggers ECONNRESET on first chunk", async () => {
  const chaos = new ChaosMonkeyService();
  let socketDestroyed = false;
  let socketError = null;

  const mockSocket = {
    destroyed: false,
    destroy(err) {
      this.destroyed = true;
      socketDestroyed = true;
      socketError = err;
    },
  };

  const transform = createChaosStreamTransform(
    { socketResetBytes: 1, socket: mockSocket },
    chaos
  );

  let streamError = null;
  transform.on("error", (err) => {
    streamError = err;
  });

  const delivered = [];
  transform.on("data", (chunk) => delivered.push(chunk));

  // Feed 16KB chunk
  const source = Readable.from([Buffer.alloc(16 * 1024, 0x11), Buffer.alloc(16 * 1024, 0x22)]);
  source.pipe(transform);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(socketDestroyed, true, "Socket should be destroyed");
  assert.equal(socketError?.code, "ECONNRESET");
  assert.equal(streamError?.code, "ECONNRESET");
  assert.equal(chaos.getTelemetry().resetSockets, 1);
  assert.equal(delivered.length, 0, "No data should be pushed after reset");
});

test("3.2 Socket Reset: 10 bytes threshold delivers preceding bytes and resets mid-stream", async () => {
  const chaos = new ChaosMonkeyService();
  let socketDestroyed = false;
  let socketError = null;

  const mockSocket = {
    destroyed: false,
    destroy(err) {
      this.destroyed = true;
      socketDestroyed = true;
      socketError = err;
    },
  };

  const transform = createChaosStreamTransform(
    { socketResetBytes: 10, socket: mockSocket },
    chaos
  );

  let streamError = null;
  transform.on("error", (err) => {
    streamError = err;
  });

  const delivered = [];
  transform.on("data", (chunk) => delivered.push(chunk));

  // Chunk 1: 4 bytes (total 4 < 10) -> delivers
  // Chunk 2: 4 bytes (total 8 < 10) -> delivers
  // Chunk 3: 4 bytes (total 12 >= 10) -> triggers reset
  // Chunk 4: 4 bytes -> never processed
  const source = Readable.from([
    Buffer.from("1234"),
    Buffer.from("5678"),
    Buffer.from("90AB"),
    Buffer.from("CDEF"),
  ]);

  source.pipe(transform);
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(socketDestroyed, true);
  assert.equal(socketError?.code, "ECONNRESET");
  assert.equal(streamError?.code, "ECONNRESET");
  assert.equal(chaos.getTelemetry().resetSockets, 1);

  const totalDeliveredBytes = delivered.reduce((acc, c) => acc + c.length, 0);
  assert.equal(totalDeliveredBytes, 8, "Expected exactly 8 bytes delivered before the 10-byte threshold chunk");
});

test("3.3 Socket Reset: High-volume 1MB threshold resets cleanly after 1,048,576 bytes", async () => {
  const chaos = new ChaosMonkeyService();
  const threshold = 1024 * 1024; // 1 MB
  let socketDestroyed = false;
  let socketError = null;

  const mockSocket = {
    destroyed: false,
    destroy(err) {
      this.destroyed = true;
      socketDestroyed = true;
      socketError = err;
    },
  };

  const transform = createChaosStreamTransform(
    { socketResetBytes: threshold, socket: mockSocket },
    chaos
  );

  let streamError = null;
  transform.on("error", (err) => {
    streamError = err;
  });

  const delivered = [];
  transform.on("data", (chunk) => delivered.push(chunk));

  // 64 chunks of 32KB = 2MB total
  const chunkSize = 32 * 1024;
  const totalChunks = 64;
  const chunks = Array.from({ length: totalChunks }, () => Buffer.alloc(chunkSize, 0xaa));

  const source = Readable.from(chunks);
  source.pipe(transform);

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(socketDestroyed, true);
  assert.equal(socketError?.code, "ECONNRESET");
  assert.equal(streamError?.code, "ECONNRESET");
  assert.equal(chaos.getTelemetry().resetSockets, 1);

  // Exactly 31 chunks of 32KB = 992KB delivered before the 32nd chunk trips 1MB
  const totalDeliveredBytes = delivered.reduce((acc, c) => acc + c.length, 0);
  assert.equal(totalDeliveredBytes, 31 * chunkSize);
  assert.ok(totalDeliveredBytes < threshold, "Delivered bytes must be less than threshold since threshold chunk is not pushed");
});

test("3.4 Socket Reset: 25 concurrent streams reset independently without cross-stream contamination", async () => {
  const chaos = new ChaosMonkeyService();
  const streamCount = 25;

  const results = await Promise.all(
    Array.from({ length: streamCount }, async (_, idx) => {
      let destroyed = false;
      const mockSocket = {
        destroyed: false,
        destroy() {
          this.destroyed = true;
          destroyed = true;
        },
      };

      const resetThreshold = (idx + 1) * 100; // 100B to 2500B
      const transform = createChaosStreamTransform(
        { socketResetBytes: resetThreshold, socket: mockSocket },
        chaos
      );

      let errEmitted = false;
      transform.on("error", (err) => {
        if (err.code === "ECONNRESET") errEmitted = true;
      });

      // Stream 5KB in 50-byte chunks
      const source = Readable.from(Array.from({ length: 100 }, () => Buffer.alloc(50, 0x55)));
      source.pipe(transform);

      await new Promise((resolve) => setTimeout(resolve, 60));
      return { destroyed, errEmitted };
    })
  );

  for (let i = 0; i < streamCount; i++) {
    assert.equal(results[i].destroyed, true, `Stream ${i} socket was not destroyed`);
    assert.equal(results[i].errEmitted, true, `Stream ${i} did not emit ECONNRESET`);
  }
  assert.equal(chaos.getTelemetry().resetSockets, streamCount);
});

// ---------------------------------------------------------------------------
// SUITE 4: Debrid 503 Outage Bursts & Circuit Breaker Fast-Fail Under Load
// ---------------------------------------------------------------------------

test("4.1 Debrid 503 Heavy Load: 50 concurrent requests fail fast when circuit breaker trips to OPEN", async () => {
  const limiter = new TorBoxRateLimiter({
    capacity: 10,
    refillRate: 10,
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 0,
    failureThreshold: 3,
    resetTimeoutMs: 100,
  });

  let upstreamCalls = 0;
  const html503Fetcher = async () => {
    upstreamCalls++;
    return {
      status: 503,
      headers: { get: () => "text/html" },
      async json() {
        throw new SyntaxError("Unexpected token '<'");
      },
      async text() {
        return "<html><body>503 Cloudflare Outage</body></html>";
      },
    };
  };

  // Launch 50 concurrent requests with distinct cache keys
  const concurrency = 50;
  const results = await Promise.allSettled(
    Array.from({ length: concurrency }, (_, i) =>
      limiter.executeRequest(`heavy_503_stream_${i}`, html503Fetcher)
    )
  );

  // All 50 must be rejected (none succeed during 503 outage)
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(rejected.length, concurrency);

  // Circuit breaker must be in OPEN state
  const circuit = limiter.getCircuitState();
  assert.equal(circuit.state, "OPEN");

  // Fast-fail check: exactly failureThreshold (3) to capacity-bounded calls reach upstream
  // All remaining calls MUST fail fast with "circuit breaker is OPEN"
  const fastFailCount = rejected.filter((r) =>
    r.reason.message.includes("circuit breaker is OPEN")
  ).length;

  assert.ok(
    fastFailCount >= concurrency - 15,
    `Expected at least ${concurrency - 15} fast-fails, got ${fastFailCount} (upstreamCalls: ${upstreamCalls})`
  );
  assert.ok(upstreamCalls <= 15, `Upstream calls (${upstreamCalls}) should be strictly bounded by circuit breaker`);
});

test("4.2 Debrid Circuit Breaker: Concurrent load during HALF_OPEN probe transitions cleanly to CLOSED", async () => {
  const limiter = new TorBoxRateLimiter({
    capacity: 20,
    refillRate: 20,
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 0,
    failureThreshold: 2,
    resetTimeoutMs: 50,
  });

  // 1. Force trip to OPEN
  const failingFetcher = async () => ({ status: 503 });
  await assert.rejects(async () => limiter.executeRequest("trip_1", failingFetcher));
  await assert.rejects(async () => limiter.executeRequest("trip_2", failingFetcher));
  assert.equal(limiter.getCircuitState().state, "OPEN");

  // 2. Wait for reset timeout to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  // 3. Now fire 30 concurrent requests against recovered upstream
  let recoveredCalls = 0;
  const recoveredFetcher = async () => {
    recoveredCalls++;
    return {
      status: 200,
      async json() {
        return { ok: true, videoUrl: "https://torbox.app/stream/direct.mkv" };
      },
    };
  };

  const results = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) =>
      limiter.executeRequest(`probe_stream_${i}`, recoveredFetcher)
    )
  );

  // Once probe succeeds, circuit resets to CLOSED and all calls succeed
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(fulfilled.length, 30, "All 30 concurrent requests should succeed upon circuit recovery");
  assert.equal(limiter.getCircuitState().state, "CLOSED");
  assert.equal(limiter.getCircuitState().consecutiveFailures, 0);
});

test("4.3 Debrid Circuit Breaker: Failed probe in HALF_OPEN trips immediately back to OPEN", async () => {
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 0,
    failureThreshold: 2,
    resetTimeoutMs: 40,
  });

  // Trip to OPEN
  await assert.rejects(async () => limiter.executeRequest("trip_a", async () => ({ status: 503 })));
  await assert.rejects(async () => limiter.executeRequest("trip_b", async () => ({ status: 503 })));
  assert.equal(limiter.getCircuitState().state, "OPEN");

  // Wait for reset timeout
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Probe fails again with 503
  await assert.rejects(async () => limiter.executeRequest("probe_fail", async () => ({ status: 503 })));

  // Breaker must immediately return to OPEN
  assert.equal(limiter.getCircuitState().state, "OPEN");

  // Immediate subsequent request must fail fast
  let called = false;
  await assert.rejects(
    async () =>
      limiter.executeRequest("fast_fail_check", async () => {
        called = true;
        return { ok: true };
      }),
    /circuit breaker is OPEN/
  );
  assert.equal(called, false);
});

test("4.4 Debrid Resilience: 20 concurrent requests with transient 503s recover via exponential backoff", async () => {
  const limiter = new TorBoxRateLimiter({
    capacity: 20,
    refillRate: 20,
    baseBackoffMs: 10,
    maxBackoffMs: 50,
    jitterMs: 5,
    maxRetries: 3,
    failureThreshold: 100, // high threshold to focus on retries
  });

  const attemptCounts = new Map();

  const transientFetcher = async (key) => {
    const current = (attemptCounts.get(key) || 0) + 1;
    attemptCounts.set(key, current);

    if (current <= 2) {
      // First 2 attempts return 503 HTML
      return {
        status: 503,
        headers: { get: () => "text/html" },
        async json() {
          throw new SyntaxError("Unexpected token '<'");
        },
        async text() {
          return "<html>503 Transient</html>";
        },
      };
    }

    // 3rd attempt succeeds
    return {
      status: 200,
      async json() {
        return { ok: true, streamReady: true };
      },
    };
  };

  const results = await Promise.all(
    Array.from({ length: 20 }, async (_, i) => {
      const key = `transient_stream_${i}`;
      return limiter.executeRequest(key, () => transientFetcher(key));
    })
  );

  assert.equal(results.length, 20);
  for (let i = 0; i < 20; i++) {
    assert.equal(results[i].data?.ok, true);
    assert.equal(results[i].data?.streamReady, true);
    assert.equal(attemptCounts.get(`transient_stream_${i}`), 3);
  }
});
