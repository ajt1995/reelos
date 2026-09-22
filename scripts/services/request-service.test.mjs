import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requestIdFromQuery,
  validateIncomingRequest,
  isGuestPendingRequest,
  processRequestCancellation,
  buildRequestStatusError,
} from "./request-service.mjs";

test("Request Service: extracts requestId from URL query", () => {
  const u1 = new URL("http://reelos.local/api/request?id=tmdb-550");
  assert.equal(requestIdFromQuery(u1), "tmdb-550");

  const u2 = new URL("http://reelos.local/api/request?titleId=tmdb-tv-1399");
  assert.equal(requestIdFromQuery(u2), "tmdb-tv-1399");

  const u3 = new URL("http://reelos.local/api/request");
  assert.equal(requestIdFromQuery(u3), "");
});

test("Request Service: normalizes and validates incoming request payload", () => {
  const parsed1 = validateIncomingRequest({
    tmdb: "157336",
    title: "Interstellar",
    mediaType: "movie",
  });
  assert.equal(parsed1.tmdb, "157336");
  assert.equal(parsed1.titleId, "tmdb-157336");
  assert.equal(parsed1.mediaType, "movie");

  const parsed2 = validateIncomingRequest({
    tmdb: "1399",
    title: "Game of Thrones",
    mediaType: "tv",
    season: 1,
  });
  assert.equal(parsed2.titleId, "tmdb-tv-1399");
  assert.equal(parsed2.season, 1);
  assert.equal(parsed2.mediaType, "tv");
});

test("Request Service: identifies guest requests needing host approval", () => {
  assert.equal(isGuestPendingRequest({ isGuest: true }), true);
  assert.equal(isGuestPendingRequest({ requester: "Guest" }), true);
  assert.equal(isGuestPendingRequest({ isGuest: true, approvedByHost: true }), false);
  assert.equal(isGuestPendingRequest({ isGuest: false }), false);
});

test("Request Service: cancels request cleanly via cancelFn", async () => {
  let calledWith = null;
  const mockCancel = async (opts) => {
    calledWith = opts;
    return { ok: true, cancelled: true };
  };

  const res = await processRequestCancellation({
    body: { titleId: "tmdb-550", id: "req-1" },
    cancelFn: mockCancel,
    seerrKey: "test-key",
    seerrFetch: () => {},
    radarrKey: "radarr-key",
    sonarrKey: "sonarr-key",
    fetchArr: () => {},
  });

  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(calledWith.id, "req-1");
  assert.equal(calledWith.titleId, "tmdb-550");

  const errRes = await processRequestCancellation({
    body: {},
    cancelFn: mockCancel,
  });
  assert.equal(errRes.ok, false);
  assert.equal(errRes.status, 400);
});

test("Request Service: builds structured error shape", () => {
  const err = buildRequestStatusError("Timeout", "seerr");
  assert.deepEqual(err, {
    status: "unknown",
    engine: "seerr",
    error: "Timeout",
  });
});
