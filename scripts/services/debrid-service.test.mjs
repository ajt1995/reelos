import assert from 'node:assert/strict';
import test from 'node:test';
import { TorBoxRateLimiter, buildComposeProfiles, generateDecypharrConfig, parseRetryAfter } from './debrid-service.mjs';

test('buildComposeProfiles builds basic debrid profile', () => {
  const p = buildComposeProfiles({ intent: { movies: true, tv: true }, frontend: 'jellyfin', source: 'torbox' });
  assert.ok(p.includes('indexers'));
  assert.ok(p.includes('movies'));
  assert.ok(p.includes('tv'));
  assert.ok(!p.includes('jellyfin'), 'Jellyfin is dead legacy; ReelOS is the native player');
  assert.ok(p.includes('debrid'));
});

test('TorBoxRateLimiter acquires tokens and refills', async () => {
  const limiter = new TorBoxRateLimiter({ capacity: 2, refillRate: 10 });
  assert.equal(limiter.tokens, 2);
  const acquired1 = await limiter.acquireToken();
  assert.equal(acquired1, true);
  assert.ok(limiter.tokens < 2);
});

test('TorBox status never invents a demo credential', () => {
  const previous = process.env.TORBOX_API_KEY;
  delete process.env.TORBOX_API_KEY;
  try {
    const limiter = new TorBoxRateLimiter();
    const status = limiter.getStatus();
    assert.equal(status.configured, false);
    assert.equal(status.activeTokenMasked, null);
    assert.equal(JSON.stringify(status).includes('demo_secret'), false);
  } finally {
    if (previous === undefined) delete process.env.TORBOX_API_KEY;
    else process.env.TORBOX_API_KEY = previous;
  }
});

test('TorBoxRateLimiter caches results and deduplicates in-flight calls', async () => {
  const limiter = new TorBoxRateLimiter({ capacity: 5, refillRate: 5 });
  let callCount = 0;
  const slowFetcher = async () => {
    callCount += 1;
    await new Promise((r) => setTimeout(r, 50));
    return { list: [1, 2, 3] };
  };

  // Simultaneous calls for identical key share same promise
  const [res1, res2] = await Promise.all([
    limiter.executeRequest('my_list', slowFetcher),
    limiter.executeRequest('my_list', slowFetcher),
  ]);

  assert.equal(callCount, 1);
  assert.deepEqual(res1.data, { list: [1, 2, 3] });
  assert.deepEqual(res2.data, { list: [1, 2, 3] });

  // Subsequent call hits cache
  const res3 = await limiter.executeRequest('my_list', slowFetcher);
  assert.equal(callCount, 1);
  assert.equal(res3.fromCache, true);
});

test('parseRetryAfter parses integer seconds and HTTP-Date strings', () => {
  assert.equal(parseRetryAfter('30'), 30);
  assert.equal(parseRetryAfter('0'), 0);
  assert.equal(parseRetryAfter(null, 15), 15);
  assert.equal(parseRetryAfter('', 10), 10);

  // Future HTTP-Date string
  const futureDate = new Date(Date.now() + 60_000).toUTCString();
  const diffSec = parseRetryAfter(futureDate);
  assert.ok(diffSec >= 58 && diffSec <= 62);
});

test('TorBoxRateLimiter calculates exponential backoff with random jitter', () => {
  const limiter = new TorBoxRateLimiter({ baseBackoffMs: 100, maxBackoffMs: 1000, jitterMs: 20 });
  const b1 = limiter.calculateBackoff(1);
  assert.ok(b1 >= 100 && b1 <= 120, `Backoff 1 (${b1}) out of range [100, 120]`);

  const b2 = limiter.calculateBackoff(2);
  assert.ok(b2 >= 200 && b2 <= 220, `Backoff 2 (${b2}) out of range [200, 220]`);

  const b3 = limiter.calculateBackoff(3);
  assert.ok(b3 >= 400 && b3 <= 420, `Backoff 3 (${b3}) out of range [400, 420]`);

  // Max backoff capping
  const bHuge = limiter.calculateBackoff(10);
  assert.ok(bHuge >= 1000 && bHuge <= 1020, `Backoff capped (${bHuge}) should respect maxBackoff`);

  // Retry-After header override
  const bHeader = limiter.calculateBackoff(1, 5);
  assert.ok(bHeader >= 5000 && bHeader <= 5020, `Backoff with Retry-After (${bHeader}) out of range`);
});

test('TorBoxRateLimiter handles 503 HTML without throwing SyntaxError and retries', async () => {
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 2,
    failureThreshold: 5,
  });

  let attempts = 0;
  const result = await limiter.executeRequest('html_503_test', async () => {
    attempts++;
    if (attempts === 1) {
      return {
        status: 503,
        headers: { get: () => 'text/html' },
        async json() {
          throw new SyntaxError("Unexpected token '<'");
        },
        async text() {
          return '<html>503 Service Unavailable</html>';
        },
      };
    }
    return {
      status: 200,
      async json() {
        return { ok: true, recovered: true };
      },
    };
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result.data, { ok: true, recovered: true });
});

test('TorBoxRateLimiter 3-state circuit breaker trips to OPEN after 3 consecutive failures', async () => {
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 0, // do not retry inside single executeRequest
    failureThreshold: 3,
  });

  assert.equal(limiter.getCircuitState().state, 'CLOSED');

  const failingFetcher = async () => ({
    status: 503,
    async json() {
      return { error: 'down' };
    },
  });

  // Failure 1
  await assert.rejects(async () => {
    await limiter.executeRequest('fail_1', failingFetcher);
  });
  assert.equal(limiter.getCircuitState().state, 'CLOSED');
  assert.equal(limiter.getCircuitState().consecutiveFailures, 1);

  // Failure 2
  await assert.rejects(async () => {
    await limiter.executeRequest('fail_2', failingFetcher);
  });
  assert.equal(limiter.getCircuitState().state, 'CLOSED');
  assert.equal(limiter.getCircuitState().consecutiveFailures, 2);

  // Failure 3: trips breaker to OPEN
  await assert.rejects(async () => {
    await limiter.executeRequest('fail_3', failingFetcher);
  });
  assert.equal(limiter.getCircuitState().state, 'OPEN');

  // Request 4: fails fast immediately without running fetcher
  let fetcherRan = false;
  await assert.rejects(async () => {
    await limiter.executeRequest('fail_4', async () => {
      fetcherRan = true;
      return { ok: true };
    });
  }, /circuit breaker is OPEN/);
  assert.equal(fetcherRan, false, 'Should fail fast without calling upstream');
});

test('TorBoxRateLimiter circuit breaker probes in HALF_OPEN and resets on success', async () => {
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 0,
    failureThreshold: 1,
    resetTimeoutMs: 30, // short timeout for test
  });

  // Trip to OPEN
  await assert.rejects(async () => {
    await limiter.executeRequest('trip', async () => ({ status: 503 }));
  });
  assert.equal(limiter.getCircuitState().state, 'OPEN');

  // Wait for resetTimeout to expire
  await new Promise((r) => setTimeout(r, 40));

  // Next call probes in HALF_OPEN and succeeds
  const probeResult = await limiter.executeRequest('probe', async () => ({
    status: 200,
    async json() {
      return { ok: true, probed: true };
    },
  }));

  assert.deepEqual(probeResult.data, { ok: true, probed: true });
  assert.equal(limiter.getCircuitState().state, 'CLOSED');
  assert.equal(limiter.getCircuitState().consecutiveFailures, 0);
});

test('TorBoxRateLimiter automatically retries transient 429 up to maxRetries', async () => {
  const limiter = new TorBoxRateLimiter({
    baseBackoffMs: 5,
    jitterMs: 0,
    maxRetries: 3,
    failureThreshold: 10,
  });

  let calls = 0;
  const result = await limiter.executeRequest('retry_429_test', async () => {
    calls++;
    if (calls <= 2) {
      return {
        status: 429,
        headers: { get: () => '0' },
        async json() {
          return { error: 'Rate limit' };
        },
      };
    }
    return {
      status: 200,
      async json() {
        return { ok: true, ready: true };
      },
    };
  });

  assert.equal(calls, 3);
  assert.deepEqual(result.data, { ok: true, ready: true });
});
