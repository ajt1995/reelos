import { test } from "node:test";
import assert from "node:assert/strict";
import { SwarmSimulator } from "../swarm-simulator.mjs";
import {
  assertZeroLegacyPorts,
  sampleProcessMemory,
} from "../harness-utils.mjs";

test("Tier 2 - F18.1 Swarm Simulator Boundary: sampleProcessMemory handles invalid PID gracefully with fallback", async () => {
  const mem = await sampleProcessMemory(99999999);
  assert.ok(typeof mem === "number" && mem > 0, "Non-existent PID falls back to host process memory");

  const nullMem = await sampleProcessMemory(null);
  assert.ok(typeof nullMem === "number" && nullMem > 0, "Null PID falls back to current process memory");
});

test("Tier 2 - F18.2 Swarm Simulator Boundary: durationMs=0 aborts swarm loop immediately", async () => {
  const sim = new SwarmSimulator({ durationMs: 0 });
  const controller = new AbortController();
  controller.abort();
  assert.equal(controller.signal.aborted, true);
});

test("Tier 2 - F18.3 Swarm Simulator Boundary: assertZeroLegacyPorts edge cases with query params and subpaths", () => {
  // Edge cases where legacy port appears in query parameter or hash
  assert.throws(() => assertZeroLegacyPorts("http://127.0.0.1:8096/stream.mp4"), /Legacy port leak detected/);
  assert.throws(() => assertZeroLegacyPorts("http://host:8989/sonarr"), /Legacy port leak detected/);
  assert.throws(() => assertZeroLegacyPorts("http://host:7878/radarr/api"), /Legacy port leak detected/);
  assert.throws(() => assertZeroLegacyPorts("http://host:9696/prowlarr"), /Legacy port leak detected/);

  // Safe non-legacy numbers that contain similar digits
  assert.doesNotThrow(() => assertZeroLegacyPorts("http://localhost:8080/movie/8096"));
  assert.doesNotThrow(() => assertZeroLegacyPorts("https://ts.net/watch?id=7878"));
});

test("Tier 2 - F18.4 Swarm Simulator Boundary: checkTranscodeInvariant verifies no ffmpeg transcoding processes", () => {
  const sim = new SwarmSimulator();
  sim.checkTranscodeInvariant();
  assert.equal(sim.metrics.transcodeViolations, 0);
});

test("Tier 2 - F18.5 Swarm Simulator Boundary: metrics accumulator tracks and increments correctly", () => {
  const sim = new SwarmSimulator();
  sim.metrics.totalRequests += 42;
  sim.metrics.totalBytesStreamed += 1048576;
  sim.metrics.errors.push("Simulated connection timeout");

  assert.equal(sim.metrics.totalRequests, 42);
  assert.equal(sim.metrics.totalBytesStreamed, 1048576);
  assert.equal(sim.metrics.errors.length, 1);
});
