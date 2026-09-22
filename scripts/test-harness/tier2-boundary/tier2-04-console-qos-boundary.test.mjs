import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  streamPacingState,
  createPacedChunkStream,
  attachConsoleSentinelQoS,
} from "../../services/neural-stream-server.mjs";

test("Tier 2 - F4.1 Console QoS Boundary: delta exactly at 15ms threshold triggers pacing", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  streamPacingState.isPacingActive = false;

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "threshold_boundary",
    deltaMs: 15,
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 15);
});

test("Tier 2 - F4.2 Console QoS Boundary: massive spike delta (5000ms) is accepted without overflow", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "massive_spike",
    deltaMs: 5000,
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.pacingDelayMs, 50, "pacingDelayMs must be clamped to 50ms safety ceiling");

  // Restore
  mockSentinel.emit("CONSOLES_GAMING_RESUME", { reason: "normalized" });
  assert.equal(streamPacingState.isPacingActive, false);
});

test("Tier 2 - F4.3 Console QoS Boundary: rapid yield/resume oscillations do not corrupt state", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  for (let i = 0; i < 50; i++) {
    mockSentinel.emit("CONSOLES_GAMING_YIELD", { deltaMs: 20 + i });
    assert.equal(streamPacingState.isPacingActive, true);
    mockSentinel.emit("CONSOLES_GAMING_RESUME", { currentRtt: 12 });
    assert.equal(streamPacingState.isPacingActive, false);
  }

  assert.equal(streamPacingState.isPacingActive, false);
  assert.equal(streamPacingState.bitrateMultiplier, 1.0);
});

test("Tier 2 - F4.4 Console QoS Boundary: createPacedChunkStream with 0-byte input stream", async () => {
  const pacer = createPacedChunkStream(10, 64 * 1024);
  const chunks = [];
  pacer.on("data", (c) => chunks.push(c));

  await new Promise((resolve) => {
    pacer.on("end", resolve);
    pacer.end();
  });

  assert.equal(chunks.length, 0);
});

test("Tier 2 - F4.5 Console QoS Boundary: createPacedChunkStream slices odd-sized input into 64KB pieces", async () => {
  const pacer = createPacedChunkStream(2, 65536); // 64KB
  const oddSize = 65536 * 2 + 123; // 2 full chunks + 123 bytes
  const input = Buffer.alloc(oddSize, 0x33);

  const chunks = [];
  pacer.on("data", (c) => chunks.push(c));

  await new Promise((resolve) => {
    pacer.on("end", resolve);
    pacer.write(input);
    pacer.end();
  });

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 65536);
  assert.equal(chunks[1].length, 65536);
  assert.equal(chunks[2].length, 123);
});
