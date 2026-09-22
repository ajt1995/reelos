import { createPlaybackFixture } from "../playback-fixtures.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleStreamRequest as unauthenticatedStreamRequest } from "../../services/neural-stream-server.mjs";
import {
  createMockRequest,
  createMockResponse,
  ensureMediaFixtures,
  TEST_HASH,
} from "../harness-utils.mjs";

const mediaFixture = ensureMediaFixtures();
const playbackFixture = createPlaybackFixture({ items: [{ id: "range-fixture", infohash: mediaFixture.testHash, path: mediaFixture.hashFile, sourceKind: "personal_import" }] });
const handleStreamRequest = (req, res) => unauthenticatedStreamRequest(playbackFixture.authorize(req), res, playbackFixture.options);

test("Tier 1 - F2.1 Hash DirectPlay: streams full file for known cached hex hash without Range", async () => {
  const req = createMockRequest({ url: `/api/stream/${TEST_HASH}`, method: "GET" });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("accept-ranges"), "bytes");
  assert.equal(res.getHeader("x-reelos-directplay"), "true");
  assert.equal(res.getHeader("x-reelos-zerotranscode"), "100%");
  assert.ok(res.body.length > 0);
});

test("Tier 1 - F2.2 Hash DirectPlay: streams 206 Partial Content for byte-range slice", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "bytes=100-2047" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "1948");
  assert.match(res.getHeader("content-range"), /^bytes 100-2047\/\d+$/);
  assert.equal(res.getHeader("x-reelos-directplay"), "true");
  assert.equal(res.body.length, 1948);
});

test("Tier 1 - F2.3 Hash DirectPlay: handles suffix range bytes=-2048", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "bytes=-2048" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 206);
  assert.equal(res.getHeader("content-length"), "2048");
  assert.match(res.getHeader("content-range"), /^bytes \d+-\d+\/\d+$/);
  assert.equal(res.body.length, 2048);
});

test("Tier 1 - F2.4 Hash DirectPlay: returns 404 for unknown hash not present in local cache or debrid", async () => {
  const unknownHash = "0000000000000000000000000000000000000000";
  const req = createMockRequest({ url: `/api/stream/${unknownHash}`, method: "GET" });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 404);
  assert.equal(res.getHeader("content-type"), "application/json");
  assert.equal(res.json.ok, false);
});

test("Tier 1 - F2.5 Hash DirectPlay: rejects out-of-bounds start offset with 416 Range Not Satisfiable", async () => {
  const req = createMockRequest({
    url: `/api/stream/${TEST_HASH}`,
    method: "GET",
    headers: { range: "bytes=999999999-" },
  });
  const res = createMockResponse();

  const handled = await handleStreamRequest(req, res);
  assert.equal(handled, true);
  await res.waitForEnd();
  assert.equal(res.statusCode, 416);
  assert.match(res.getHeader("content-range"), /^bytes \*\/\d+$/);
});
