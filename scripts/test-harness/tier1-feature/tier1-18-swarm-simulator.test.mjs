import { test } from "node:test";
import assert from "node:assert/strict";
import { SwarmSimulator } from "../swarm-simulator.mjs";
import {
  assertZeroLegacyPorts,
  measureEventLoopLag,
  sampleProcessMemory,
} from "../harness-utils.mjs";

test("Tier 1 - F18.1 Swarm Simulator: initializes configuration and tracking metrics", () => {
  const sim = new SwarmSimulator({ port: 8088, durationMs: 2000 });
  assert.equal(sim.port, 8088);
  assert.equal(sim.baseUrl, "http://127.0.0.1:8088");
  assert.equal(sim.durationMs, 2000);
  assert.equal(sim.metrics.totalRequests, 0);
  assert.equal(sim.metrics.totalBytesStreamed, 0);
  assert.equal(sim.metrics.legacyPortViolations, 0);
});

test("Tier 1 - F18.2 Swarm Simulator: assertZeroLegacyPorts passes for compliant native ReelOS payloads", () => {
  const safePayloads = [
    { port: 8080, url: "http://127.0.0.1:8080/api/box" },
    { magicDns: "https://reel-livingroom.ts.net", port: 8088 },
    JSON.stringify({ directPlay: true, status: "ok" }),
  ];

  for (const p of safePayloads) {
    assert.doesNotThrow(() => assertZeroLegacyPorts(p));
  }
});

test("Tier 1 - F18.3 Swarm Simulator: assertZeroLegacyPorts throws on legacy ports (8096, 8989, 7878, 9696)", () => {
  const badPayloads = [
    "http://192.168.1.50:8096/Videos/1",
    { url: "http://localhost:8989/api" },
    "redirect to :7878/radarr",
    "indexer on port :9696",
  ];

  for (const bad of badPayloads) {
    assert.throws(
      () => assertZeroLegacyPorts(bad),
      /Legacy port leak detected/
    );
  }
});

test("Tier 1 - F18.4 Swarm Simulator: checkTranscodeInvariant verifies zero ffmpeg transcoding processes", () => {
  const sim = new SwarmSimulator();
  sim.checkTranscodeInvariant();
  assert.equal(sim.metrics.transcodeViolations, 0, "No ffmpeg transcode processes should be active");
});

test("Tier 1 - F18.5 Swarm Simulator: measureEventLoopLag captures p50, p90, and p99 statistics", async () => {
  const lag = await measureEventLoopLag(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
  });

  assert.ok(typeof lag.p50Ms === "number");
  assert.ok(typeof lag.p99Ms === "number");
  assert.ok(lag.p50Ms >= 0);
  assert.ok(lag.p99Ms >= lag.p50Ms);
});
