import test from "node:test";
import assert from "node:assert/strict";
import { loadStreamingAvailability } from "../experience/streaming-availability.ts";

test("streaming availability client sends only title identity and region", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({
      ok: true,
      available: false,
      mediaType: "movie",
      externalId: "550",
      region: "US",
      groups: { subscription: [], free: [], ads: [], rent: [], buy: [] },
      link: null,
      attribution: { provider: "JustWatch", text: "Availability data by JustWatch.", url: "https://www.justwatch.com/" },
      fetchedAt: "2026-09-21T00:00:00.000Z",
      reason: "not_configured",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await loadStreamingAvailability({ mediaType: "movie", externalId: 550, region: "us" });
    assert.equal(result.reason, "not_configured");
    assert.match(requestUrl, /^\/api\/availability\?/);
    assert.match(requestUrl, /mediaType=movie/);
    assert.match(requestUrl, /externalId=550/);
    assert.match(requestUrl, /region=US/);
    assert.equal(requestUrl.includes("api_key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streaming availability client returns an honest fallback on request failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const result = await loadStreamingAvailability({ mediaType: "tv", externalId: "1399", region: "GB" });
    assert.equal(result.available, false);
    assert.equal(result.reason, "request_failed");
    assert.equal(result.attribution.provider, "JustWatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
