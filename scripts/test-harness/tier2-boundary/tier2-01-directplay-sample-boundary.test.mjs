import { test } from "node:test";
import assert from "node:assert/strict";
import { handleStreamRequest as unauthenticatedStreamRequest } from "../../services/neural-stream-server.mjs";
import { createMockRequest, createMockResponse, ensureMediaFixtures } from "../harness-utils.mjs";

import { createPlaybackFixture } from "../playback-fixtures.mjs";
const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

test("Tier 2 - F1.1 DirectPlay Boundary: suffix range bytes=-999999 exceeding file serves full file with 206", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=-99999999" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.match(res.getHeader("content-range"), /^bytes 0-\d+\/\d+$/);
});

test("Tier 2 - F1.2 DirectPlay Boundary: inverted range bytes=500-200 returns 416 Range Not Satisfiable", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=500-200" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 416);
  assert.match(res.getHeader("content-range"), /^bytes \*\/\d+$/);
});

test("Tier 2 - F1.3 DirectPlay Boundary: NaN range bytes=NaN-NaN falls through to 200 OK full representation", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=NaN-NaN" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  // RFC 7233 §3.1: invalid range syntax MUST be ignored and return 200
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.length > 0);
});

test("Tier 2 - F1.4 DirectPlay Boundary: single-byte boundary range bytes=0-0 serves exact first byte", async () => {
  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: "bytes=0-0" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1");
  assert.match(res.getHeader("content-range"), /^bytes 0-0\/\d+$/);
  assert.equal(res.body.length, 1);
});

test("Tier 2 - F1.5 DirectPlay Boundary: single-byte boundary range at exact EOF serves last byte", async () => {
  // First discover total size via HEAD
  const headReq = createMockRequest({ url: "/api/stream/sample", method: "HEAD" });
  const headRes = createMockResponse();
  await handleStreamRequest(headReq, headRes);
  await headRes.waitForEnd();
  const totalSize = parseInt(headRes.getHeader("content-length"), 10);

  const req = createMockRequest({
    url: "/api/stream/sample",
    method: "GET",
    headers: { range: `bytes=${totalSize - 1}-${totalSize - 1}` },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1");
  assert.equal(res.getHeader("content-range"), `bytes ${totalSize - 1}-${totalSize - 1}/${totalSize}`);
  assert.equal(res.body.length, 1);
});
