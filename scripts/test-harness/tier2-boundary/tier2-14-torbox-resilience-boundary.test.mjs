import { test } from "node:test";
import assert from "node:assert/strict";
import { TorBoxRateLimiter, parseRetryAfter } from "../../services/debrid-service.mjs";

test("Tier 2 - F14.1 TorBox Boundary: Retry-After = '0' does not crash and yields 0 backoff", () => {
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(" 0 "), 0);
});

test("Tier 2 - F14.2 TorBox Boundary: astronomical Retry-After (999999) parsed safely", () => {
  assert.equal(parseRetryAfter("999999"), 999999);
});

test("Tier 2 - F14.3 TorBox Boundary: corrupted non-date string falls back to default seconds", () => {
  assert.equal(parseRetryAfter("invalid-date-xyz", 20), 20);
  assert.equal(parseRetryAfter("NaN", 15), 15);
  assert.equal(parseRetryAfter("{}", 10), 10);
});

test("Tier 2 - F14.4 TorBox Boundary: clearCache empties cache completely", () => {
  const limiter = new TorBoxRateLimiter();
  limiter.setCached("key1", { data: "test1" });
  limiter.setCached("key2", { data: "test2" });

  assert.ok(limiter.getCached("key1"));
  limiter.clearCache();
  assert.equal(limiter.getCached("key1"), null);
  assert.equal(limiter.getCached("key2"), null);
});

test("Tier 2 - F14.5 TorBox Boundary: cache entry expires after custom ttlMs", async () => {
  const limiter = new TorBoxRateLimiter();
  limiter.setCached("expiring-key", { value: 123 }, 25); // 25ms TTL

  assert.ok(limiter.getCached("expiring-key"));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(limiter.getCached("expiring-key"), null);
});
