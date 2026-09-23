import assert from "node:assert/strict";
import test from "node:test";
import { checkCachedTorrents, clearCachedMemory, providerCacheScope } from "./cache-checker.mjs";
import { torBoxRateLimiter } from "../services/debrid-service.mjs";

test("provider cache never shares a hash across credentials or validated accounts", async () => {
  clearCachedMemory();
  torBoxRateLimiter.clearCache();
  const hash = "a".repeat(40);
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const key = options.headers.Authorization.slice("Bearer ".length);
    calls.push(key);
    return { ok: true, json: async () => ({ data: { [hash]: { name: `owned-by-${key}`, size: 42 } } }) };
  };
  const check = (key, accountScope, provider = "torbox") => checkCachedTorrents([hash], key, {
    provider, accountScope, fetchImpl, maxRetries: 1,
  });
  try {
    assert.equal((await check("synthetic-key-A", "account-A"))[hash].name, "owned-by-synthetic-key-A");
    assert.equal((await check("synthetic-key-B", "account-B"))[hash].name, "owned-by-synthetic-key-B");
    assert.equal((await check("synthetic-key-A", "account-C"))[hash].name, "owned-by-synthetic-key-A");
    assert.equal((await check("synthetic-key-A", "account-A"))[hash].name, "owned-by-synthetic-key-A");
    assert.equal(calls.length, 3);
    assert.equal((await check("synthetic-key-A", "account-A", "real-debrid"))[hash].cached, false);
    assert.equal(calls.length, 4);
    assert.equal((await check("", "account-A"))[hash].cached, false);
    assert.equal(calls.length, 4);
    assert.doesNotMatch(providerCacheScope("torbox", "synthetic-key-A", "account-A"), /synthetic-key/);
    assert.notEqual(providerCacheScope("torbox", "synthetic-key-A", "account-A"),
      providerCacheScope("real-debrid", "synthetic-key-A", "account-A"));
    assert.ok([...torBoxRateLimiter.cache.keys()].every((cacheKey) => !cacheKey.includes("synthetic-key")));
  } finally {
    clearCachedMemory();
    torBoxRateLimiter.clearCache();
  }
});
