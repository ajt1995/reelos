import { createPlaybackFixture } from "../playback-fixtures.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleStreamRequest as unauthenticatedStreamRequest,
  getSampleVideoPath,
} from "../../services/neural-stream-server.mjs";
import {
  createMockRequest,
  createMockResponse,
  ensureMediaFixtures,
} from "../harness-utils.mjs";

const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

test("Tier 1 - F1.1 DirectPlay Sample Stream: serves full sample video on GET without Range", async () => {
  const req = createMockRequest({ url: "/api/stream/sample", method: "GET" });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("accept-ranges"), "bytes");
  assert.equal(res.getHeader("content-type"), "video/mp4");
  assert.equal(res.getHeader("x-reelos-directplay"), "true");
  assert.equal(res.getHeader("x-reelos-zerotranscode"), "100%");
  assert.ok(res.body.length > 0);
});

test("Tier 1 - F1.2 DirectPlay Sample Stream: serves 206 Partial Content for valid byte range", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=0-1023" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1024");
  assert.match(res.getHeader("content-range"), /^bytes 0-1023\/\d+$/);
  assert.equal(res.getHeader("x-reelos-directplay"), "true");
  assert.equal(res.body.length, 1024);
});

test("Tier 1 - F1.3 DirectPlay Sample Stream: handles HEAD request with correct headers and zero body", async () => {
  const req = createMockRequest({ url: "/api/stream/sample", method: "HEAD" });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("accept-ranges"), "bytes");
  assert.equal(res.getHeader("content-type"), "video/mp4");
  assert.ok(Number(res.getHeader("content-length")) > 0);
  assert.equal(res.body.length, 0); // HEAD must not send body
});

test("Tier 1 - F1.4 DirectPlay Sample Stream: handles suffix range bytes=-500 returning last 500 bytes", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=-500" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "500");
  assert.match(res.getHeader("content-range"), /^bytes \d+-\d+\/\d+$/);
  assert.equal(res.body.length, 500);
});

test("Tier 1 - F1.5 DirectPlay Sample Stream: returns 416 Range Not Satisfiable when start offset exceeds file size", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=999999999-1000000000" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 416);
  assert.match(res.getHeader("content-range"), /^bytes \*\/\d+$/);
  assert.equal(res.body.length, 0);
});
