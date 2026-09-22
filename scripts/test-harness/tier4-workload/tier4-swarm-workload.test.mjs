import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  startTestBox,
  createWsClient,
  sampleProcessMemory,
  assertZeroLegacyPorts,
  ensureMediaFixtures,
  TEST_HASH,
} from "../harness-utils.mjs";
import { SwarmSimulator } from "../swarm-simulator.mjs";
import { TorBoxRateLimiter } from "../../services/debrid-service.mjs";
import { ChaosMonkeyService } from "../../services/chaos-monkey-service.mjs";
import {
  attachConsoleSentinelQoS,
  streamPacingState,
  handleStreamRequest as unauthenticatedStreamRequest,
} from "../../services/neural-stream-server.mjs";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

import { createPlaybackFixture } from "../playback-fixtures.mjs";
const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

let box = null;

before(async () => {
  box = await startTestBox({ port: 8088, timeoutMs: 15000, env: { REELOS_STATE: playbackFixture.stateDir } });
});

after(() => {
  if (box) {
    box.stop();
  }
});

test("Tier 4 - Scenario 1: Continuous 4K DirectPlay Streaming Swarm (F1, F2, F3)", async () => {
  const sim = new SwarmSimulator({ port: box.port, serverPid: box.pid, playbackHeaders: { cookie: playbackFixture.cookie } });
  const abortCtrl = new AbortController();

  // Run 4 concurrent streamers for 1000ms
  const streamers = [1, 2, 3, 4].map((id) =>
    sim.runDirectPlayStreamer(id, abortCtrl.signal)
  );

  await new Promise((r) => setTimeout(r, 1000));
  abortCtrl.abort();
  await Promise.all(streamers);

  assert.ok(sim.metrics.totalRequests >= 4, "Must execute multiple streaming requests");
  assert.ok(sim.metrics.totalBytesStreamed > 0, "Must stream video bytes");
  sim.checkTranscodeInvariant();
  assert.equal(sim.metrics.transcodeViolations, 0, "Zero ffmpeg transcoding load");
  const unhandledErrors = sim.metrics.errors.filter(
    (e) => !e.includes("fetch failed") && !e.includes("aborted")
  );
  assert.equal(unhandledErrors.length, 0, `Stream errors: ${unhandledErrors.join(", ")}`);
});

test("Tier 4 - Scenario 2: Rapid Seek Scrubbing & Mid-Stream Socket Aborts (F1, F2, F5)", async () => {
  const sim = new SwarmSimulator({ port: box.port, serverPid: box.pid, playbackHeaders: { cookie: playbackFixture.cookie } });
  const abortCtrl = new AbortController();

  // 3 concurrent scrubbers rapidly seeking and aborting sockets
  const scrubbers = [5, 6, 7].map((id) =>
    sim.runSeekScrubber(id, abortCtrl.signal)
  );

  await new Promise((r) => setTimeout(r, 1000));
  abortCtrl.abort();
  await Promise.all(scrubbers);

  assert.ok(sim.metrics.totalRequests >= 3, "Scrubbers must issue multiple requests");

  // Allow sockets to settle
  await new Promise((r) => setTimeout(r, 100));

  // Verify daemon is still alive and responsive after abort storm
  const checkRes = await fetch(`${box.baseUrl}/api/stream/sample`, {
    headers: { range: "bytes=0-1023", cookie: playbackFixture.cookie },
  });
  assert.equal(checkRes.status, 206);
  assert.equal(checkRes.headers.get("x-reelos-directplay"), "true");
});

test("Tier 4 - Scenario 3: WatchParty Clock Sync & Reaction Storm (F8, F9, F10, F11, F12, F13)", async () => {
  const roomCode = "STORM1";
  // 1. Create room
  const createRes = await fetch(`${box.baseUrl}/api/watchparty/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName: "StormHost", customCode: roomCode }),
  });
  assert.equal(createRes.status, 200);

  // 2. Connect 3 WebSocket clients (Host + 2 Guests)
  const hostWs = await createWsClient(box.port, `/ws/watchparty?room=${roomCode}&name=Host1&id=host-1`);
  const guest1 = await createWsClient(box.port, `/ws/watchparty?room=${roomCode}&name=Guest2&id=guest-2`);
  const guest2 = await createWsClient(box.port, `/ws/watchparty?room=${roomCode}&name=Guest3&id=guest-3`);

  // 3. NTP sync check: ±250ms target precision
  const t0 = Date.now();
  hostWs.send({ type: "ping", clientSendTime: t0 });
  const pongMsg = await hostWs.waitForMessage((m) => m.type === "pong");
  assert.equal(pongMsg.type, "pong");
  assert.ok(pongMsg.precisionWindowMs <= 250);

  // 4. Reaction storm: flood 50+ floating reactions across guests
  for (let i = 0; i < 50; i++) {
    guest1.send({ type: "reaction", emoji: "🔥", senderName: "Guest2" });
    guest2.send({ type: "reaction", emoji: "🍿", senderName: "Guest3" });
  }

  // Allow broadcast to settle
  await new Promise((r) => setTimeout(r, 200));

  // Verify room state is healthy and bounded
  const summaryRes = await fetch(`${box.baseUrl}/api/watchparty/room/${roomCode}`);
  const summaryData = await summaryRes.json();
  assert.equal(summaryData.ok, true);
  assert.ok(summaryData.room.participants.length >= 3);
  assert.ok(summaryData.room.recentReactions.length <= 10, "Summary must be bounded to 10 items");

  hostWs.close();
  guest1.close();
  guest2.close();
});

test("Tier 4 - Scenario 4: Degraded Network & Debrid Rate Limit Storm (F3, F14, F16)", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.configure({
    debridFaults: {
      enabled: true,
      rateLimitBurst: 3,
      retryAfterSec: 2,
      outage503Burst: 2,
    },
  });

  const limiter = new TorBoxRateLimiter({
    failureThreshold: 3,
    baseBackoffMs: 10,
    maxRetries: 1,
  });

  limiter.setFaultInterceptor(() => chaos.generateDebridFault());

  let failures = 0;
  for (let i = 0; i < 5; i++) {
    try {
      await limiter.executeRequest(`key-${i}`, async () => ({ ok: true }));
    } catch {
      failures++;
    }
  }

  assert.ok(failures >= 3, "Rate limit and outage faults must trigger errors");
  const circuit = limiter.getCircuitState();
  assert.equal(circuit.state, "OPEN", "Circuit breaker must open under severe upstream storm");

  // Reset and verify recovery
  limiter.resetCircuit();
  assert.equal(limiter.circuitState, "CLOSED");
});

test("Tier 4 - Scenario 5: Console Gaming Yield Under Swarm Load (F4, F18)", async () => {
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;
  streamPacingState.pacingDelayMs = 0;

  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  // Trigger latency spike >15ms
  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 35,
    activeConsoles: [{ ip: "192.168.1.150", vendor: "nintendo" }],
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 35);
  assert.equal(streamPacingState.bitrateMultiplier, 0.5);

  // DirectPlay streaming during QoS yield
  const req = createMockRequest({
    url: "/api/stream/sample",
    headers: { range: "bytes=0-4095" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();

  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("x-reelos-directplay"), "true");

  // Latency normalizes: resume
  mockSentinel.emit("CONSOLES_GAMING_RESUME");
  assert.equal(streamPacingState.isPacingActive, false);
  assert.equal(streamPacingState.bitrateMultiplier, 1.0);
  assert.equal(streamPacingState.pacingDelayMs, 0);
});

test("Tier 4 - Scenario 6: Unified 15+ Client Swarm Load Peak on Port 8088 (F1-F18)", async () => {
  const sim = new SwarmSimulator({
    port: box.port,
    playbackHeaders: { cookie: playbackFixture.cookie },
    serverPid: box.pid,
    durationMs: 2500,
  });

  const metrics = await sim.runSwarm();

  assert.ok(metrics.totalRequests >= 15, `Expected >= 15 requests, got ${metrics.totalRequests}`);
  assert.equal(metrics.legacyPortViolations, 0, "Zero legacy port violations (8096, 8989, 7878, 9696)");
  assert.equal(metrics.transcodeViolations, 0, "Zero host CPU ffmpeg transcoding violations");

  // Windows < 100MB working set invariant
  const mem = await sampleProcessMemory(box.pid);
  assert.ok(
    mem < 100,
    `ReelOS background memory footprint (${mem.toFixed(1)}MB) must stay strictly under 100MB`
  );

  // Event loop responsiveness
  if (metrics.eventLoopLag) {
    assert.ok(
      typeof metrics.eventLoopLag.p50Ms === "number" && metrics.eventLoopLag.p50Ms >= 0,
      "Valid event loop p50 lag"
    );
    assert.ok(
      typeof metrics.eventLoopLag.p99Ms === "number" && metrics.eventLoopLag.p99Ms < 1000,
      `Event loop p99 lag (${metrics.eventLoopLag.p99Ms.toFixed(1)}ms) must be bounded`
    );
  }
});
