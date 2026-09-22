import { test } from "node:test";
import assert from "node:assert/strict";
import { handleStreamRequest as unauthenticatedStreamRequest } from "../../services/neural-stream-server.mjs";
import { createMockRequest, createMockResponse, ensureMediaFixtures, TEST_HASH } from "../harness-utils.mjs";

import { createPlaybackFixture } from "../playback-fixtures.mjs";
const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

test("Tier 2 - F2.1 Hash Boundary: clamps over-requested bounds (bytes=0-999999999) to total size", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "bytes=0-999999999" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.match(res.getHeader("content-range"), /^bytes 0-\d+\/\d+$/);
});

test("Tier 2 - F2.2 Hash Boundary: non-byte range unit (items=0-10) falls through to 200 OK full file", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "items=0-10" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.length > 0);
});

test("Tier 2 - F2.3 Hash Boundary: malformed range header (bytes=100-200-300) falls through to 200 OK", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "bytes=100-200-300" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
});

test("Tier 2 - F2.4 Hash Boundary: start offset exactly at EOF returns 416 Range Not Satisfiable", async () => {
  const headReq = createMockRequest({ url: `/api/stream/${TEST_HASH}`, method: "HEAD" });
  const headRes = createMockResponse();
  await handleStreamRequest(headReq, headRes);
  await headRes.waitForEnd();
  const totalSize = parseInt(headRes.getHeader("content-length"), 10);

  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: `bytes=${totalSize}-${totalSize}` },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 416);
  assert.equal(res.getHeader("content-range"), `bytes */${totalSize}`);
});

test("Tier 2 - F2.5 Hash Boundary: trailing whitespace in range header parses cleanly", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "  bytes=0-511   " },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "512");
  assert.equal(res.body.length, 512);
});
