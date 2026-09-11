import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyTitleRequestPoll,
  collapseDuplicateRequests,
  collapseHomeRequestCards,
  dropLibraryOverlay,
  inFlightRequests,
  isGhostRequestLabel,
  isInFlightRequest,
  mergeServerRequests,
  overlayLibraryPresence,
  requestShowsRetry,
  showRequestQueueControls,
  titleForRequest,
  titleMatchesId,
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
  assert.equal(isInFlightRequest({ status: "downloading", engine: "downloaded" }), false);
});

test("Home Your requests hides shelf hits; keeps searching/grabbing/linked waiting", () => {
  const requests = [
    row({ id: "museum", titleId: "tmdb-1593", status: "downloading", via: "cache" }),
    row({ id: "wick", titleId: "tmdb-245891", status: "available" }),
    row({ id: "coyote", titleId: "tmdb-1012201", status: "available" }),
    row({ id: "searching", titleId: "tmdb-99", status: "waiting" }),
    row({ id: "grabbing", titleId: "tmdb-100", status: "downloading" }),
    row({ id: "linked", titleId: "tmdb-tv-1402", status: "waiting", season: 2, reason: "Linked — waiting to import" }),
    row({ id: "engine-done", titleId: "tmdb-101", status: "downloading", engine: "downloaded" }),
  ];
  const inflight = inFlightRequests(requests, {
    libraryIds: ["tmdb-1593", "tmdb-245891", "tmdb-1012201"],
    titles: [
      { id: "tmdb-1593", kind: "movie" },
      { id: "tmdb-245891", kind: "movie" },
      { id: "tmdb-1012201", kind: "movie" },
    ],
  });
  assert.deepEqual(
    inflight.map((r) => r.id),
    ["searching", "grabbing", "linked"],
  );
});

test("TV grabbing season stays on Home even if the series is on the shelf", () => {
  const requests = [
    row({ id: "s2", titleId: "tmdb-tv-1402", status: "downloading", progress: 0, season: 2 }),
  ];
  const inflight = inFlightRequests(requests, {
    libraryIds: ["tmdb-tv-1402"],
    titles: [{ id: "tmdb-tv-1402", kind: "tv" }],
  });
  assert.equal(inflight.length, 1);
  assert.equal(inflight[0]?.status, "downloading");
});

test("25 mostly-available rows are not 25 transferring", () => {
  const requests = [
    ...Array.from({ length: 22 }, (_, i) =>
      row({ id: `avail-${i}`, titleId: `tmdb-${i + 1}`, status: i % 2 ? "available" : "downloading" }),
    ),
    row({ id: "wait", titleId: "tmdb-900", status: "waiting" }),
    row({ id: "grab", titleId: "tmdb-901", status: "downloading" }),
    row({ id: "fail", titleId: "tmdb-902", status: "failed" }),
  ];
  const libraryIds = requests.filter((r) => r.titleId !== "tmdb-900" && r.titleId !== "tmdb-901" && r.titleId !== "tmdb-902").map((r) => r.titleId);
  const inflight = inFlightRequests(requests, { libraryIds, titles: libraryIds.map((id) => ({ id, kind: "movie" as const })) });
  assert.equal(inflight.length, 2);
  assert.deepEqual(inflight.map((r) => r.id), ["wait", "grab"]);
});

test("Home and Requests both overlay then keep in-flight only", () => {
  const home = readFileSync(new URL("../components/home-view.tsx", import.meta.url), "utf8");
  const reqs = readFileSync(new URL("../components/requests-view.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
  assert.match(home, /inFlightRequests\(requests, \{ titles: catalog \}\)/);
  assert.match(home, /titleForRequest\(r, catalog\)/);
  assert.match(home, /collapseHomeRequestCards\(inflight\)/);
  assert.match(home, /transferring = inflight\.length/);
  assert.doesNotMatch(home, /Watch in this browser/);
  assert.doesNotMatch(home, /requests\.filter\(isInFlightRequest\)/);
  assert.match(shell, /inFlightRequests\(s\.requests, \{ titles: s\.shelf \}\)/);
  assert.doesNotMatch(shell, /aria-label="Search"/);
  assert.match(reqs, /inFlightRequests\(requests, \{ titles: catalog \}\)/);
  assert.match(reqs, /inflight\.filter\(\(r\) => \(filter === "all" \? true : r\.status === filter\)\)/);
  assert.doesNotMatch(reqs, /id: "available"/);
  assert.doesNotMatch(reqs, /id: "failed"/);
  assert.doesNotMatch(reqs, /to="\/play\/\$id"/);
  assert.doesNotMatch(reqs, />\s*Play\s*</);
  assert.match(reqs, />\s*Cancel\s*</);
});

test("Requests page drops Available now / Play movies; keeps searching Rick and Morty", () => {
  const requests = [
    row({
      id: "rm-s3",
      titleId: "tmdb-tv-60625",
      title: "Rick and Morty",
      status: "waiting",
      season: 3,
      reason: "Searching — no file yet",
    }),
    row({
      id: "rm-s4",
      titleId: "tmdb-tv-60625",
      title: "Rick and Morty",
      status: "waiting",
      season: 4,
      reason: "Searching — no file yet",
    }),
    row({ id: "coyote", titleId: "tmdb-1012201", title: "Coyote vs. Acme", status: "available" }),
    row({ id: "odyssey", titleId: "tmdb-1241982", title: "The Odyssey", status: "available" }),
    row({ id: "toy", titleId: "tmdb-1019412", title: "Toy Story 5", status: "available" }),
    row({ id: "spiderman", titleId: "tmdb-1064028", title: "Spider-Man: Brand New Day", status: "available" }),
    row({ id: "coyote-stale", titleId: "tmdb-1012201", title: "Coyote vs. Acme", status: "downloading" }),
  ];
  const inflight = inFlightRequests(requests, {
    libraryIds: ["tmdb-1012201", "tmdb-1241982", "tmdb-1019412", "tmdb-1064028"],
    titles: [
      { id: "tmdb-1012201", kind: "movie" },
      { id: "tmdb-1241982", kind: "movie" },
      { id: "tmdb-1019412", kind: "movie" },
      { id: "tmdb-1064028", kind: "movie" },
    ],
  });
  assert.deepEqual(
    inflight.map((r) => r.id),
    ["rm-s3", "rm-s4"],
  );
  assert.equal(
    inflight.every((r) => r.status === "waiting" && r.title === "Rick and Morty"),
    true,
  );
});

test("dropLibraryOverlay removes a movie and every TV season row", () => {
  const movie = dropLibraryOverlay(
    {
      shelf: [
        { id: "tmdb-1593", kind: "movie", ids: ["tmdb-1593"], jellyfinId: "a", title: "Museum", year: 2006, rating: 0, genres: [], overview: "", poster: "", maxQuality: "4k", popularity: 0 },
        { id: "tmdb-550", kind: "movie", ids: ["tmdb-550"], title: "Fight Club", year: 1999, rating: 0, genres: [], overview: "", poster: "", maxQuality: "4k", popularity: 0 },
      ],
      library: ["tmdb-1593", "tmdb-550"],
      requests: [
        row({ id: "seerr-1", titleId: "tmdb-1593", status: "available" }),
        row({ id: "seerr-2", titleId: "tmdb-550", status: "downloading" }),
      ],
    },
    "tmdb-1593",
  );
  assert.deepEqual(movie.shelf.map((t) => t.id), ["tmdb-550"]);
  assert.deepEqual(movie.library, ["tmdb-550"]);
  assert.deepEqual(movie.requests.map((r) => r.id), ["seerr-2"]);
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

test("engine downloaded overlays to available even without a library id yet", () => {
  const requests = [row({ id: "seerr-9", titleId: "tmdb-603", status: "downloading", engine: "downloaded", progress: 0 })];
  const honest = overlayLibraryPresence(requests, { libraryIds: [], titles: [] });
  assert.equal(honest[0]?.status, "available");
  assert.equal(honest[0]?.progress, 100);
  assert.equal(isInFlightRequest(honest[0]!), false);
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

test("Retry stays on locks that will never search", () => {
  assert.equal(requestShowsRetry({ status: "failed" }), true);
  assert.equal(
    requestShowsRetry({ status: "waiting", reason: "Season unmonitored in Sonarr — search will not run" }),
    true,
  );
  assert.equal(
    requestShowsRetry({ status: "downloading", reason: "Requested — Radarr has no movie yet" }),
    true,
  );
  assert.equal(
    requestShowsRetry({ status: "waiting", reason: "Requested — Sonarr has no series yet" }),
    true,
  );
  assert.equal(
    requestShowsRetry({ status: "downloading", reason: "Searching — no file yet" }),
    false,
  );
  assert.equal(requestShowsRetry({ status: "available" }), false);
});

test("sticky persist library ids do not keep a ghost movie available without a shelf hit", () => {
  const requests = [row({ id: "seerr-2", titleId: "tmdb-1593", status: "downloading", progress: 0 })];
  const honest = overlayLibraryPresence(requests, { titles: [] });
  assert.equal(honest[0]?.status, "downloading");
});

test("movie overlay matches TMDB from title.ids, not only t.id", () => {
  const requests = [row({ id: "seerr-2", titleId: "tmdb-1593", status: "downloading", progress: 0 })];
  const honest = overlayLibraryPresence(requests, {
    titles: [{ id: "jf-museum", kind: "movie", ids: ["tmdb-1593", "jf-1"] }],
  });
  assert.equal(honest[0]?.status, "available");
});

test("jf- library ids do not overlay a TMDB movie", () => {
  const requests = [row({ id: "seerr-2", titleId: "tmdb-1593", status: "downloading", progress: 0 })];
  const honest = overlayLibraryPresence(requests, { libraryIds: ["jf-abc"], titles: [] });
  assert.equal(honest[0]?.status, "downloading");
});

test("titleForRequest uses the request name when catalog is empty", () => {
  const t = titleForRequest(
    { titleId: "tmdb-324857", title: "Spider-Man: Into the Spider-Verse" },
    [],
  );
  assert.equal(t.title, "Spider-Man: Into the Spider-Verse");
  assert.equal(t.id, "tmdb-324857");
});

test("tmdb-2059 is a ghost label until Seerr names it", () => {
  assert.equal(isGhostRequestLabel("tmdb-2059", "tmdb-2059"), true);
  assert.equal(isGhostRequestLabel("", "tmdb-2059"), true);
  assert.equal(isGhostRequestLabel("National Treasure", "tmdb-2059"), false);
  const ghost = titleForRequest({ titleId: "tmdb-2059" }, []);
  assert.equal(isGhostRequestLabel(ghost.title, ghost.id), true);
  const named = titleForRequest({ titleId: "tmdb-2059" }, [
    { id: "tmdb-2059", kind: "movie", title: "National Treasure", year: 2004, poster: "https://image.tmdb.org/x.jpg", ids: ["tmdb-2059"] },
  ]);
  assert.equal(named.title, "National Treasure");
  assert.equal(isGhostRequestLabel(named.title, named.id), false);
});

test("stale local waiting rows drop when Seerr returns a shorter list", () => {
  const local = [
    row({ id: "ghost", titleId: "tmdb-2059", title: "National Treasure", status: "downloading", createdAt: 1, updatedAt: 1 }),
    ...Array.from({ length: 23 }, (_, i) =>
      row({ id: `stale-${i}`, titleId: `tmdb-tv-${9000 + i}`, title: "The Expanse", status: "waiting", createdAt: 1, updatedAt: 1, season: 1 }),
    ),
  ];
  const server = [
    row({ id: "seerr-9", titleId: "tmdb-2059", status: "downloading", progress: 0, createdAt: 1, updatedAt: 1 }),
    row({ id: "debrid-exp", titleId: "tmdb-tv-63639", title: "The Expanse", status: "available", progress: 100, season: 1, engine: "downloaded" }),
  ];
  const merged = mergeServerRequests(local, server);
  const inflight = inFlightRequests(merged, { titles: [] });
  assert.equal(inflight.length, 1);
  assert.equal(inflight[0]?.titleId, "tmdb-2059");
});

test("optimistic local Request survives one poll before Seerr echoes it", () => {
  const now = Date.now();
  const local = [row({ id: "req-new", titleId: "tmdb-157336", title: "Interstellar", status: "waiting", createdAt: now, updatedAt: now })];
  const server = [row({ id: "seerr-9", titleId: "tmdb-2059", status: "downloading" })];
  const merged = mergeServerRequests(local, server);
  assert.equal(merged.some((r) => r.titleId === "tmdb-157336"), true);
  assert.equal(merged.some((r) => r.titleId === "tmdb-2059"), true);
});

test("Home collapses two Expanse season rows to one card", () => {
  const cards = collapseHomeRequestCards([
    row({ id: "s1", titleId: "tmdb-tv-63639", title: "The Expanse", status: "waiting", season: 1 }),
    row({ id: "s2", titleId: "tmdb-tv-63639", title: "The Expanse", status: "waiting", season: 2 }),
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.titleId, "tmdb-tv-63639");
});

test("phone chrome keeps one Watch and the tab bar", () => {
  const home = readFileSync(new URL("../components/home-view.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /Watch in this browser/);
  assert.match(shell, />\s*Watch\s*</);
  assert.match(shell, /to: "\/discover"/);
  assert.match(shell, /to: "\/settings"/);
});

test("player matches tmdb-tv to a JF series whose id is tvdb / tmdb", () => {
  const series = {
    id: "tvdb-280619",
    ids: ["tmdb-63639", "tmdb-tv-63639", "tvdb-280619"],
    jellyfinId: "jf-expanse",
  };
  assert.equal(titleMatchesId(series, "tmdb-tv-63639"), true);
  assert.equal(titleMatchesId(series, "tmdb-63639"), true);
  assert.equal(titleMatchesId(series, "tvdb-280619"), true);
});
