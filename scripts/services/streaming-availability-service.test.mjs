import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequest, createMockResponse } from "../test-harness/harness-utils.mjs";
import {
  StreamingAvailabilityService,
  handleStreamingAvailabilityRoute,
  normalizeAvailabilityPayload,
} from "./streaming-availability-service.mjs";

const context = { mediaType: "movie", externalId: "550", region: "US", fetchedAt: "2026-09-21T00:00:00.000Z" };

test("availability normalization maps provider groups and accepts only official TMDB destinations", () => {
  const normalized = normalizeAvailabilityPayload({
    results: {
      US: {
        link: "https://www.themoviedb.org/movie/550/watch?locale=US",
        flatrate: [
          { provider_id: 8, provider_name: "Second", logo_path: "/second.png", display_priority: 2 },
          { provider_id: 9, provider_name: "First", logo_path: "/first.png", display_priority: 1 },
          { provider_id: 9, provider_name: "Duplicate", logo_path: "/duplicate.png", display_priority: 3 },
        ],
        free: [{ provider_id: 73, provider_name: "Library", logo_path: null, display_priority: 0 }],
        ads: [{ provider_id: 300, provider_name: "With ads", logo_path: "/ads.jpg", display_priority: 4 }],
        rent: [{ provider_id: 2, provider_name: "Rent", logo_path: "/rent.jpg", display_priority: 1 }],
        buy: [{ provider_id: 3, provider_name: "Buy", logo_path: "/buy.jpg", display_priority: 1 }],
      },
    },
  }, context);
  assert.equal(normalized.available, true);
  assert.deepEqual(normalized.groups.subscription.map((provider) => provider.name), ["First", "Second"]);
  assert.equal(normalized.groups.free[0].logoUrl, null);
  assert.equal(normalized.groups.ads[0].logoUrl, "https://image.tmdb.org/t/p/w92/ads.jpg");
  assert.equal(normalized.link, "https://www.themoviedb.org/movie/550/watch?locale=US");
  assert.equal(normalized.attribution.text, "Availability data by JustWatch.");

  const unsafe = normalizeAvailabilityPayload({ results: { US: {
    link: "https://example.test/fabricated-deep-link",
    flatrate: [{ provider_id: 8, provider_name: "Service", display_priority: 1 }],
  } } }, context);
  assert.equal(unsafe.link, null);
});

test("availability service is honest when unconfigured, unsupported, unavailable, and timed out", async () => {
  const unconfigured = new StreamingAvailabilityService({ apiKey: "", fetchImpl: () => { throw new Error("must not fetch"); } });
  assert.equal((await unconfigured.get(context)).reason, "not_configured");

  const unsupported = new StreamingAvailabilityService({ apiKey: "server-secret", fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal((await unsupported.get(context)).reason, "unsupported_title");

  const absent = new StreamingAvailabilityService({ apiKey: "server-secret", fetchImpl: async () => ({
    ok: true, status: 200, json: async () => ({ results: { GB: {} } }),
  }) });
  assert.equal((await absent.get(context)).reason, "no_regional_availability");

  const timedOut = new StreamingAvailabilityService({
    apiKey: "server-secret",
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    }),
  });
  assert.equal((await timedOut.get(context)).reason, "upstream_timeout");
});

test("availability service caches normalized results without exposing its server credential", async () => {
  let calls = 0;
  let requestedUrl = "";
  const service = new StreamingAvailabilityService({
    apiKey: "server-secret",
    now: () => Date.parse("2026-09-21T00:00:00.000Z"),
    fetchImpl: async (url) => {
      calls += 1;
      requestedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: { US: {
          link: "https://www.themoviedb.org/movie/550/watch?locale=US",
          flatrate: [{ provider_id: 8, provider_name: "Service", display_priority: 1 }],
        } } }),
      };
    },
  });
  const first = await service.get(context);
  const second = await service.get(context);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.match(requestedUrl, /api_key=server-secret/);
  assert.equal(JSON.stringify(first).includes("server-secret"), false);
});

async function route(url, { method = "GET", service } = {}) {
  const req = createMockRequest({ url, method });
  const res = createMockResponse();
  await handleStreamingAvailabilityRoute(req, res, { service });
  await res.waitForEnd();
  return res;
}

test("availability route validates its media identity and region", async () => {
  assert.equal((await route("/api/availability?mediaType=book&externalId=550&region=US")).statusCode, 400);
  assert.equal((await route("/api/availability?mediaType=movie&externalId=tmdb-550&region=US")).statusCode, 400);
  assert.equal((await route("/api/availability?mediaType=movie&externalId=550&region=USA")).statusCode, 400);
  assert.equal((await route("/api/availability?mediaType=movie&externalId=550&region=US", { method: "POST" })).statusCode, 405);
});

test("availability route normalizes lowercase regions and returns quiet unavailable state", async () => {
  let received;
  const service = { get: async (input) => {
    received = input;
    return { ...normalizeAvailabilityPayload({ results: {} }, { ...input, fetchedAt: context.fetchedAt }) };
  } };
  const res = await route("/api/availability?mediaType=tv&externalId=1399&region=us", { service });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(received, { mediaType: "tv", externalId: "1399", region: "US" });
  assert.equal(res.json.reason, "no_regional_availability");
  assert.equal(res.json.attribution.provider, "JustWatch");
});
