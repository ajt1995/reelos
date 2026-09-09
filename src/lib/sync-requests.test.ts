import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isInFlightRequest,
  mergeServerRequests,
  requestStatusWord,
  showRequestQueueControls,
} from "./sync-requests.ts";
import type { MediaRequest } from "./types.ts";

function row(partial: Partial<MediaRequest> & Pick<MediaRequest, "id" | "titleId" | "status">): MediaRequest {
  return {
    progress: partial.status === "available" ? 100 : 0,
    createdAt: 1,
    updatedAt: 1,
    requester: "Ada",
    ...partial,
  };
}

test("available movie hides Request even if a stale downloading row exists", () => {
  assert.equal(
    showRequestQueueControls({ kind: "movie", available: true, requestStatus: "available" }),
    false,
  );
  assert.equal(
    showRequestQueueControls({ kind: "movie", available: true, requestStatus: "downloading" }),
    false,
  );
  assert.equal(
    showRequestQueueControls({ kind: "movie", available: false, requestStatus: undefined }),
    true,
  );
});

test("TV/anime still offer Request when this season is not available", () => {
  assert.equal(
    showRequestQueueControls({ kind: "tv", available: true, requestStatus: "available" }),
    false,
  );
  assert.equal(
    showRequestQueueControls({ kind: "tv", available: true, requestStatus: undefined }),
    true,
  );
  assert.equal(
    showRequestQueueControls({ kind: "anime", available: true, requestStatus: "waiting" }),
    true,
  );
});

test("transferring chip never counts available", () => {
  assert.equal(isInFlightRequest({ status: "downloading" }), true);
  assert.equal(isInFlightRequest({ status: "waiting" }), true);
  assert.equal(isInFlightRequest({ status: "available" }), false);
  assert.equal(isInFlightRequest({ status: "failed" }), false);
});

test("request status words are Grabbing / Waiting / Ready — never a percent", () => {
  assert.equal(requestStatusWord("downloading"), "Grabbing");
  assert.equal(requestStatusWord("waiting"), "Waiting");
  assert.equal(requestStatusWord("available"), "Ready");
  assert.equal(requestStatusWord("failed"), "Failed");
});

test("server available upgrades a stale local downloading row for the same titleId", () => {
  const local = [
    row({ id: "req-abc", titleId: "tmdb-324857", status: "downloading", progress: 0 }),
  ];
  const server = [
    row({ id: "seerr-12", titleId: "tmdb-324857", status: "available", progress: 100 }),
  ];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "seerr-12");
  assert.equal(merged[0]?.status, "available");
  assert.equal(merged[0]?.progress, 100);
});

test("empty server list keeps local rows (Seerr down)", () => {
  const local = [row({ id: "req-abc", titleId: "tmdb-1", status: "downloading", progress: 0 })];
  assert.deepEqual(mergeServerRequests(local, []), local);
});

test("TV season available does not upgrade a different season still downloading", () => {
  const local = [
    row({ id: "req-s2", titleId: "tmdb-tv-80566", status: "downloading", progress: 0, season: 2 }),
  ];
  const server = [
    row({ id: "seerr-1", titleId: "tmdb-tv-80566", status: "available", progress: 100, season: 1 }),
  ];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged.length, 2);
  const s2 = merged.find((r) => r.season === 2);
  const s1 = merged.find((r) => r.season === 1);
  assert.equal(s2?.status, "downloading");
  assert.equal(s1?.status, "available");
  assert.equal(s1?.progress, 100);
});

test("honest local progress is kept when server still says downloading at 0", () => {
  const local = [row({ id: "req-a", titleId: "tmdb-9", status: "downloading", progress: 37 })];
  const server = [row({ id: "seerr-9", titleId: "tmdb-9", status: "downloading", progress: 0 })];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged[0]?.id, "seerr-9");
  assert.equal(merged[0]?.status, "downloading");
  assert.equal(merged[0]?.progress, 37);
});

test("duplicate local rows for the same seerr title collapse to one", () => {
  const local = [
    row({ id: "req-old", titleId: "tmdb-10", status: "downloading", progress: 0 }),
    row({ id: "seerr-3", titleId: "tmdb-10", status: "downloading", progress: 0 }),
  ];
  const server = [row({ id: "seerr-3", titleId: "tmdb-10", status: "available", progress: 100 })];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.status, "available");
  assert.equal(merged[0]?.progress, 100);
});
