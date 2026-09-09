import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  applyStuckNotes,
  buildArrIndex,
  buildSeerrAddPayload,
  collapseDuplicateRequests,
  findExistingSeasonRequest,
  pickSeerrRequestForTitle,
  honestifyRequests,
  assembleRequestPayload,
  ERA_QA_TITLES,
  lookupFailureMessage,
  mapSeerrSearchResults,
  mapSeerrStatus,
  proveEraLookupRequest,
  mergeUnfinishedRows,
  missingArrRequests,
  normalizeMediaType,
  seerrAvailableIsGhost,
  seerrMediaGhostRows,
  parseTitleId,
  realSeasonNumbers,
  seasonCount,
  seerrRequestRow,
  seerrSearchHit,
  simulateLookupAndRequest,
  titleIdFor,
  tmdbPoster,
  tvSeasonsForRequest,
  movieRequestReason,
  qualityFloorRejectsHd,
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
  assert.equal(mapSeerrStatus(5, 2, 3), "grabbing");
  assert.equal(mapSeerrStatus(5, 2, 5), "downloaded");
  assert.equal(mapSeerrStatus(4, 2, 5), "downloaded");
  assert.equal(mapSeerrStatus(4, 2, 3), "grabbing");
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

test("series AVAILABLE does not close a season Seerr still lists as processing", () => {
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
        status: 5,
        seasons: [
          { seasonNumber: 1, status: 3 },
          { seasonNumber: 2, status: 5 },
        ],
      },
    },
    {},
  );
  assert.equal(row.status, "downloading");
  assert.equal(row.progress, 0);
});

test("ghost Seerr AVAILABLE + Sonarr season files=0 stays downloading", () => {
  const row = seerrRequestRow(
    {
      id: 4,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1402, status: 5 },
    },
    {},
  );
  assert.equal(row.status, "available");
  const arrIndex = buildArrIndex({
    series: [{ tmdbId: 1402, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }] }],
  });
  assert.equal(seerrAvailableIsGhost(row, { arrIndex, arrReady: true }), true);
  const honest = honestifyRequests([row], { arrIndex, arrReady: true });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].progress, 0);
  assert.equal(honest[0].reason, "Seerr says available — no file on disk");
});

test("movie Available still wins when the JF shelf has the title", () => {
  const row = seerrRequestRow(
    {
      id: 2,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 1593, status: 5 },
    },
    {},
  );
  const honest = honestifyRequests([row], {
    libraryTitles: [{ id: "tmdb-1593", kind: "movie" }],
    arrReady: true,
    arrIndex: buildArrIndex({ movies: [{ tmdbId: 1593, hasFile: false }] }),
  });
  assert.equal(honest[0].status, "available");
  assert.equal(honest[0].progress, 100);
});

test("empty series synthesizes only the first missing season, not S02–S11", () => {
  const extras = missingArrRequests([
    {
      id: 9,
      tmdbId: 1402,
      monitored: true,
      statistics: { episodeFileCount: 0 },
      seasons: [
        { seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } },
        { seasonNumber: 2, monitored: true, statistics: { episodeFileCount: 0 } },
      ],
    },
  ]);
  assert.equal(extras.length, 1);
  assert.equal(extras[0].season, 1);
});

test("partial series still lists a later missing season", () => {
  const extras = missingArrRequests([
    {
      id: 9,
      tmdbId: 1402,
      monitored: true,
      statistics: { episodeFileCount: 6 },
      seasons: [
        { seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 6 } },
        { seasonNumber: 2, monitored: true, statistics: { episodeFileCount: 0 } },
      ],
    },
  ]);
  assert.equal(extras.length, 1);
  assert.equal(extras[0].season, 2);
});

test("empty Seerr list still shows unfinished TWD from Sonarr", () => {
  const extras = missingArrRequests(
    [
      {
        id: 9,
        title: "The Walking Dead",
        tmdbId: 1402,
        added: "2026-09-09T01:00:00.000Z",
        monitored: true,
        seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } }],
      },
    ],
    [{ id: 1, title: "Night at the Museum", tmdbId: 1593, hasFile: true }],
  );
  assert.equal(extras.length, 1);
  assert.equal(extras[0].titleId, "tmdb-tv-1402");
  assert.equal(extras[0].season, 1);
  const merged = mergeUnfinishedRows([], extras, {
    libraryTitles: [{ id: "tmdb-1593", kind: "movie" }],
    arrIndex: buildArrIndex({
      movies: [{ tmdbId: 1593, hasFile: true }],
      series: [{ tmdbId: 1402, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }] }],
    }),
    arrReady: true,
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "downloading");
  assert.equal(merged[0].titleId, "tmdb-tv-1402");
});

test("empty Seerr + Museum already in library does not invent an Available request", () => {
  const extras = missingArrRequests(
    [],
    [{ id: 1, title: "Night at the Museum", tmdbId: 1593, hasFile: false, monitored: true }],
  );
  const merged = mergeUnfinishedRows([], extras, {
    libraryTitles: [{ id: "tmdb-1593", kind: "movie" }],
    arrReady: true,
    arrIndex: buildArrIndex({ movies: [{ tmdbId: 1593, hasFile: false }] }),
  });
  assert.equal(merged.length, 0);
});

test("duplicate collapse still prefers a done sibling after extras merge", () => {
  const seerr = seerrRequestRow(
    {
      id: 3,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T01:00:00.000Z",
      updatedAt: "2026-09-09T01:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1402, status: 3 },
    },
    {},
  );
  const extras = missingArrRequests([
    {
      id: 9,
      tmdbId: 1402,
      monitored: true,
      seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 6 } }],
    },
  ]);
  const merged = mergeUnfinishedRows([seerr], extras, {
    arrReady: true,
    arrIndex: buildArrIndex({
      series: [{ tmdbId: 1402, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 6 } }] }],
    }),
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "available");
  assert.equal(merged[0].progress, 100);
});

test("National Treasure stuck downloading@0 is honest when Radarr never got the movie", () => {
  const row = seerrRequestRow(
    {
      id: 9,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 2059, status: 3 },
    },
    {},
  );
  assert.equal(row.status, "downloading");
  assert.equal(row.progress, 0);
  assert.equal(
    movieRequestReason(row, { movies: [], arrMoviesReady: true }),
    "Requested — Radarr has no movie yet",
  );
  const honest = honestifyRequests([row], { movies: [], arrMoviesReady: true, arrReady: true });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].progress, 0);
  assert.equal(honest[0].reason, "Requested — Radarr has no movie yet");
  const assembled = assembleRequestPayload([row], {
    movies: [],
    series: [],
    arrMoviesReady: true,
    arrReady: true,
    arrIndex: buildArrIndex({ movies: [] }),
  });
  assert.equal(assembled.pipeline.radarrMissing.length, 0);
  assert.equal(assembled.requests[0].reason, "Requested — Radarr has no movie yet");
});

test("0-file Radarr movie with a grab client is honest about the silent 0%", () => {
  const row = seerrRequestRow(
    {
      id: 9,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 2059, status: 3 },
    },
    {},
  );
  const decypharr = [
    {
      implementation: "QBittorrent",
      fields: [
        { name: "host", value: "decypharr" },
        { name: "port", value: 8282 },
      ],
    },
  ];
  const movie = { id: 12, tmdbId: 2059, hasFile: false, statistics: { movieFileCount: 0 }, qualityProfileId: 1 };
  const honest = honestifyRequests([row], {
    movies: [movie],
    arrMoviesReady: true,
    arrReady: true,
    radarrClients: decypharr,
    radarrProfiles: [{ id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] }],
    arrIndex: buildArrIndex({ movies: [movie] }),
  });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].progress, 0);
  assert.equal(honest[0].reason, "Searching — no file yet");
  assert.equal(
    movieRequestReason(row, {
      movies: [{ ...movie, monitored: false }],
      arrMoviesReady: true,
      radarrClients: decypharr,
    }),
    "Unmonitored in Radarr — search will not run",
  );
  const ultra = {
    id: 6,
    name: "Ultra-HD",
    items: [
      { quality: { name: "WEBDL-720p" }, allowed: false },
      { quality: { name: "WEBDL-2160p" }, allowed: true },
    ],
  };
  assert.equal(qualityFloorRejectsHd([ultra], 6), true);
  assert.equal(
    movieRequestReason(row, {
      movies: [{ ...movie, qualityProfileId: 6 }],
      arrMoviesReady: true,
      radarrClients: decypharr,
      radarrProfiles: [ultra],
    }),
    "Quality floor is rejecting HD releases",
  );
  assert.equal(
    movieRequestReason(row, {
      movies: [movie],
      arrMoviesReady: true,
      radarrClients: decypharr,
      radarrQueue: [{ movieId: 12 }],
    }),
    "Grabbed — waiting on Decypharr",
  );
});

test("0-file Radarr movie with no Decypharr client surfaces the missing hop", () => {
  const row = seerrRequestRow(
    {
      id: 9,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 2059, status: 3 },
    },
    {},
  );
  const honest = honestifyRequests([row], {
    movies: [{ tmdbId: 2059, hasFile: false, statistics: { movieFileCount: 0 } }],
    arrMoviesReady: true,
    arrReady: true,
    radarrClients: [],
    arrIndex: buildArrIndex({ movies: [{ tmdbId: 2059, hasFile: false }] }),
  });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].reason, "No grab client — search cannot land");
  assert.equal(
    movieRequestReason(row, { movies: [{ tmdbId: 157336, hasFile: true }], arrMoviesReady: false }),
    undefined,
  );
  assert.equal(
    movieRequestReason(row, {
      movies: [{ tmdbId: 2059, hasFile: false, statistics: { movieFileCount: 0 } }],
      arrMoviesReady: true,
      radarrClients: [
        {
          enable: false,
          implementation: "QBittorrent",
          fields: [
            { name: "host", value: "decypharr" },
            { name: "port", value: 8282 },
          ],
        },
      ],
    }),
    "No grab client — search cannot land",
  );
});

test("Seerr media ghost (request list empty, media still processing) becomes a row", () => {
  const ghosts = seerrMediaGhostRows([
    {
      id: 7,
      mediaType: "tv",
      tmdbId: 1402,
      status: 3,
      seasons: [{ seasonNumber: 1, status: 3 }],
      createdAt: "2026-09-09T01:00:00.000Z",
      updatedAt: "2026-09-09T01:00:00.000Z",
    },
  ]);
  assert.equal(ghosts.length, 1);
  assert.equal(ghosts[0].titleId, "tmdb-tv-1402");
  assert.equal(ghosts[0].season, 1);
  assert.equal(ghosts[0].status, "downloading");
});

test("assembleRequestPayload exposes pipeline counts for HTTP house hops", () => {
  const assembled = assembleRequestPayload(
    [],
    {
      series: [
        {
          id: 9,
          tmdbId: 1402,
          title: "The Walking Dead",
          monitored: true,
          seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } }],
        },
      ],
      movies: [],
      torrents: [{ name: "The.Walking.Dead.S01", category: "sonarr", hash: "aa" }],
      dumps: { sonarr: [], radarr: ["Night at the Museum"] },
      catalog: ["The.Walking.Dead.S01.2010.2160p.WEB-DL", "Night.at.the.Museum.2006"],
      arrReady: true,
      arrIndex: buildArrIndex({
        series: [{ tmdbId: 1402, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }] }],
      }),
    },
    [],
  );
  assert.equal(assembled.requests.length, 1);
  assert.equal(assembled.pipeline.seerr, 0);
  assert.equal(assembled.pipeline.sonarrMissing.length, 1);
  assert.equal(assembled.pipeline.dumps.sonarr, 0);
  assert.equal(assembled.pipeline.fuseTv, 1);
  assert.equal(assembled.pipeline.decypharr, 1);
});

test("Seerr National Treasure does not invent grabbing rows for the Radarr backlog", () => {
  const row = seerrRequestRow(
    {
      id: 9,
      type: "movie",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      media: { tmdbId: 2059, status: 3 },
    },
    {},
  );
  const extras = missingArrRequests(
    [],
    [
      { id: 12, tmdbId: 2059, hasFile: false, monitored: true, statistics: { movieFileCount: 0 } },
      { id: 1, tmdbId: 157336, hasFile: false, monitored: true, statistics: { movieFileCount: 0 } },
      { id: 2, tmdbId: 245891, hasFile: false, monitored: true },
    ],
  );
  const merged = mergeUnfinishedRows([row], extras, {
    movies: extras,
    arrMoviesReady: true,
    arrReady: true,
    arrIndex: buildArrIndex({ movies: extras }),
  });
  assert.deepEqual(
    merged.map((r) => r.titleId),
    ["tmdb-2059"],
  );
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
  assert.match(progress, /assembleRequestPayload/);
  assert.match(progress, /loadPresenceFacts/);
  assert.match(progress, /recover/);
  assert.match(progress, /listRecoverTargets/);
  assert.match(progress, /reason: honest.reason/);
  assert.match(lookup, /assembleRequestPayload/);
  assert.match(lookup, /kickArrRecover/);
  assert.match(lookup, /mediaType: parsed.mediaType/);
  assert.match(lookup, /seerr reuse/);
  assert.match(seerr, /Jellyfin library hit \(movie TMDB\)/);
  assert.match(seerr, /Radarr hasFile \/ Sonarr season episodeFileCount/);
  assert.match(seerr, /Ghost: Seerr AVAILABLE/);
  assert.match(seerr, /Requested — Radarr has no movie yet/);
  assert.match(seerr, /Searching — no file yet/);
});

test("2012–2016 movie + TV search is not year-filtered and keeps mediaType", () => {
  const hits = [
    { id: 287, mediaType: "person", name: "Brad Pitt" },
    {
      id: 157336,
      mediaType: "Movie",
      title: "Interstellar",
      releaseDate: "2014-11-07",
      posterPath: "/interstellar.jpg",
    },
    {
      id: 286217,
      mediaType: "movie",
      title: "The Martian",
      releaseDate: "2015-09-30",
    },
    {
      id: 48891,
      mediaType: "TV",
      name: "Brooklyn Nine-Nine",
      firstAirDate: "2013-09-17",
      numberOfSeasons: 8,
      seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
    },
    {
      id: 62560,
      mediaType: "tv",
      name: "Mr. Robot",
      firstAirDate: "2015-06-24",
      numberOfSeasons: 4,
      seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }],
    },
    { id: 10, mediaType: "collection", title: "A Collection" },
  ];
  const titles = mapSeerrSearchResults(hits, { q: "interstellar" });
  assert.equal(normalizeMediaType("Movie"), "movie");
  assert.equal(normalizeMediaType("TV"), "tv");
  assert.equal(normalizeMediaType("person"), null);
  assert.deepEqual(
    titles.map((t) => t.id),
    ["tmdb-157336", "tmdb-286217", "tmdb-tv-62560", "tmdb-tv-48891"],
  );
  const interstellar = titles.find((t) => t.id === "tmdb-157336");
  const b99 = titles.find((t) => t.id === "tmdb-tv-48891");
  assert.equal(interstellar.kind, "movie");
  assert.equal(interstellar.year, 2014);
  assert.equal(b99.kind, "tv");
  assert.equal(b99.year, 2013);
  assert.deepEqual(b99.seasonList, [1, 2]);
  assert.ok(titles.every((t) => t.year >= 2012 && t.year <= 2016));
});

test("QA gate: 2 movies + 2 TV seasons (2012–2016) search→request→honest 0%/AVAILABLE", () => {
  assert.equal(ERA_QA_TITLES.length, 4);
  assert.equal(ERA_QA_TITLES.filter((t) => t.mediaType === "movie").length, 2);
  assert.equal(ERA_QA_TITLES.filter((t) => t.mediaType === "tv").length, 2);
  for (const spec of ERA_QA_TITLES) {
    assert.ok(spec.year >= 2012 && spec.year <= 2016, spec.title);
    const grabbing = proveEraLookupRequest(spec, { hasFile: false });
    assert.ok(grabbing.picked, spec.title);
    assert.equal(grabbing.picked.title, spec.title);
    assert.equal(grabbing.picked.year, spec.year);
    assert.ok(grabbing.titles.some((t) => t.id === grabbing.picked.id));
    if (spec.mediaType === "movie") {
      assert.deepEqual(grabbing.payload, { mediaType: "movie", mediaId: spec.id });
      assert.equal("seasons" in grabbing.payload, false);
      assert.equal(grabbing.request.season, undefined);
    } else {
      assert.deepEqual(grabbing.payload, {
        mediaType: "tv",
        mediaId: spec.id,
        seasons: [spec.season],
      });
      assert.equal(grabbing.payload.seasons.length, 1);
      assert.notEqual(grabbing.payload.seasons, "all");
      assert.equal(grabbing.request.season, spec.season);
    }
    assert.equal(grabbing.request.status, "downloading");
    assert.equal(grabbing.request.progress, 0);
    assert.ok(![42, 62].includes(grabbing.request.progress), spec.title);

    const landed = proveEraLookupRequest(spec, { hasFile: true });
    assert.equal(landed.request.status, "available");
    assert.equal(landed.request.progress, 100);
    assert.equal(landed.request.engine, "downloaded");
    if (spec.mediaType === "tv") assert.equal(landed.request.season, spec.season);
  }
});

test("lookup+request: Interstellar (2014) movie — Seerr POST, honest 0% then AVAILABLE", () => {
  const searchHits = [
    { id: 157336, mediaType: "movie", title: "Interstellar", releaseDate: "2014-11-07" },
  ];
  const grabbing = simulateLookupAndRequest(
    { searchHits, movieHasFile: false, seerrMediaStatus: 3 },
    { q: "interstellar", pickId: "tmdb-157336" },
  );
  assert.equal(grabbing.picked.title, "Interstellar");
  assert.equal(grabbing.picked.year, 2014);
  assert.deepEqual(grabbing.payload, { mediaType: "movie", mediaId: 157336 });
  assert.equal("seasons" in grabbing.payload, false);
  assert.equal(grabbing.request.status, "downloading");
  assert.equal(grabbing.request.progress, 0);
  assert.notEqual(grabbing.request.progress, 42);
  assert.notEqual(grabbing.request.progress, 62);

  const available = simulateLookupAndRequest(
    { searchHits, movieHasFile: true, seerrMediaStatus: 5 },
    { q: "interstellar", pickId: "tmdb-157336" },
  );
  assert.equal(available.request.status, "available");
  assert.equal(available.request.progress, 100);
  assert.equal(available.request.engine, "downloaded");
});

test("lookup+request: Brooklyn Nine-Nine (2013) S01 only — never seasons=all", () => {
  const searchHits = [
    {
      id: 48891,
      mediaType: "tv",
      name: "Brooklyn Nine-Nine",
      firstAirDate: "2013-09-17",
      seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
    },
  ];
  const s01 = simulateLookupAndRequest(
    { searchHits, seasonFileCount: 0, seerrMediaStatus: 3 },
    { q: "brooklyn", pickId: "tmdb-tv-48891", season: 1 },
  );
  assert.equal(s01.picked.kind, "tv");
  assert.equal(s01.picked.year, 2013);
  assert.deepEqual(s01.payload, { mediaType: "tv", mediaId: 48891, seasons: [1] });
  assert.notEqual(s01.payload.seasons, "all");
  assert.equal(s01.request.season, 1);
  assert.equal(s01.request.status, "downloading");
  assert.equal(s01.request.progress, 0);

  const missingSeason = buildSeerrAddPayload({ mediaType: "tv", tmdb: 62560 });
  assert.deepEqual(missingSeason, { mediaType: "tv", mediaId: 62560, seasons: [1] });
  assert.deepEqual(tvSeasonsForRequest(undefined), [1]);
  assert.deepEqual(tvSeasonsForRequest("all"), [1]);
  assert.deepEqual(tvSeasonsForRequest(2), [2]);

  const landed = simulateLookupAndRequest(
    { searchHits, seasonFileCount: 22, seerrMediaStatus: 5 },
    { q: "brooklyn", pickId: "tmdb-tv-48891", season: 1 },
  );
  assert.equal(landed.request.status, "available");
  assert.equal(landed.request.progress, 100);
  assert.equal(landed.request.season, 1);
});

test("AbortError / timeout is a retryable lookup error, not an empty shelf", () => {
  const abort = new Error("The operation was aborted");
  abort.name = "AbortError";
  assert.equal(lookupFailureMessage(abort), "Seerr lookup timed out. Try the search again.");
  assert.match(lookupFailureMessage(new Error("timeout")), /timed out/);
  assert.deepEqual(mapSeerrSearchResults([], { q: "interstellar" }), []);
});

test("Discover stays free of In progress; POST never sends seasons=all", () => {
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const title = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  assert.doesNotMatch(discover, /In progress/i);
  assert.doesNotMatch(discover, /request=\{/);
  assert.match(discover, /Looking up movies and shows/);
  assert.match(discover, /lookupErr/);
  assert.match(lookup, /mapSeerrSearchResults/);
  assert.match(lookup, /buildSeerrAddPayload/);
  assert.match(lookup, /lookupFailureMessage/);
  assert.match(lookup, /ms: 45000/);
  assert.doesNotMatch(lookup, /seasons = .*["']all["']/);
  assert.match(title, /season: resolved\.kind === "tv" \|\| resolved\.kind === "anime" \? season/);
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
