import { test } from "node:test";
import { createPlaybackFixture } from "../playback-fixtures.mjs";
import assert from "node:assert/strict";
import { createJellyfinShimHandler } from "../../services/jellyfin-shim-service.mjs";
import { createMockRequest, createMockResponse, ensureMediaFixtures } from "../harness-utils.mjs";

const verifiedMediaPath = ensureMediaFixtures().sampleSource;
const playbackFixture = createPlaybackFixture();
const fixtureTitles = ["boundary-test", "tmdb-tv-1234_season-1"].map((id) => ({
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

test("Tier 2 - F6.1 Jellyfin Shim Boundary: handles single-byte range bytes=0-0 without error", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/boundary-test/stream",
    method: "GET",
    headers: { range: "bytes=0-0" },
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1");
  assert.equal(res.body.length, 1);
});

test("Tier 2 - F6.2 Jellyfin Shim Boundary: handles open-ended range bytes=1000- without crash", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/boundary-test/stream",
    method: "GET",
    headers: { range: "bytes=1000-" },
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.ok(Number(res.getHeader("content-length")) > 0);
});

test("Tier 2 - F6.3 Jellyfin Shim Boundary: handles item IDs containing special dashes, underscores", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/tmdb-tv-1234_season-1/stream",
    method: "GET",
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
});

test("Tier 2 - F6.4 Jellyfin Shim Boundary: directory traversal attempts (/Videos/../../etc/passwd/stream) handled safely", async () => {
  const handler = createVerifiedHandler();
  const req = createMockRequest({
    url: "/Videos/../../etc/passwd/stream",
    method: "GET",
  });
  const res = createMockResponse();

  const handled = await handler(req, res);
  // Must either reject or fail cleanly without exposing arbitrary files
  assert.ok(handled === false || res.statusCode >= 400 || res.body.length === 1048576);
});

test("Tier 2 - F6.5 Jellyfin Shim Boundary: rapid sequential stream requests maintain consistent headers", async () => {
  const handler = createVerifiedHandler();
  for (let i = 0; i < 10; i++) {
    const req = createMockRequest({
      url: "/Videos/boundary-test/stream",
      method: "GET",
      headers: { range: "bytes=0-511" },
    });
    const res = createMockResponse();
    const handled = await handler(req, res);
    assert.equal(handled, true);
    await res.waitForEnd();
    assert.equal(res.statusCode, 206);
    assert.equal(res.getHeader("accept-ranges"), "bytes");
    assert.equal(res.getHeader("content-length"), "512");
  }
});
