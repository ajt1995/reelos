import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import {
  streamPacingState,
  createPacedChunkStream,
  attachConsoleSentinelQoS,
  pipeStreamWithPacing,
} from "../../services/neural-stream-server.mjs";
import { createMockResponse } from "../harness-utils.mjs";

test("Tier 1 - F4.1 Console QoS: activates chunk pacing and 50% bitrate on CONSOLES_GAMING_YIELD", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  // Initial state idle
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;

  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 35,
    activeConsoles: [{ ip: "192.168.1.100", vendor: "playstation" }],
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.bitrateMultiplier, 0.5);
  assert.equal(streamPacingState.pacingDelayMs, 35);
  assert.equal(streamPacingState.activeSpikeReason, "bufferbloat_spike");
});

test("Tier 1 - F4.2 Console QoS: restores normal rate on CONSOLES_GAMING_RESUME", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  streamPacingState.isPacingActive = true;
  streamPacingState.bitrateMultiplier = 0.5;

  mockSentinel.emit("CONSOLES_GAMING_RESUME", {
    reason: "latency_stabilized",
    currentRtt: 14,
  });

  assert.equal(streamPacingState.isPacingActive, false);
  assert.equal(streamPacingState.bitrateMultiplier, 1.0);
  assert.equal(streamPacingState.pacingDelayMs, 0);
  assert.equal(streamPacingState.activeSpikeReason, null);
});

test("Tier 1 - F4.3 Console QoS: createPacedChunkStream slices and paces chunks", async () => {
  const pacer = createPacedChunkStream(5, 1024); // 5ms delay, 1024 bytes slice
  const inputData = Buffer.alloc(3 * 1024, 0xaa);

  const chunks = [];
  pacer.on("data", (c) => chunks.push(c));

  const start = Date.now();
  await new Promise((resolve) => {
    pacer.on("end", resolve);
    pacer.write(inputData);
    pacer.end();
  });
  const elapsed = Date.now() - start;

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 1024);
  assert.equal(chunks[1].length, 1024);
  assert.equal(chunks[2].length, 1024);
  assert.ok(elapsed >= 5);
});

test("Tier 1 - F4.4 Console QoS: pipeStreamWithPacing injects telemetry headers when active", async () => {
  streamPacingState.isPacingActive = true;
  streamPacingState.pacingDelayMs = 15;

  const res = createMockResponse();
  const sampleStream = Readable.from([Buffer.from("video-chunk-data")]);

  pipeStreamWithPacing(sampleStream, res);
  await res.waitForEnd();

  assert.equal(res.getHeader("x-reelos-chunk-pacing"), "active");
  assert.equal(res.getHeader("x-reelos-bitrate-stepdown"), "50%");
  assert.equal(res.getHeader("x-reelos-qos-yield"), "console-gaming");

  streamPacingState.isPacingActive = false;
});

test("Tier 1 - F4.5 Console QoS: pipeStreamWithPacing avoids ERR_HTTP_HEADERS_SENT when headersSent is true", async () => {
  streamPacingState.isPacingActive = true;
  streamPacingState.pacingDelayMs = 10;

  const res = createMockResponse();
  res.headersSent = true; // simulate headers already committed

  const sampleStream = Readable.from([Buffer.from("video-payload")]);
  assert.doesNotThrow(() => {
    pipeStreamWithPacing(sampleStream, res);
  });
  await res.waitForEnd();

  streamPacingState.isPacingActive = false;
});
