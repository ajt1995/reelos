import { test } from "node:test";
import assert from "node:assert/strict";
import { TorBoxRateLimiter, parseRetryAfter } from "../../services/debrid-service.mjs";

test("Tier 1 - F14.1 TorBox Resilience: parseRetryAfter parses numeric seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("30"), 30);
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(null, 15), 15);
  assert.equal(parseRetryAfter("", 10), 10);

  // Future HTTP date
  const futureDate = new Date(Date.now() + 60000).toUTCString();
  const diffSec = parseRetryAfter(futureDate);
  assert.ok(diffSec >= 58 && diffSec <= 62);
});

test("Tier 1 - F14.2 TorBox Resilience: acquireToken acquires tokens within capacity immediately", async () => {
  const limiter = new TorBoxRateLimiter({ capacity: 3, refillRate: 10 });
  const start = Date.now();

  await limiter.acquireToken();
  await limiter.acquireToken();
  await limiter.acquireToken();

  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, "Initial tokens within capacity must acquire instantly");
  assert.ok(limiter.tokens <= 0.1);
});

test("Tier 1 - F14.3 TorBox Resilience: caches successful responses and bypasses network on cache hit", async () => {
  const limiter = new TorBoxRateLimiter({ ttlMs: 10000 });
  let networkCalls = 0;

  const requestFn = async () => {
    networkCalls++;
    return { data: { id: "torrent-1", status: "ready" } };
  };

  const res1 = await limiter.executeRequest("item-1", requestFn);
  assert.equal(res1.fromCache, false);
  assert.equal(networkCalls, 1);

  const res2 = await limiter.executeRequest("item-1", requestFn);
  assert.equal(res2.fromCache, true);
  assert.equal(networkCalls, 1, "Must not execute network call on cache hit");
});

test("Tier 1 - F14.4 TorBox Resilience: sets exponential/retry-after backoff on HTTP 429 response", async () => {
  const limiter = new TorBoxRateLimiter({ capacity: 5 });

  const request429 = async () => ({
    status: 429,
    headers: { get: (h) => (h.toLowerCase() === "retry-after" ? "2" : null) },
  });

  await assert.rejects(
    () => limiter.executeRequest("probe-429", request429),
    /TorBox rate limit \(429\)/
  );

  assert.ok(limiter.backoffUntil > Date.now());
  assert.ok(limiter.backoffUntil <= Date.now() + 3000);
});

test("Tier 1 - F14.5 TorBox Resilience: deduplicates concurrent in-flight requests for same key", async () => {
  const limiter = new TorBoxRateLimiter({ capacity: 10 });
  let callCount = 0;

  const slowRequest = async () => {
    callCount++;
    await new Promise((r) => setTimeout(r, 20));
    return { title: "Dune", ready: true };
  };

  const [r1, r2, r3] = await Promise.all([
    limiter.executeRequest("concurrent-key", slowRequest),
    limiter.executeRequest("concurrent-key", slowRequest),
    limiter.executeRequest("concurrent-key", slowRequest),
  ]);

  assert.equal(callCount, 1, "Only 1 upstream request must be made for identical in-flight key");
  assert.equal(r1.data.title, "Dune");
  assert.equal(r2.data.title, "Dune");
  assert.equal(r3.data.title, "Dune");
});
