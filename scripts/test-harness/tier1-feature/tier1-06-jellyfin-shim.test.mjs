import { test } from "node:test";
import { createPlaybackFixture } from "../playback-fixtures.mjs";
import assert from "node:assert/strict";
import { createJellyfinShimHandler } from "../../services/jellyfin-shim-service.mjs";
import { createMockRequest, createMockResponse, ensureMediaFixtures } from "../harness-utils.mjs";

const verifiedMediaPath = ensureMediaFixtures().sampleSource;
const playbackFixture = createPlaybackFixture();
const fixtureTitles = ["sample-123", "item-456", "item-789"].map((id) => ({
  id: `jf-${id}`,
  jellyfinId: id,
  title: `Verified fixture ${id}`,
  path: verifiedMediaPath,
}));
const createVerifiedHandler = () => {
  const handler = createJellyfinShimHandler({
  ...playbackFixture.options,
  fallbackTitles: fixtureTitles,
  verifiedMediaById: Object.fromEntries(fixtureTitles.map((title) => [title.jellyfinId, verifiedMediaPath])),
  });
  return (req, res) => handler(playbackFixture.authorize(req), res);
};

test("Tier 1 - F6.1 Jellyfin Shim: streams video on /Videos/:id/stream without Range", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({ url: "/Videos/sample-123/stream", method: "GET" });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("accept-ranges"), "bytes");
  assert.equal(res.getHeader("content-type"), "video/mp4");
  assert.ok(Number(res.getHeader("content-length")) > 0);
  assert.ok(res.body.length > 0);
});

test("Tier 1 - F6.2 Jellyfin Shim: streams 206 Partial Content for byte-range slice", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/sample-123/stream",
    method: "GET",
    headers: { range: "bytes=0-1023" },
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1024");
  assert.match(res.getHeader("content-range"), /^bytes 0-1023\/\d+$/);
  assert.equal(res.body.length, 1024);
});

test("Tier 1 - F6.3 Jellyfin Shim: handles /Videos/:id/stream.mp4 extension alias", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/item-456/stream.mp4",
    method: "GET",
    headers: { range: "bytes=100-500" },
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "401");
  assert.match(res.getHeader("content-range"), /^bytes 100-500\/\d+$/);
  assert.equal(res.body.length, 401);
});

test("Tier 1 - F6.4 Jellyfin Shim: protects authenticated bytes from public caching and updates playback activity", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({ url: "/Videos/item-789/stream", method: "GET" });
  const res = createMockResponse();

  const beforeTime = Date.now();
  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.getHeader("cache-control"), "private, no-store");
  assert.ok(globalThis.__reelosLastPlaybackAt >= beforeTime);
});

test("Tier 1 - F6.5 Jellyfin Shim: returns false for unhandled non-shim routes", async () => {
  const handler = createJellyfinShimHandler();
  const req = createMockRequest({ url: "/Random/NonExistent/Route", method: "GET" });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, false);
});
