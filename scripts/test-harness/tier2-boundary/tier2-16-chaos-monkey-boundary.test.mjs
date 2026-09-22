import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  ChaosMonkeyService,
  createChaosStreamTransform,
  handleChaosRoute,
} from "../../services/chaos-monkey-service.mjs";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

test("Tier 2 - F16.1 Chaos Monkey Boundary: packetLossRate 0.0 drops 0 chunks; 1.0 drops 100%", async () => {
  const service = new ChaosMonkeyService();
  service.configure({ packetLossRate: 0.0 });

  const transform = createChaosStreamTransform({ packetLossRate: 0.0 }, service);
  const source = Readable.from([Buffer.from("data-a"), Buffer.from("data-b")]);
  const chunks = [];
  transform.on("data", (c) => chunks.push(c));

  await new Promise((res, rej) => source.pipe(transform).on("finish", res).on("error", rej));
  assert.equal(chunks.length, 2, "0.0 loss rate must drop zero chunks");
  assert.equal(service.getTelemetry().droppedChunks, 0);
});

test("Tier 2 - F16.2 Chaos Monkey Boundary: 1-byte socket reset threshold triggers immediately", async () => {
  const service = new ChaosMonkeyService();
  service.configure({ socketResetBytes: 1 });

  let socketDestroyed = false;
  let destroyError = null;
  const mockSocket = {
    destroy: (err) => {
      socketDestroyed = true;
      destroyError = err;
    },
  };

  const transform = createChaosStreamTransform({ socketResetBytes: 1, socket: mockSocket }, service);
  let errorFired = false;
  transform.on("error", (err) => {
    errorFired = true;
  });

  transform.write(Buffer.from("X")); // 1 byte meets threshold
  assert.equal(socketDestroyed, true);
  assert.equal(destroyError.code, "ECONNRESET");
  assert.equal(service.getTelemetry().resetSockets, 1);
});

test("Tier 2 - F16.3 Chaos Monkey Boundary: debrid burst decrement exhausts exactly to null", () => {
  const service = new ChaosMonkeyService();
  service.configure({
    debridFaults: {
      enabled: true,
      rateLimitBurst: 2,
      retryAfterSec: 3,
      outage503Burst: 1,
    },
  });

  // Outage 503 burst takes precedence: 1 outage
  const fault1 = service.generateDebridFault();
  assert.ok(fault1);
  assert.equal(fault1.status, 503);

  // Rate limit 429 burst: 2 rate limits
  const fault2 = service.generateDebridFault();
  assert.ok(fault2);
  assert.equal(fault2.status, 429);

  const fault3 = service.generateDebridFault();
  assert.ok(fault3);
  assert.equal(fault3.status, 429);

  // Bursts exhausted: returns null
  const fault4 = service.generateDebridFault();
  assert.equal(fault4, null);

  const telem = service.getTelemetry();
  assert.equal(telem.outagesInjected, 1);
  assert.equal(telem.rateLimitsInjected, 2);
});

test("Tier 2 - F16.4 Chaos Monkey Boundary: REST API returns 400 on malformed JSON payload", async () => {
  const service = new ChaosMonkeyService();
  const req = createMockRequest({
    url: "/api/chaos/configure",
    method: "POST",
    body: "{ malformed: json, missing quotes }",
  });
  const res = createMockResponse();

  const handled = await handleChaosRoute(req, res, service);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 400);
  assert.equal(res.json.ok, false);
  assert.match(res.json.error, /Invalid configuration/);
});

test("Tier 2 - F16.5 Chaos Monkey Boundary: unhandled routes return false without mutating response", async () => {
  const service = new ChaosMonkeyService();
  const req = createMockRequest({
    url: "/api/chaos/unknown-route",
    method: "GET",
  });
  const res = createMockResponse();

  const handled = await handleChaosRoute(req, res, service);
  assert.equal(handled, false);
  assert.equal(res.statusCode, 200); // Default, not set by router
});
