import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  ChaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
} from "../../services/chaos-monkey-service.mjs";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

test("Tier 1 - F16.1 Chaos Monkey: configure and reset manage active fault state and telemetry", () => {
  const service = new ChaosMonkeyService();
  assert.equal(service.getConfig().enabled, false);

  service.configure({ packetLossRate: 0.15, slowDripRateBps: 50000 });
  assert.equal(service.getConfig().enabled, true);
  assert.equal(service.getConfig().packetLossRate, 0.15);
  assert.equal(service.getConfig().slowDripRateBps, 50000);

  service.reset();
  assert.equal(service.getConfig().enabled, false);
  assert.equal(service.getConfig().packetLossRate, 0);
});

test("Tier 1 - F16.2 Chaos Monkey: createChaosStreamTransform drops chunks on packet loss", async () => {
  const service = new ChaosMonkeyService();
  service.configure({ packetLossRate: 1.0 }); // 100% loss

  const transform = createChaosStreamTransform({ packetLossRate: 1.0 }, service);
  const inputChunks = [Buffer.from("chunk1"), Buffer.from("chunk2"), Buffer.from("chunk3")];
  const source = Readable.from(inputChunks);

  const received = [];
  transform.on("data", (c) => received.push(c));

  await new Promise((resolve, reject) => {
    source.pipe(transform).on("finish", resolve).on("error", reject);
  });

  assert.equal(received.length, 0, "100% packet loss must drop all chunks");
  assert.equal(service.getTelemetry().droppedChunks, 3);
});

test("Tier 1 - F16.3 Chaos Monkey: injects socket reset after threshold bytes", async () => {
  const service = new ChaosMonkeyService();
  service.configure({ socketResetBytes: 500 });

  let socketDestroyed = false;
  let destroyError = null;
  const mockSocket = {
    destroy: (err) => {
      socketDestroyed = true;
      destroyError = err;
    },
  };

  const transform = createChaosStreamTransform({ socketResetBytes: 500, socket: mockSocket }, service);
  const chunk1 = Buffer.alloc(300, 0x11);
  const chunk2 = Buffer.alloc(300, 0x22);

  let errorEmitted = false;
  transform.on("error", (err) => {
    errorEmitted = true;
    assert.equal(err.code, "ECONNRESET");
  });

  transform.write(chunk1);
  transform.write(chunk2);

  assert.equal(socketDestroyed, true);
  assert.equal(destroyError.code, "ECONNRESET");
  assert.equal(service.getTelemetry().resetSockets, 1);
});

test("Tier 1 - F16.4 Chaos Monkey: configure debrid rate limit and outage bursts", () => {
  const service = new ChaosMonkeyService();
  service.configure({
    debridFaults: {
      enabled: true,
      rateLimitBurst: 3,
      retryAfterSec: 5,
      outage503Burst: 2,
    },
  });

  const cfg = service.getConfig();
  assert.equal(cfg.debridFaults.enabled, true);
  assert.equal(cfg.debridFaults.rateLimitBurst, 3);
  assert.equal(cfg.debridFaults.retryAfterSec, 5);
  assert.equal(cfg.debridFaults.outage503Burst, 2);
});

test("Tier 1 - F16.5 Chaos Monkey: REST control plane endpoints (/api/chaos/*) configure and reset", async () => {
  const service = new ChaosMonkeyService();

  // POST /api/chaos/configure
  const postReq = createMockRequest({
    url: "/api/chaos/configure",
    method: "POST",
    body: JSON.stringify({ packetLossRate: 0.25, slowDripRateBps: 64000 }),
  });
  const postRes = createMockResponse();
  const handledPost = await handleChaosRoute(postReq, postRes, service);
  assert.equal(handledPost, true);
  await postRes.waitForEnd();
  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.json.ok, true);
  assert.equal(postRes.json.config.packetLossRate, 0.25);

  // GET /api/chaos/config
  const getReq = createMockRequest({ url: "/api/chaos/config", method: "GET" });
  const getRes = createMockResponse();
  await handleChaosRoute(getReq, getRes, service);
  await getRes.waitForEnd();
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json.config.packetLossRate, 0.25);

  // POST /api/chaos/reset
  const resetReq = createMockRequest({ url: "/api/chaos/reset", method: "POST" });
  const resetRes = createMockResponse();
  await handleChaosRoute(resetReq, resetRes, service);
  await resetRes.waitForEnd();
  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.json.config.enabled, false);
});
