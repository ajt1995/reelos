import { test } from "node:test";
import assert from "node:assert/strict";
import EventEmitter from "node:events";
import { Readable } from "node:stream";
import {
  streamPacingState,
  createPacedChunkStream,
  attachConsoleSentinelQoS,
  pipeStreamWithPacing,
} from "./services/neural-stream-server.mjs";

test("Console QoS: attachConsoleSentinelQoS activates chunk pacing on latency spike (>15ms)", () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  // Initial state should be idle
  streamPacingState.isPacingActive = false;
  streamPacingState.bitrateMultiplier = 1.0;

  // 1. Fire CONSOLES_GAMING_YIELD with 35ms spike
  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 35,
    activeConsoles: [{ ip: "192.168.1.100", vendor: "playstation" }],
  });

  assert.equal(streamPacingState.isPacingActive, true);
  assert.equal(streamPacingState.bitrateMultiplier, 0.5);
  assert.equal(streamPacingState.pacingDelayMs, 35);
  assert.equal(streamPacingState.activeSpikeReason, "bufferbloat_spike");

  // 2. Fire CONSOLES_GAMING_RESUME
  mockSentinel.emit("CONSOLES_GAMING_RESUME", {
    reason: "latency_stabilized",
    currentRtt: 16,
  });

  assert.equal(streamPacingState.isPacingActive, false);
  assert.equal(streamPacingState.bitrateMultiplier, 1.0);
  assert.equal(streamPacingState.pacingDelayMs, 0);
  assert.equal(streamPacingState.activeSpikeReason, null);
});

test("Console QoS: createPacedChunkStream slices and paces chunks", async () => {
  const pacer = createPacedChunkStream(5, 1024); // 5ms delay, 1KB max piece
  const inputData = Buffer.alloc(3 * 1024, 0x7f); // 3KB buffer

  const chunks = [];
  pacer.on("data", (chunk) => chunks.push(chunk));

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
  // Total elapsed time must reflect pacing delay (> 5ms)
  assert.ok(elapsed >= 5);
});

test("Console QoS: pipeStreamWithPacing injects telemetry headers when active", async () => {
  const mockSentinel = new EventEmitter();
  attachConsoleSentinelQoS(mockSentinel);

  // Activate QoS pacing
  mockSentinel.emit("CONSOLES_GAMING_YIELD", {
    reason: "bufferbloat_spike",
    deltaMs: 25,
  });

  const headers = {};
  const mockRes = {
    setHeader: (k, v) => { headers[k] = v; },
    write: () => true,
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
  };

  const sampleStream = Readable.from([Buffer.from("test video chunk")]);
  pipeStreamWithPacing(sampleStream, mockRes);

  assert.equal(headers["X-ReelOS-Chunk-Pacing"], "active");
  assert.equal(headers["X-ReelOS-Bitrate-Stepdown"], "50%");
  assert.equal(headers["X-ReelOS-QoS-Yield"], "console-gaming");

  // Deactivate
  mockSentinel.emit("CONSOLES_GAMING_RESUME", { reason: "latency_stabilized" });
});

test("Console QoS: pipeStreamWithPacing avoids exception when headersSent is already true", () => {
  streamPacingState.isPacingActive = true;
  streamPacingState.pacingDelayMs = 10;

  const mockRes = {
    headersSent: true,
    setHeader: () => {
      throw new Error("ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client");
    },
    write: () => true,
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
  };

  const sampleStream = Readable.from([Buffer.from("video payload")]);
  assert.doesNotThrow(() => {
    pipeStreamWithPacing(sampleStream, mockRes);
  });

  streamPacingState.isPacingActive = false;
});

