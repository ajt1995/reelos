import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  applyStuckNotes,
  buildArrIndex,
  collapseDuplicateRequests,
  findExistingSeasonRequest,
  pickSeerrRequestForTitle,
  honestifyRequests,
  mapSeerrStatus,
  parseTitleId,
  realSeasonNumbers,
  seasonCount,
  seerrRequestRow,
  seerrSearchHit,
  titleIdFor,
  tmdbPoster,
} from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("TV ids stay distinct from movie tmdb ids", () => {
  assert.deepEqual(parseTitleId("tmdb-tv-80566"), { mediaType: "tv", tmdb: "80566", titleId: "tmdb-tv-80566" });
  assert.deepEqual(parseTitleId("tmdb-550"), { mediaType: "movie", tmdb: "550", titleId: "tmdb-550" });
  assert.equal(titleIdFor("tv", 80566), "tmdb-tv-80566");
  assert.equal(titleIdFor("movie", 550), "tmdb-550");
});

test("season selectors skip specials and fake uncapped counts", () => {
  const seasons = [
    { seasonNumber: 0, name: "Specials" },
    { seasonNumber: 1 },
    { seasonNumber: 2 },
    { seasonNumber: 3 },
  ];
  assert.deepEqual(realSeasonNumbers(seasons), [1, 2, 3]);
  assert.equal(seasonCount(seasons), 3);
  assert.equal(seasonCount(4), 4);
  assert.equal(seasonCount([]), 0);
});

test("search hits map TMDB posters and TV season counts", () => {
  const movie = seerrSearchHit({
    id: 550,
    mediaType: "movie",
    title: "Fight Club",
    releaseDate: "1999-10-15",
    posterPath: "/pB8BM7pdSp6B6Ih7QZ9Wbu2uLku.jpg",
    voteAverage: 8.4,
    overview: "An insomniac.",
  });
  assert.equal(movie.id, "tmdb-550");
  assert.equal(movie.kind, "movie");
  assert.equal(movie.year, 1999);
  assert.equal(tmdbPoster("/p.jpg"), "https://image.tmdb.org/t/p/w500/p.jpg");

  const show = seerrSearchHit({
    id: 80566,
    mediaType: "tv",
    name: "Resident Alien",
    firstAirDate: "2021-01-27",
    numberOfSeasons: 3,
    seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 3 }],
  });
  assert.equal(show.id, "tmdb-tv-80566");
  assert.equal(show.seasons, 3);
  assert.deepEqual(show.seasonList, [1, 2, 3]);
});

test("Seerr media/request status maps onto the phone pills", () => {
  assert.equal(mapSeerrStatus(5, 2), "downloaded");
  assert.equal(mapSeerrStatus(3, 2), "grabbing");
  assert.equal(mapSeerrStatus(4, 2), "grabbing");
  assert.equal(mapSeerrStatus(2, 1), "queued");
  assert.equal(mapSeerrStatus(1, 4), "failed");
});

test("request rows survive Apply because they come from Seerr ids", () => {
  const row = seerrRequestRow({
    id: 9,
    type: "tv",
    status: 2,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    requestedBy: { displayName: "Austin" },
    seasons: [{ seasonNumber: 2 }],
    media: { tmdbId: 80566, status: 3 },
  }, {});
  assert.equal(row.id, "seerr-9");
  assert.equal(row.titleId, "tmdb-tv-80566");
  assert.equal(row.status, "downloading");
  assert.equal(row.season, 2);
  assert.equal(row.requester, "Austin");
});

test("stuck-notes mark a grabbing Seerr row failed and leave available alone", () => {
  const notes = { "tmdb-tv-80566": { status: "failed", reason: "Cached but symlink missing" } };
  const grabbing = seerrRequestRow(
    {
      id: 9,
      type: "tv",
      status: 2,
      createdAt: "2026-09-08T00:00:00.000Z",
      updatedAt: "2026-09-08T00:00:00.000Z",
      seasons: [{ seasonNumber: 2 }],
      media: { tmdbId: 80566, status: 3 },
    },
    notes,
  );
  assert.equal(grabbing.status, "failed");
  assert.equal(grabbing.reason, "Cached but symlink missing");
  const ok = applyStuckNotes(
    { titleId: "tmdb-tv-80566", status: "available", engine: "downloaded", progress: 100 },
    notes,
  );
  assert.equal(ok.status, "available");
});

test("duplicate TWD S01 Seerr rows collapse to one phone request", () => {
  const a = seerrRequestRow({
    id: 3,
    type: "tv",
    status: 2,
    createdAt: "2026-09-09T01:00:00.000Z",
    updatedAt: "2026-09-09T01:00:00.000Z",
    seasons: [{ seasonNumber: 1 }],
    media: { tmdbId: 1402, status: 3 },
  }, {});
  const b = seerrRequestRow({
    id: 4,
    type: "tv",
    status: 2,
    createdAt: "2026-09-09T01:40:00.000Z",
    updatedAt: "2026-09-09T01:40:00.000Z",
    seasons: [{ seasonNumber: 1 }],
    media: { tmdbId: 1402, status: 3 },
  }, {});
  const collapsed = collapseDuplicateRequests([a, b]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].id, "seerr-3");
  assert.equal(findExistingSeasonRequest([a, b], { mediaType: "tv", tmdb: 1402, season: 1 })?.id, "seerr-3");
  assert.equal(findExistingSeasonRequest([a], { mediaType: "tv", tmdb: 1402, season: 2 }), null);
});

test("requested TV season AVAILABLE beats series still processing", () => {
  const row = seerrRequestRow(
    {
      id: 4,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: {
        tmdbId: 1402,
        status: 3,
        seasons: [
          { seasonNumber: 1, status: 5 },
          { seasonNumber: 2, status: 3 },
        ],
      },
    },
    {},
  );
  assert.equal(row.status, "available");
  assert.equal(row.engine, "downloaded");
  assert.equal(row.progress, 100);
  assert.equal(row.season, 1);
});

test("library hit upgrades a grabbing movie and does not invent progress", () => {
  const grabbing = seerrRequestRow(
    {
      id: 2,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 1593, status: 3 },
    },
    {},
  );
  assert.equal(grabbing.status, "downloading");
  assert.equal(grabbing.progress, 0);
  const honest = honestifyRequests([grabbing], {
    libraryTitles: [{ id: "tmdb-1593", kind: "movie", ids: ["tmdb-1593"] }],
  });
  assert.equal(honest.length, 1);
  assert.equal(honest[0].status, "available");
  assert.equal(honest[0].engine, "downloaded");
  assert.equal(honest[0].progress, 100);
  assert.equal(honest[0].titleId, "tmdb-1593");
});

test("TV series in Jellyfin does not close a different season still grabbing", () => {
  const s2 = seerrRequestRow(
    {
      id: 8,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 2 }],
      media: { tmdbId: 1402, status: 3 },
    },
    {},
  );
  const honest = honestifyRequests([s2], {
    libraryTitles: [{ id: "tmdb-tv-1402", kind: "tv", ids: ["tmdb-1402", "tvdb-153021"] }],
  });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].progress, 0);
});

test("Sonarr season hasFile upgrades that season only", () => {
  const s1 = seerrRequestRow(
    {
      id: 1,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1402, status: 3 },
    },
    {},
  );
  const s2 = seerrRequestRow(
    {
      id: 2,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:01:00.000Z",
      updatedAt: "2026-09-09T00:01:00.000Z",
      seasons: [{ seasonNumber: 2 }],
      media: { tmdbId: 1402, status: 3 },
    },
    {},
  );
  const arrIndex = buildArrIndex({
    series: [
      {
        tmdbId: 1402,
        seasons: [
          { seasonNumber: 1, statistics: { episodeFileCount: 6 } },
          { seasonNumber: 2, statistics: { episodeFileCount: 0 } },
        ],
      },
    ],
  });
  const honest = honestifyRequests([s1, s2], { arrIndex });
  assert.equal(honest.find((r) => r.season === 1)?.status, "available");
  assert.equal(honest.find((r) => r.season === 1)?.progress, 100);
  assert.equal(honest.find((r) => r.season === 2)?.status, "downloading");
  assert.equal(honest.find((r) => r.season === 2)?.progress, 0);
});

test("duplicate Seerr rows for the same title+season collapse when one is done", () => {
  const older = seerrRequestRow(
    {
      id: 2,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T01:00:00.000Z",
      updatedAt: "2026-09-09T01:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1402, status: 5 },
    },
    {},
  );
  const newer = seerrRequestRow(
    {
      id: 5,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T01:20:00.000Z",
      updatedAt: "2026-09-09T01:20:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1402, status: 3 },
    },
    {},
  );
  assert.equal(older.status, "available");
  assert.equal(newer.status, "downloading");
  const honest = honestifyRequests([older, newer], {});
  assert.equal(honest.length, 1);
  assert.equal(honest[0].status, "available");
  assert.equal(honest[0].progress, 100);
});

test("Radarr hasFile upgrades a movie Seerr still lists as grabbing", () => {
  const row = seerrRequestRow(
    {
      id: 2,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 1593, status: 3 },
    },
    {},
  );
  const honest = honestifyRequests([row], {
    arrIndex: buildArrIndex({ movies: [{ tmdbId: 1593, hasFile: true }] }),
  });
  assert.equal(honest[0].status, "available");
  assert.equal(honest[0].progress, 100);
});

test("library presence beats a stuck-failed movie", () => {
  const failed = seerrRequestRow(
    {
      id: 2,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 1593, status: 3 },
    },
    { "tmdb-1593": { status: "failed", reason: "Stuck at 0%" } },
  );
  assert.equal(failed.status, "failed");
  const honest = honestifyRequests([failed], {
    libraryTitles: [{ id: "tmdb-1593", kind: "movie" }],
  });
  assert.equal(honest[0].status, "available");
  assert.equal(honest[0].progress, 100);
});

test("by-id request pick is season-scoped, not reqs[0]", () => {
  const media = { tmdbId: 1402, status: 3, mediaType: "tv" };
  const reqs = [
    { id: 3, type: "tv", status: 2, seasons: [{ seasonNumber: 1 }], media: { status: 5 } },
    { id: 4, type: "tv", status: 2, seasons: [{ seasonNumber: 2 }], media: { status: 3 } },
  ];
  const s2 = pickSeerrRequestForTitle(reqs, { media, mediaType: "tv", season: 2 });
  assert.equal(s2.id, 4);
  assert.deepEqual(realSeasonNumbers(s2.seasons), [2]);
  const s1 = pickSeerrRequestForTitle(reqs, { media, mediaType: "tv", season: 1 });
  assert.equal(s1.id, 3);
  const missing = pickSeerrRequestForTitle(reqs, { media, mediaType: "tv", season: 9 });
  assert.equal(missing.id, undefined);
  assert.deepEqual(realSeasonNumbers(missing.seasons), [9]);
  const progress = readFileSync(join(root, "scripts/reelos-request-progress-plugin.mjs"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  assert.match(progress, /pickSeerrRequestForTitle/);
  assert.match(lookup, /pickSeerrRequestForTitle/);
  assert.match(progress, /searchParams.get\("season"\)/);
});

test("GET /api/request plugins honestify Seerr rows against library and *arr", () => {
  const progress = readFileSync(join(root, "scripts/reelos-request-progress-plugin.mjs"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const seerr = readFileSync(join(root, "scripts/reelos-seerr.mjs"), "utf8");
  assert.match(progress, /honestifyRequests/);
  assert.match(progress, /loadPresenceFacts/);
  assert.match(lookup, /honestifyRequests/);
  assert.match(seerr, /Jellyfin library hit \(movie TMDB\)/);
  assert.match(seerr, /Radarr hasFile \/ Sonarr season episodeFileCount/);
});

test("compose and Caddy name the service seerr on 5055", () => {
  const yml = readFileSync(join(root, "install/compose/docker-compose.yml"), "utf8");
  const caddy = readFileSync(join(root, "install/compose/Caddyfile"), "utf8");
  assert.match(yml, /^\s+seerr:/m);
  assert.match(yml, /fallenbagel\/jellyseerr/);
  assert.match(yml, /5055:5055/);
  assert.match(yml, /profiles: \["jellyfin", "seerr"\]/);
  assert.match(caddy, /handle \/seerr\*/);
  assert.match(caddy, /127\.0\.0\.1:5055/);
});
