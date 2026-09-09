import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyTitleRequestPoll,
  collapseDuplicateRequests,
  isInFlightRequest,
  mergeServerRequests,
  overlayLibraryPresence,
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

test("duplicate Seerr season rows collapse to the furthest-along request", () => {
  const local = [
    row({ id: "seerr-3", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 1 }),
  ];
  const server = [
    row({ id: "seerr-3", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 1 }),
    row({ id: "seerr-4", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 1 }),
  ];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "seerr-3");
  assert.equal(merged[0]?.season, 1);
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

test("library movie hit is AVAILABLE, not downloading/grabbing", () => {
  const requests = [row({ id: "seerr-2", titleId: "tmdb-1593", status: "downloading", progress: 0 })];
  const honest = overlayLibraryPresence(requests, {
    libraryIds: ["tmdb-1593"],
    titles: [{ id: "tmdb-1593", kind: "movie" }],
  });
  assert.equal(honest.length, 1);
  assert.equal(honest[0]?.status, "available");
  assert.equal(honest[0]?.progress, 100);
});

test("TV library series does not mark a grabbing season available on the client", () => {
  const requests = [
    row({ id: "seerr-5", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 1 }),
  ];
  const honest = overlayLibraryPresence(requests, {
    libraryIds: ["tmdb-tv-1402"],
    titles: [{ id: "tmdb-tv-1402", kind: "tv" }],
  });
  assert.equal(honest[0]?.status, "downloading");
  assert.equal(honest[0]?.progress, 0);
});

test("title-page poll does not paint another season available", () => {
  const requests = [
    row({ id: "seerr-3", titleId: "tmdb-tv-1402", status: "available", progress: 100, season: 1 }),
    row({ id: "seerr-4", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 2 }),
  ];
  const next = applyTitleRequestPoll(requests, {
    titleId: "tmdb-tv-1402",
    season: 1,
    status: "downloaded",
    progress: 100,
  });
  assert.equal(next.find((r) => r.season === 1)?.status, "available");
  assert.equal(next.find((r) => r.season === 2)?.status, "downloading");
  assert.equal(next.find((r) => r.season === 2)?.progress, 0);
});

test("title-page poll keeps the honest reason from GET-by-id", () => {
  const requests = [row({ id: "seerr-9", titleId: "tmdb-2059", status: "downloading", progress: 0 })];
  const next = applyTitleRequestPoll(requests, {
    titleId: "tmdb-2059",
    status: "grabbing",
    progress: 0,
    reason: "No grab client — search cannot land",
  });
  assert.equal(next[0]?.reason, "No grab client — search cannot land");
});

test("title-page movie poll does not touch TV season rows", () => {
  const requests = [
    row({ id: "seerr-2", titleId: "tmdb-1593", status: "downloading", progress: 0 }),
    row({ id: "seerr-5", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 1 }),
  ];
  const next = applyTitleRequestPoll(requests, {
    titleId: "tmdb-1593",
    status: "downloaded",
    progress: 100,
  });
  assert.equal(next.find((r) => r.titleId === "tmdb-1593")?.status, "available");
  assert.equal(next.find((r) => r.titleId === "tmdb-tv-1402")?.status, "downloading");
});

test("default requestTitle never invents a 42 percent", () => {
  const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /progress: fail \? 0 : cached \? 42 : 0/);
  assert.match(store, /status: fail \? "failed" : "waiting"/);
  assert.match(store, /progress: 0,/);
  assert.match(store, /method: "POST"/);
  assert.match(store, /titleId.startsWith\("tmdb-"\)/);
});

test("duplicate active rows for the same title+season collapse when one is available", () => {
  const rows = [
    row({
      id: "seerr-2",
      titleId: "tmdb-tv-1402",
      status: "available",
      progress: 100,
      season: 1,
      createdAt: 1,
      updatedAt: 1,
    }),
    row({
      id: "seerr-5",
      titleId: "tmdb-tv-1402",
      status: "downloading",
      progress: 0,
      season: 1,
      createdAt: 2,
      updatedAt: 2,
    }),
  ];
  const collapsed = collapseDuplicateRequests(rows);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0]?.status, "available");
  assert.equal(collapsed[0]?.progress, 100);
});
