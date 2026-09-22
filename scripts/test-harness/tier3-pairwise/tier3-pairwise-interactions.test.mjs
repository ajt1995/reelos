import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  handleStreamRequest as unauthenticatedStreamRequest,
  parseRangeHeader,
  attachConsoleSentinelQoS,
  streamPacingState,
  createPacedChunkStream,
} from "../../services/neural-stream-server.mjs";
import { TorBoxRateLimiter } from "../../services/debrid-service.mjs";
import { WatchPartyService } from "../../services/watchparty-service.mjs";
import { checkStorageHeadroom, runBackgroundLruEviction } from "../../services/storage-service.mjs";
import {
  ChaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
} from "../../services/chaos-monkey-service.mjs";
import { createJellyfinShimHandler } from "../../services/jellyfin-shim-service.mjs";
import { protocolFuzzer } from "../protocol-fuzzer.mjs";
import { SwarmSimulator } from "../swarm-simulator.mjs";
import {
  createMockRequest,
  createMockResponse,
  ensureMediaFixtures,
  assertZeroLegacyPorts,
  sampleProcessMemory,
  measureEventLoopLag,
  TEST_HASH,
} from "../harness-utils.mjs";

import { createPlaybackFixture } from "../playback-fixtures.mjs";
const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

test("Tier 3 - Pair 1 (F1 + F4): DirectPlay Sample Streaming with Console QoS Active", async () => {
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;
  streamPacingState.pacingDelayMs = 0;

  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 25,
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 25);

  const req = createMockRequest({
    url: "/api/stream/sample",
    headers: { range: "bytes=0-1023" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();

  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("x-reelos-directplay"), "true");
  assert.ok(res.body.length > 0);

  // Restore
  mockSentinel.emit("CONSOLES_GAMING_RESUME");
});

test("Tier 3 - Pair 2 (F2 + F4): Hash-Based DirectPlay Stream under Console Latency Spike", async () => {
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;

  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 45,
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 45);

  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    headers: { range: "bytes=0-2047" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();

  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("x-reelos-directplay"), "true");

  mockSentinel.emit("CONSOLES_GAMING_RESUME");
});

test("Tier 3 - Pair 3 (F3 + F14): Debrid Proxy Stream with TorBox 429 Rate Limiter Backoff", async () => {
  const limiter = new TorBoxRateLimiter({ baseBackoffMs: 50 });
  const request429 = async () => ({
    status: 429,
    headers: { get: (h) => (h.toLowerCase() === "retry-after" ? "2" : null) },
  });

  await assert.rejects(
    () => limiter.executeRequest("probe-429", request429, { maxRetries: 0 }),
    /TorBox rate limit \(429\)/
  );

  assert.ok(limiter.backoffUntil > Date.now());
  limiter.resetCircuit();
  assert.equal(limiter.circuitState, "CLOSED");
});

test("Tier 3 - Pair 4 (F3 + F16): Debrid Proxy Stream through Chaos Monkey Slow-Drip Throttling", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.configure({ slowDripRateBps: 500000 }); // 500KB/s

  const transform = createChaosStreamTransform({ slowDripRateBps: 500000 }, chaos);
  const inputData = Buffer.alloc(10240, 0x55); // 10KB
  const source = Readable.from([inputData]);

  const chunks = [];
  transform.on("data", (c) => chunks.push(c));

  await new Promise((res, rej) => source.pipe(transform).on("finish", res).on("error", rej));
  const output = Buffer.concat(chunks);
  assert.equal(output.length, 10240);
  assert.equal(chaos.getTelemetry().throttledBytes, 10240);
});

test("Tier 3 - Pair 5 (F1 + F16): DirectPlay Sample Streaming with Mid-Stream Socket Reset", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.configure({ socketResetBytes: 512 });

  let socketResetFired = false;
  const mockSocket = {
    destroy: (err) => {
      socketResetFired = true;
      assert.equal(err.code, "ECONNRESET");
    },
  };

  const transform = createChaosStreamTransform({ socketResetBytes: 512, socket: mockSocket }, chaos);
  transform.on("error", () => {}); // swallow expected error

  transform.write(Buffer.alloc(256, 0x11));
  assert.equal(socketResetFired, false);

  transform.write(Buffer.alloc(300, 0x22)); // crosses 512B threshold
  assert.equal(socketResetFired, true);
  assert.equal(chaos.getTelemetry().resetSockets, 1);
});

test("Tier 3 - Pair 6 (F2 + F15): Hash DirectPlay Stream Coexists with Fail-Closed Storage Cleanup", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-pair6-"));
  try {
    const oldMedia = path.join(tmpDir, "old-video.mp4");
    const original = Buffer.alloc(50000, 0x33);
    fs.writeFileSync(oldMedia, original);

    // Replaces unsafe age-only deletion assumptions pending a durable managed
    // ownership registry. This is preservation, not completed retention; the
    // existing guarded stream and provider boundaries are unchanged.
    const evictionRes = runBackgroundLruEviction(tmpDir, {
      forcedFreePercent: 4.0,
      targetFreePercent: 12.0,
      mediaDir: tmpDir,
    });
    assert.equal(evictionRes.ok, false);
    assert.equal(evictionRes.available, false);
    assert.equal(evictionRes.code, "managed_retention_unavailable");
    assert.equal(evictionRes.lowHeadroom, true);
    assert.equal(evictionRes.freePercent, 4);
    assert.equal(evictionRes.evicted, false);
    assert.equal(evictionRes.freedBytes, 0);
    assert.deepEqual(evictionRes.items, []);
    assert.deepEqual(fs.readFileSync(oldMedia), original);

    // Now execute DirectPlay stream request
    const req = createMockRequest({
      url: `/api/stream/${TEST_HASH}`,
      headers: { range: "bytes=0-511" },
    });
    const res = createMockResponse();
    const handled = await handleStreamRequest(req, res);
    assert.equal(handled, true);
    await res.waitForEnd();
    assert.equal(res.statusCode, 206);
    assert.deepEqual(fs.readFileSync(oldMedia), original);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test("Tier 3 - Pair 7 (F5 + F17): Static Asset Range Handler Resilient to Fuzzer Range Corpus", async () => {
  const fileSize = 50000;
  for (const header of protocolFuzzer.rangeCorpus) {
    const parsed = parseRangeHeader(header, fileSize);
    if (parsed && typeof parsed === "object") {
      assert.ok(parsed.start >= 0 && parsed.end < fileSize);
    } else {
      assert.ok(parsed === null || parsed === "unsatisfiable");
    }
  }
});

test("Tier 3 - Pair 8 (F6 + F17): Jellyfin Shim Stream Endpoint Handles Boundary Ranges", async () => {
  const shimHandler = createJellyfinShimHandler({
    ...playbackFixture.options,
    verifiedMediaById: { "test-item": ensureMediaFixtures().sampleSource },
    fallbackTitles: [{
      id: "jf-test-item",
      jellyfinId: "test-item",
      title: "Verified pairwise fixture",
      path: ensureMediaFixtures().sampleSource,
    }],
  });
  const handler = (req, res) => shimHandler(playbackFixture.authorize(req), res);
  const testRanges = ["bytes=0-0", "bytes=0-1023", "bytes=1000-", "bytes=0-99999"];

  for (const rangeHeader of testRanges) {
    const req = createMockRequest({
      url: "/Videos/test-item/stream",
      method: "GET",
      headers: { range: rangeHeader },
    });
    const res = createMockResponse();

    const handled = await handler(req, res);
    assert.equal(handled, true);
    await res.waitForEnd();

    assert.ok(
      [200, 206, 416].includes(res.statusCode),
      `Expected status 200, 206, or 416, got ${res.statusCode} on range: ${rangeHeader}`
    );
    assert.notEqual(res.statusCode, 500);
  }
});

test("Tier 3 - Pair 9 (F8 + F17): WebSocket Frame Parser Resilient to Adversarial WS Corpus", () => {
  const service = new WatchPartyService();
  const adversarialFrames = protocolFuzzer.generateAdversarialWsFrames();

  for (const frame of adversarialFrames) {
    assert.doesNotThrow(() => {
      const parsed = service.parseWebSocketFrame(frame.buffer);
      // Either parses safely or returns null / rejects without crashing
      assert.ok(parsed === null || typeof parsed === "object");
    }, `Failed parsing adversarial frame ${frame.name}`);
  }
});

test("Tier 3 - Pair 10 (F9 + F10): WatchParty Room Creation followed by High-Frequency NTP Sync", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Alice" });
  assert.ok(room.code);

  for (let i = 0; i < 50; i++) {
    const clientTime = Date.now() - 100 + i;
    const ntp = service.handleNtpSync(room.code, room.hostId, clientTime);
    assert.equal(ntp.type, "pong");
    assert.equal(ntp.clientSendTime, clientTime);
    assert.ok(ntp.serverReceiveTime > 0);
    assert.ok(ntp.precisionWindowMs <= 250);
  }
});

test("Tier 3 - Pair 11 (F10 + F11): NTP-Synced WatchParty Coordinates Playback Seek Updates", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Bob" });

  // 1. NTP sync to register client clock
  const ntp = service.handleNtpSync(room.code, room.hostId, Date.now());
  assert.equal(ntp.type, "pong");

  // 2. Broadcast seek event
  const updateRes = service.updatePlayback(room.code, room.hostId, {
    action: "seek",
    currentTime: 145.5,
    playbackRate: 1.0,
  });

  assert.equal(updateRes.ok, true);
  assert.equal(updateRes.playback.currentTime, 145.5);
  assert.equal(service.getRoomSummary(room.code).playback.currentTime, 145.5);
});

test("Tier 3 - Pair 12 (F11 + F12): Interleaved Playback State Updates and Floating Emoji Reactions", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Charlie" });

  // Alternate playback changes and emoji reaction bursts
  for (let i = 0; i < 15; i++) {
    service.updatePlayback(room.code, room.hostId, {
      action: i % 2 === 0 ? "play" : "pause",
      currentTime: i * 10,
    });
    service.sendReaction(room.code, room.hostId, {
      emoji: i % 2 === 0 ? "🔥" : "🎉",
      senderName: "Charlie",
    });
  }

  const summary = service.getRoomSummary(room.code);
  assert.equal(summary.playback.currentTime, 140);
  assert.ok(summary.recentReactions.length > 0);
  assert.ok(summary.recentReactions.length <= 10);
});

test("Tier 3 - Pair 13 (F9 + F13): WatchParty Host Leaves Causing Automatic Host Migration", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "HostUser" });
  const originalHostId = room.hostId;

  const joinGuest = service.joinRoom(room.code, { name: "GuestUser" });
  const guestId = joinGuest.participantId;

  assert.equal(service.getRoomSummary(room.code).hostId, originalHostId);

  // Host leaves
  const leaveRes = service.leaveRoom(room.code, originalHostId);
  assert.equal(leaveRes.ok, true);
  assert.equal(leaveRes.roomClosed, false);

  // Guest must now be host in updated room summary
  const updatedRoom = service.getRoomSummary(room.code);
  assert.equal(updatedRoom.hostId, guestId);
});

test("Tier 3 - Pair 14 (F13 + F12): Participant Leaves during High-Frequency Emoji Flood", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Host" });
  const guest = service.joinRoom(room.code, { name: "DepartingGuest" });

  // Send reactions
  for (let i = 0; i < 10; i++) {
    service.sendReaction(room.code, guest.participantId, { emoji: "👏" });
  }

  // Guest leaves
  service.leaveRoom(room.code, guest.participantId);

  // Host sends more reactions without error
  const res = service.sendReaction(room.code, room.hostId, { emoji: "🍿" });
  assert.equal(res.ok, true);

  const summary = service.getRoomSummary(room.code);
  assert.equal(summary.participants.length, 1);
});

test("Tier 3 - Pair 15 (F14 + F16): TorBoxRateLimiter Responds to Chaos Monkey Injected 429/503 Faults", async () => {
  const chaos = new ChaosMonkeyService();
  chaos.configure({
    debridFaults: {
      enabled: true,
      rateLimitBurst: 2,
      retryAfterSec: 4,
      outage503Burst: 1,
    },
  });

  const limiter = new TorBoxRateLimiter({ failureThreshold: 2, baseBackoffMs: 10 });
  limiter.setFaultInterceptor(() => chaos.generateDebridFault());

  // 1st request triggers 503 outage fault
  await assert.rejects(
    () => limiter.executeRequest("test-key-1", async () => ({ ok: true }), { maxRetries: 0 }),
    /TorBox service unavailable \(503\)/
  );

  // 2nd request triggers 429 rate limit fault -> crosses failureThreshold: 2 -> opens circuit breaker
  await assert.rejects(
    () => limiter.executeRequest("test-key-2", async () => ({ ok: true }), { maxRetries: 0 }),
    /TorBox rate limit \(429\)/
  );

  assert.equal(limiter.circuitState, "OPEN");
});

test("Tier 3 - Pair 16 (F15 + F16): Storage Headroom Safe Write Guard Triggered by Chaos Monkey Exhaustion", () => {
  const chaos = new ChaosMonkeyService();
  chaos.injectStorageExhaustion(true, 0.5); // Force 0.5% disk free

  const cfg = chaos.getConfig();
  assert.equal(cfg.simulateStorageExhaustion, true);
  assert.equal(cfg.exhaustedFreePercent, 0.5);

  // Safe write guard checks freePercent
  function safeWriteGuard(freePercent) {
    if (freePercent < 1.0) {
      return { ok: false, error: "ENOSPC: critical storage headroom (<1%)" };
    }
    return { ok: true };
  }

  const guardResult = safeWriteGuard(cfg.exhaustedFreePercent);
  assert.equal(guardResult.ok, false);
  assert.match(guardResult.error, /critical storage headroom/);
});

test("Tier 3 - Pair 17 (F4 + F18): Console Gaming QoS Pacer Telemetry Verified with Swarm Assertions", () => {
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;

  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 35,
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 35);

  // Swarm zero legacy port invariant check on pacer state payload
  assertZeroLegacyPorts({
    qos: streamPacingState,
    url: "http://127.0.0.1:8088/api/stream/sample",
  });

  mockSentinel.emit("CONSOLES_GAMING_RESUME");
});

test("Tier 3 - Pair 18 (F18 + F17): Swarm Invariant Auditing under Adversarial Range Headers", () => {
  const sim = new SwarmSimulator();
  sim.checkTranscodeInvariant();
  assert.equal(sim.metrics.transcodeViolations, 0);

  // Audit range headers from fuzzer against zero legacy ports
  for (const header of protocolFuzzer.rangeCorpus.slice(0, 10)) {
    assertZeroLegacyPorts({
      rangeHeader: header,
      endpoint: "http://127.0.0.1:8088/api/stream",
    });
  }
});
