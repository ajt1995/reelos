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
  attachRequestTitles,
  attachSeerrDetailTitles,
  clearRequestTitleCache,
  needsRequestTitle,
  ERA_QA_TITLES,
  lookupFailureMessage,
  mapSeerrDiscoverResults,
  mapSeerrSearchResults,
  discoverHitReleased,
  mapSeerrStatus,
  proveEraLookupRequest,
  mergeUnfinishedRows,
  missingArrRequests,
  normalizeMediaType,
  seerrAvailableIsGhost,
  seerrAlreadyHave,
  discoverOwnedIndex,
  discoverTitleIsOwned,
  seerrMediaGhostRows,
  parseTitleId,
  realSeasonNumbers,
  seasonCount,
  seasonIsUnreleased,
  applyRequestMediaType,
  seasonUnreleasedForRequest,
  seasonChipKind,
  seasonChipLabel,
  seasonFactsFrom,
  unreleasedSeasonNumbers,
  mergeUnreleasedSeasons,
  UNRELEASED_SEASON_CHIP,
  UNRELEASED_SEASON_COPY,
  IMPORTING_SEASON_COPY,
  seerrRequestRow,
  seerrSearchHit,
  simulateLookupAndRequest,
  mapSeerrPersonHits,
  mapSeerrCollectionHits,
  mapSeerrPersonDetail,
  titleIdFor,
  tmdbPoster,
  tvSeasonsForRequest,
  movieRequestReason,
  tvRequestReason,
  qualityFloorRejectsHd,
  pipelineMovieGaps,
  resolveParsedTitle,
  attachTitleAliases,
  libraryHasTitle,
  findLibraryTitle,
  sonarrSeriesForParsed,
  lookupPayloadForId,
  overlayLookupWithLibrary,
  seerrCatalogSeasons,
  pickSeerrSearchForLibrary,
  discoverBrowseSeerrPath,
  discoverBrowseKind,
  mapSeerrGenres,
  FALLBACK_MOVIE_GENRES,
  onDiskSeasonsFor,
  expandTvSeasonRows,
  decorateTitlesWithDiskSeasons,
  titleRequestSeasonPayload,
  mergeRequestListTitles,
} from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("TV ids stay distinct from movie tmdb ids", () => {
  assert.deepEqual(parseTitleId("tmdb-tv-80566"), { mediaType: "tv", tmdb: "80566", titleId: "tmdb-tv-80566" });
  assert.deepEqual(parseTitleId("tmdb-550"), { mediaType: "movie", tmdb: "550", titleId: "tmdb-550" });
  assert.deepEqual(parseTitleId("jf-103ae87fbbbd9bb920ee3803dcffc570"), {
    jellyfinId: "103ae87fbbbd9bb920ee3803dcffc570",
    titleId: "jf-103ae87fbbbd9bb920ee3803dcffc570",
  });
  assert.equal(titleIdFor("tv", 80566), "tmdb-tv-80566");
  assert.equal(titleIdFor("movie", 550), "tmdb-550");
  const darkKnight = parseTitleId("tmdb-155");
  const asTv = applyRequestMediaType(darkKnight, "tv", "tmdb-155");
  assert.equal(asTv.mediaType, "movie");
  assert.equal(asTv.titleId, "tmdb-155");
  const thirdRock = applyRequestMediaType(parseTitleId("tmdb-tv-155"), "movie", "tmdb-tv-155");
  assert.equal(thirdRock.mediaType, "tv");
  assert.equal(thirdRock.titleId, "tmdb-tv-155");
  const thirdRockSeries = {
    tmdbId: 155,
    title: "3rd Rock from the Sun",
    seasons: [
      { seasonNumber: 1, statistics: { episodeFileCount: 20, episodeCount: 20 } },
      { seasonNumber: 6, statistics: { episodeFileCount: 0, episodeCount: 0 } },
    ],
  };
  assert.equal(sonarrSeriesForParsed(parseTitleId("tmdb-155"), [thirdRockSeries]), null);
  assert.equal(sonarrSeriesForParsed(parseTitleId("tmdb-tv-155"), [thirdRockSeries])?.title, "3rd Rock from the Sun");
  const mixedShelf = [
    { id: "tmdb-tv-155", kind: "tv", title: "3rd Rock from the Sun", ids: ["tmdb-tv-155", "tmdb-155"] },
    { id: "tmdb-155", kind: "movie", title: "The Dark Knight", ids: ["tmdb-155"] },
  ];
  assert.equal(findLibraryTitle(mixedShelf, "tmdb-155")?.title, "The Dark Knight");
  assert.equal(findLibraryTitle(mixedShelf, "tmdb-tv-155")?.title, "3rd Rock from the Sun");
  const moviePayload = titleRequestSeasonPayload({
    id: "tmdb-155",
    parsed: parseTitleId("tmdb-155"),
    facts: { series: [thirdRockSeries] },
    title: { kind: "movie", title: "The Dark Knight" },
    honest: { titleId: "tmdb-155", status: "available", engine: "downloaded" },
  });
  assert.deepEqual(moviePayload.unreleasedSeasons, []);
  assert.equal(moviePayload.title, "The Dark Knight");
  const decorated = decorateTitlesWithDiskSeasons(
    [{ id: "tmdb-155", kind: "movie", title: "The Dark Knight", ids: ["tmdb-155"] }],
    { series: [thirdRockSeries] },
  );
  assert.equal(decorated[0].kind, "movie");
  assert.equal(decorated[0].seasonList == null || decorated[0].seasonList.length === 0, true);
  assert.deepEqual(parseTitleId("73ceff573dc30bebc3fcf26f61de07b25f927a74"), {
    hash: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    titleId: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
  });
});

test("tvdb shelf rows resolve to the same TMDB show as tmdb-tv", () => {
  const expanse = {
    id: "tvdb-280619",
    kind: "tv",
    ids: ["tmdb-63639", "tmdb-tv-63639", "tvdb-280619"],
    jellyfinId: "jf-expanse",
  };
  const parsed = parseTitleId("tvdb-280619");
  assert.equal(parsed.tmdb, undefined);
  const resolved = resolveParsedTitle(parsed, { titles: [expanse] });
  assert.equal(resolved.tmdb, "63639");
  assert.equal(resolved.mediaType, "tv");
  assert.equal(resolved.titleId, "tmdb-tv-63639");
  assert.equal(resolved.tvdb, "280619");
  const fromSonarr = resolveParsedTitle(parseTitleId("tvdb-280619"), {
    series: [{ tvdbId: 280619, tmdbId: 63639, title: "The Expanse" }],
  });
  assert.equal(fromSonarr.tmdb, "63639");
  assert.equal(libraryHasTitle([expanse], "tvdb-280619"), true);
  assert.equal(libraryHasTitle([expanse], "tmdb-tv-63639"), true);
  const aliased = attachTitleAliases({ id: "tmdb-tv-63639", kind: "tv", title: "The Expanse" }, resolved);
  assert.ok(aliased.ids.includes("tvdb-280619"));
  assert.ok(aliased.ids.includes("tmdb-tv-63639"));
});

test("jf-* lookup uses the library row, not a Seerr miss", () => {
  const rick = {
    id: "tvdb-275274",
    kind: "tv",
    title: "Rick and Morty",
    year: 2013,
    ids: ["tvdb-275274", "tmdb-tv-60625", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "2e58b382fb6f70f674e1e7273b2d05f8",
  };
  const parsed = parseTitleId("jf-103ae87fbbbd9bb920ee3803dcffc570");
  const resolved = resolveParsedTitle(parsed, { titles: [rick] });
  assert.equal(resolved.tmdb, "60625");
  assert.equal(resolved.mediaType, "tv");
  assert.equal(findLibraryTitle([rick], "jf-103ae87fbbbd9bb920ee3803dcffc570")?.title, "Rick and Morty");
  const onBox = lookupPayloadForId({
    seerrTitle: null,
    libraryTitle: { ...rick, title: "Rick and Morty" },
    missingTmdb: true,
  });
  assert.equal(onBox.titles[0].title, "Rick and Morty");
  assert.equal(onBox.error, null);
  const named = lookupPayloadForId({
    seerrTitle: { id: "tmdb-tv-60625", kind: "tv", title: "Rick and Morty", ids: ["tmdb-tv-60625"] },
    libraryTitle: rick,
  });
  assert.ok(named.titles[0].ids.includes("jf-103ae87fbbbd9bb920ee3803dcffc570"));
  const unknown = lookupPayloadForId({
    libraryTitle: { id: "jf-abc", kind: "tv", title: "Unknown on this box" },
    missingTmdb: true,
  });
  assert.equal(unknown.titles[0].title, "Unknown on this box");
  assert.equal(unknown.error, null);
  const miss = lookupPayloadForId({ missingTmdb: false });
  assert.equal(miss.error, "Seerr did not find that title");
  const hit = pickSeerrSearchForLibrary(
    { kind: "tv", title: "Rick and Morty" },
    [
      { kind: "movie", title: "Rick and Morty" },
      { kind: "tv", title: "Rick and Morty" },
    ],
  );
  assert.equal(hit.kind, "tv");
});

test("infohash URL resolves the Rick dump folder", () => {
  const rick = {
    id: "tvdb-275274",
    kind: "tv",
    title: "Rick and Morty",
    ids: ["tvdb-275274", "tmdb-tv-60625", "73ceff573dc30bebc3fcf26f61de07b25f927a74", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    path: "/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74",
    onDiskSeasons: [4],
  };
  assert.equal(findLibraryTitle([rick], "73ceff573dc30bebc3fcf26f61de07b25f927a74")?.title, "Rick and Morty");
  const index = buildArrIndex({
    series: [
      {
        tmdbId: 60625,
        tvdbId: 275274,
        seasons: [
          { seasonNumber: 1, statistics: { episodeFileCount: 11 } },
          { seasonNumber: 4, statistics: { episodeFileCount: 10 } },
        ],
      },
    ],
  });
  assert.deepEqual(onDiskSeasonsFor({ mediaType: "tv", tmdb: "60625", tvdb: "275274" }, index), [1, 4]);
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

test("announced season with 0 episodes and future airDate is Coming, not Request/Watch", () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  const siloS04 = { seasonNumber: 4, episodeCount: 0, airDate: "2027-06-01" };
  const siloS03 = { seasonNumber: 3, episodeCount: 10, airDate: "2025-03-27" };
  const sonarrTba = {
    seasonNumber: 4,
    monitored: true,
    statistics: { episodeFileCount: 0, episodeCount: 1, totalEpisodeCount: 1 },
  };
  const airingMissing = {
    seasonNumber: 8,
    statistics: {
      episodeFileCount: 0,
      episodeCount: 18,
      previousAiring: "2026-01-15T00:00:00Z",
      nextAiring: "2026-09-20T00:00:00Z",
    },
  };
  assert.equal(seasonIsUnreleased(siloS04, now), true);
  assert.equal(seasonIsUnreleased(siloS03, now), false);
  assert.equal(seasonIsUnreleased(sonarrTba, now), true);
  assert.equal(seasonIsUnreleased(airingMissing, now), false);
  const sonarrEmptyReleased = {
    seasonNumber: 2,
    monitored: false,
    statistics: { episodeFileCount: 0, episodeCount: 0, totalEpisodeCount: 13 },
  };
  const seerrAired = { seasonNumber: 2, episodeCount: 13, airDate: "2009-03-08" };
  const sonarrPlaceholderTba = { seasonNumber: 6, monitored: true, statistics: null };
  assert.equal(seasonIsUnreleased(sonarrPlaceholderTba, now), true, "Sonarr S6 with no stats is Coming");
  const stFacts = {
    seasonFacts: [
      { season: 1, unreleased: false },
      { season: 5, unreleased: false },
    ],
  };
  assert.deepEqual(
    mergeUnreleasedSeasons({
      title: stFacts,
      series: {
        seasons: [
          { seasonNumber: 5, statistics: { episodeFileCount: 0, episodeCount: 8, previousAiring: "2025-11-26T00:00:00Z" } },
          sonarrPlaceholderTba,
        ],
      },
      now,
    }),
    [6],
    "Seerr S1–S5 stay Request; Sonarr-only S6 is Coming",
  );
  assert.equal(seasonIsUnreleased(sonarrEmptyReleased, now), true, "empty Sonarr S02 looks Coming");
  assert.equal(
    seasonUnreleasedForRequest({ sonarrSeason: sonarrEmptyReleased, seerrSeason: seerrAired }, now),
    false,
    "Breaking Bad S02 still Request when Seerr has aired episodes",
  );
  assert.equal(
    seasonUnreleasedForRequest({ sonarrSeason: sonarrTba, seerrSeason: siloS04 }, now),
    true,
    "Silo S04 stays Coming",
  );
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  assert.match(plugin, /applyRequestMediaType/);
  assert.match(plugin, /seasonUnreleasedForRequest/);
  assert.doesNotMatch(plugin, /bodyType !== parsed\.mediaType/);
  assert.equal(seasonChipKind({ unreleased: true }), "coming");
  assert.equal(seasonChipKind({ importing: true }), "importing");
  assert.equal(seasonChipKind({ importing: true, unreleased: true }), "coming");
  assert.equal(seasonChipLabel({ importing: true }), "Importing");
  assert.equal(seasonChipLabel({ unreleased: true }), UNRELEASED_SEASON_CHIP);
  assert.equal(seasonChipLabel({ onDisk: true, unreleased: true }), "Watch");
  assert.equal(seasonChipLabel({}), "Request");
  assert.notEqual(seasonChipLabel({ unreleased: true }), "Request");
  assert.notEqual(seasonChipLabel({ unreleased: true }), "Watch");
  assert.match(UNRELEASED_SEASON_COPY, /not released/i);
  const facts = seasonFactsFrom([siloS03, siloS04], now);
  assert.deepEqual(
    facts.map((f) => `${f.season}:${f.unreleased}:${f.episodeCount}`),
    ["3:false:10", "4:true:0"],
  );
  assert.deepEqual(unreleasedSeasonNumbers([siloS03, siloS04], now), [4]);
  const missing = missingArrRequests([
    {
      id: 10,
      tmdbId: 125988,
      title: "Silo",
      monitored: true,
      added: "2026-09-10T00:00:00.000Z",
      statistics: { episodeFileCount: 20 },
      seasons: [
        { seasonNumber: 3, monitored: true, statistics: { episodeFileCount: 10, episodeCount: 10, previousAiring: "2025-05-01T00:00:00Z" } },
        { seasonNumber: 4, monitored: true, statistics: { episodeFileCount: 0, episodeCount: 1, totalEpisodeCount: 1 } },
      ],
    },
  ]);
  assert.equal(
    missing.some((r) => r.season === 4),
    false,
    "Silo S04 must not infinite-search",
  );
  const releasedMissing = missingArrRequests([
    {
      id: 11,
      tmdbId: 79744,
      title: "The Rookie",
      monitored: true,
      added: "2026-09-10T00:00:00.000Z",
      statistics: { episodeFileCount: 20 },
      seasons: [
        {
          seasonNumber: 5,
          monitored: true,
          statistics: { episodeFileCount: 0, episodeCount: 22, previousAiring: "2023-05-01T00:00:00Z" },
        },
      ],
    },
  ]);
  assert.deepEqual(
    releasedMissing.map((r) => r.season),
    [5],
    "released missing seasons still Request",
  );
  const hit = seerrSearchHit({
    id: 125988,
    mediaType: "tv",
    name: "Silo",
    firstAirDate: "2023-05-05",
    seasons: [siloS03, siloS04],
  });
  assert.deepEqual(hit.unreleasedSeasons, [4]);
  const payload = titleRequestSeasonPayload({
    id: "tmdb-tv-125988",
    season: 4,
    parsed: parseTitleId("tmdb-tv-125988"),
    facts: {
      series: [
        {
          tmdbId: 125988,
          seasons: [{ seasonNumber: 4, statistics: { episodeFileCount: 0, episodeCount: 1 } }],
        },
      ],
      arrIndex: buildArrIndex({
        series: [{ tmdbId: 125988, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 10 } }] }],
      }),
    },
    title: hit,
    honest: { titleId: "tmdb-tv-125988", status: "downloading", engine: "grabbing", reason: "Searching — no file yet" },
  });
  assert.equal(payload.reason, UNRELEASED_SEASON_COPY);
  assert.deepEqual(payload.unreleasedSeasons, [4]);
  assert.notEqual(payload.status, "downloaded");
  const mediaInfoOnlyRequested = seerrSearchHit({
    id: 125988,
    mediaType: "tv",
    name: "Silo",
    seasons: [siloS03, siloS04],
    mediaInfo: { seasons: [{ seasonNumber: 1, episodeCount: 10 }] },
  });
  assert.deepEqual(mediaInfoOnlyRequested.unreleasedSeasons, [4]);
  assert.equal(seerrCatalogSeasons({ seasons: [siloS04], mediaInfo: { seasons: [{ seasonNumber: 1 }] } })[0].seasonNumber, 4);
  const bbHit = seerrSearchHit({
    id: 1396,
    mediaType: "tv",
    name: "Breaking Bad",
    seasons: [
      { seasonNumber: 1, episodeCount: 7, airDate: "2008-01-20" },
      { seasonNumber: 2, episodeCount: 13, airDate: "2009-03-08" },
      { seasonNumber: 5, episodeCount: 16, airDate: "2012-07-15" },
    ],
  });
  const bbPayload = titleRequestSeasonPayload({
    id: "tmdb-tv-1396",
    season: 2,
    parsed: parseTitleId("tmdb-tv-1396"),
    facts: {
      series: [
        {
          tmdbId: 1396,
          seasons: [
            { seasonNumber: 4, statistics: { episodeFileCount: 0, episodeCount: 0, totalEpisodeCount: 13 } },
            { seasonNumber: 5, statistics: { episodeFileCount: 0, episodeCount: 0, totalEpisodeCount: 16 } },
          ],
        },
      ],
      arrIndex: buildArrIndex({ series: [{ tmdbId: 1396, seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 7 } }] }] }),
    },
    title: bbHit,
    honest: { titleId: "tmdb-tv-1396", status: "downloading", engine: "grabbing", reason: "Searching — no file yet" },
  });
  assert.deepEqual(bbPayload.unreleasedSeasons, []);
  assert.notEqual(bbPayload.reason, UNRELEASED_SEASON_COPY);
  const accordion = readFileSync(join(root, "src/components/season-episode-accordion.tsx"), "utf8");
  const titleView = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  assert.match(accordion, /seasonChipLabel/);
  assert.match(accordion, /UNRELEASED_SEASON_COPY/);
  assert.match(titleView, /thisSeasonUnreleased/);
  assert.match(titleView, /UNRELEASED_SEASON_CHIP/);
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
  const seasonLess = seerrRequestRow({
    id: 99,
    type: "tv",
    status: 2,
    createdAt: "2026-09-09T01:00:00.000Z",
    updatedAt: "2026-09-09T01:00:00.000Z",
    seasons: [],
    media: { tmdbId: 1402, status: 3 },
  }, {});
  assert.equal(findExistingSeasonRequest([seasonLess], { mediaType: "tv", tmdb: 1402, season: 2 }), null);
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

test("whole-series grabbing row expands so mixed seasons stay mixed", () => {
  const row = seerrRequestRow(
    {
      id: 11,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }],
      media: { tmdbId: 1408, status: 4 },
    },
    {},
  );
  assert.equal(row.season, undefined);
  assert.deepEqual(row.requestedSeasons, [1, 2]);
  const arrIndex = buildArrIndex({
    series: [
      {
        tmdbId: 1408,
        seasons: [
          { seasonNumber: 1, statistics: { episodeFileCount: 13 } },
          { seasonNumber: 2, statistics: { episodeFileCount: 0 } },
        ],
      },
    ],
  });
  const honest = honestifyRequests([row], {
    arrIndex,
    arrReady: true,
    series: [
      {
        tmdbId: 1408,
        seasons: [
          { seasonNumber: 1, statistics: { episodeFileCount: 13 } },
          { seasonNumber: 2, statistics: { episodeFileCount: 0 } },
        ],
      },
    ],
  });
  assert.equal(honest.find((r) => r.season === 1)?.status, "available");
  assert.equal(honest.find((r) => r.season === 2)?.status, "downloading");
  assert.equal(honest.find((r) => r.season == null), undefined);
});

test("all on-disk seasons hide a whole-show Request row", () => {
  const row = seerrRequestRow(
    {
      id: 12,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }],
      media: { tmdbId: 1408, status: 4 },
    },
    {},
  );
  const series = {
    tmdbId: 1408,
    tvdbId: 81189,
    seasons: [
      { seasonNumber: 1, statistics: { episodeFileCount: 13 } },
      { seasonNumber: 2, statistics: { episodeFileCount: 13 } },
    ],
  };
  const honest = honestifyRequests([row], {
    arrIndex: buildArrIndex({ series: [series] }),
    arrReady: true,
    series: [series],
  });
  assert.equal(honest.length, 1);
  assert.equal(honest[0].status, "available");
});

test("Rick title chips do not fake S05/S09 in from series-in-library", () => {
  const index = buildArrIndex({
    series: [
      {
        tmdbId: 60625,
        tvdbId: 275274,
        seasons: [
          { seasonNumber: 2, statistics: { episodeFileCount: 10 } },
          { seasonNumber: 3, statistics: { episodeFileCount: 10 } },
          { seasonNumber: 4, statistics: { episodeFileCount: 10 } },
          { seasonNumber: 5, statistics: { episodeFileCount: 0 } },
          { seasonNumber: 6, statistics: { episodeFileCount: 10 } },
          { seasonNumber: 9, statistics: { episodeFileCount: 0 } },
        ],
      },
    ],
  });
  const parsed = { mediaType: "tv", tmdb: "60625", tvdb: "275274", titleId: "tmdb-tv-60625" };
  assert.deepEqual(onDiskSeasonsFor(parsed, index), [2, 3, 4, 6]);
  const s5 = titleRequestSeasonPayload({
    id: "jf-103ae87fbbbd9bb920ee3803dcffc570",
    season: 5,
    parsed,
    facts: { arrIndex: index },
    honest: { engine: "downloaded", status: "available", titleId: "tmdb-tv-60625", progress: 100 },
    title: { title: "Rick and Morty", seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  });
  assert.equal(s5.status === "downloaded" || s5.requestStatus === "available", false);
  assert.equal(s5.onDiskSeasons.includes(5), false);
  assert.equal(s5.onDiskSeasons.includes(9), false);
  assert.ok(s5.onDiskSeasons.includes(4));
  const titles = decorateTitlesWithDiskSeasons(
    [{ id: "tmdb-tv-60625", kind: "tv", ids: ["tmdb-tv-60625", "tvdb-275274"] }],
    { arrIndex: index, series: [{ tmdbId: 60625, tvdbId: 275274, seasons: [{ seasonNumber: 5 }, { seasonNumber: 4 }] }] },
  );
  assert.deepEqual(titles[0].onDiskSeasons, [2, 3, 4, 6]);
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
  assert.deepEqual(assembled.pipeline.radarrMissing, ["tmdb-2059"]);
  assert.deepEqual(assembled.pipeline.radarrOrphans, ["tmdb-2059"]);
  assert.deepEqual(assembled.pipeline.radarrUnmonitored, []);
  assert.equal(assembled.requests[0].reason, "Requested — Radarr has no movie yet");
  assert.equal(assembled.requests[0].engine, "grabbing");
  assert.equal(assembled.pipeline.decypharr, 0);
  assert.deepEqual(
    attachRequestTitles(
      [{ titleId: "tmdb-tv-1402", status: "waiting" }],
      { series: [{ tmdbId: 1402, title: "The Walking Dead" }] },
    )[0].title,
    "The Walking Dead",
  );
  assert.deepEqual(
    pipelineMovieGaps({
      seerrRows: [row],
      movies: [{ tmdbId: 2059, hasFile: false, monitored: false, statistics: { movieFileCount: 0 } }],
    }),
    {
      radarrMissing: ["tmdb-2059"],
      radarrOrphans: [],
      radarrUnmonitored: ["tmdb-2059"],
    },
  );
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

test("0-file Sonarr season is honest about the silent 0%", () => {
  const row = seerrRequestRow(
    {
      id: 11,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 1408, status: 3 },
    },
    {},
  );
  assert.equal(row.status, "downloading");
  assert.equal(row.progress, 0);
  const series = {
    id: 2,
    tmdbId: 1408,
    title: "Justified",
    monitored: true,
    statistics: { episodeFileCount: 0 },
    seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } }],
  };
  assert.equal(
    tvRequestReason(row, { series: [], arrSeriesReady: true }),
    "Requested — Sonarr has no series yet",
  );
  assert.equal(tvRequestReason(row, { series: [series], arrSeriesReady: true }), "Searching — no file yet");
  assert.equal(
    tvRequestReason(row, {
      series: [series],
      arrSeriesReady: true,
      dumps: { sonarr: ["Justified"] },
    }),
    IMPORTING_SEASON_COPY,
  );
  assert.equal(
    tvRequestReason(row, {
      series: [series],
      arrSeriesReady: true,
      dumps: { sonarr: ["Justified.2010.S01.1080p.AMZN"] },
    }),
    IMPORTING_SEASON_COPY,
  );
  const expanseS1 = seerrRequestRow(
    {
      id: 12,
      type: "tv",
      status: 2,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
      seasons: [{ seasonNumber: 1 }],
      media: { tmdbId: 63639, status: 3 },
    },
    {},
  );
  const expanse = {
    id: 1,
    tmdbId: 63639,
    title: "The Expanse",
    monitored: true,
    statistics: { episodeFileCount: 6 },
    seasons: [
      { seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } },
      { seasonNumber: 6, monitored: true, statistics: { episodeFileCount: 6 } },
    ],
  };
  assert.equal(
    tvRequestReason(expanseS1, {
      series: [expanse],
      arrSeriesReady: true,
      dumps: { sonarr: ["The Expanse"] },
    }),
    "Searching — no file yet",
  );
  assert.equal(
    tvRequestReason(expanseS1, {
      series: [expanse],
      arrSeriesReady: true,
      dumps: { sonarr: ["The Expanse", "The Expanse S06 1080p AMZN WEBRip"] },
    }),
    "Searching — no file yet",
  );
  assert.equal(
    tvRequestReason(expanseS1, {
      series: [expanse],
      arrSeriesReady: true,
      dumps: { sonarr: ["The Expanse"] },
      torrents: [{ name: "The Expanse S06 1080p AMZN WEBRip DDP5 1 x264" }],
    }),
    "Searching — no file yet",
  );
  assert.equal(
    tvRequestReason(expanseS1, {
      series: [expanse],
      arrSeriesReady: true,
      dumps: { sonarr: ["The Expanse"] },
      torrents: [{ name: "The Expanse S01 1080p" }],
    }),
    IMPORTING_SEASON_COPY,
  );
  assert.equal(
    tvRequestReason(expanseS1, {
      series: [expanse],
      arrSeriesReady: true,
      dumps: { sonarr: ["The Expanse", "The Expanse S01 1080p AMZN WEBRip"] },
    }),
    IMPORTING_SEASON_COPY,
  );
  const honest = honestifyRequests([row], {
    series: [series],
    arrSeriesReady: true,
    arrReady: true,
    dumps: { sonarr: ["Justified"] },
    arrIndex: buildArrIndex({ series: [series] }),
  });
  assert.equal(honest[0].status, "downloading");
  assert.equal(honest[0].progress, 0);
  assert.equal(honest[0].reason, IMPORTING_SEASON_COPY);
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

test("season-null TV ghost is dropped when a season request already exists", () => {
  const seerr = [
    {
      titleId: "tmdb-tv-63639",
      mediaType: "tv",
      season: 1,
      status: "downloading",
      engine: "grabbing",
      tmdb: 63639,
    },
    {
      titleId: "tmdb-tv-63639",
      mediaType: "tv",
      season: 3,
      status: "downloading",
      engine: "grabbing",
      tmdb: 63639,
    },
  ];
  const extras = seerrMediaGhostRows([
    {
      id: 2,
      mediaType: "tv",
      tmdbId: 63639,
      status: 3,
      seasons: [],
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
  ]);
  assert.ok(extras.some((r) => r.titleId === "tmdb-tv-63639" && r.season == null));
  const merged = mergeUnfinishedRows(seerr, extras, {});
  const expanse = merged.filter((r) => r.titleId === "tmdb-tv-63639");
  assert.deepEqual(
    expanse.map((r) => r.season).sort((a, b) => a - b),
    [1, 3],
  );
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
  assert.match(progress, /resolveParsedTitle/);
  assert.match(lookup, /resolveParsedTitle/);
  assert.match(readFileSync(join(root, "scripts/reelos-seerr.mjs"), "utf8"), /Could not map that title to TMDB/);
  const titleView = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  const accordion = readFileSync(join(root, "src/components/season-episode-accordion.tsx"), "utf8");
  assert.match(progress, /onDiskSeasons/);
  assert.match(lookup, /bodyType/);
  assert.match(titleView, /showHashAdapter/);
  assert.match(titleView, /requestTitleIdForPage/);
  assert.match(titleView, />\s*Watch\s*</);
  assert.match(accordion, /seasonChipLabel/);
  assert.match(accordion, /· \$\{chip\}/);
  assert.doesNotMatch(titleView, /· in/);
  assert.match(accordion, /Could not load seasons from Seerr/);
  assert.match(titleView, /titleMatchesId/);
  assert.match(titleView, /Series-in-Jellyfin is not this season/);
  assert.match(
    titleView,
    /series\s*\?\s*thisSeasonOnBox\s*:\s*Boolean\(resolved\.jellyfinId\)\s*\|\|\s*inJellyfin\s*\|\|\s*inLibrary/,
  );
  assert.doesNotMatch(titleView, /inJellyfin \|\| inLibrary \|\| seasonReady/);
  assert.doesNotMatch(titleView, /Play in Jellyfin/);
  assert.match(titleView, /Unknown on this box/);
  assert.match(titleView, /if \(!seasonsLoading\)/);
  assert.match(titleView, /seasonErr \|\| "Seerr did not find that title"/);
  assert.match(titleView, /series && !onBox/);
  assert.match(lookup, /lookupPayloadForId/);
  assert.match(lookup, /findLibraryTitle/);
  assert.match(lookup, /repairHashTitles/);
});

test("GET /api/request plugins honestify Seerr rows against library and *arr", () => {
  const progress = readFileSync(join(root, "scripts/reelos-request-progress-plugin.mjs"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const seerr = readFileSync(join(root, "scripts/reelos-seerr.mjs"), "utf8");
  const sync = readFileSync(join(root, "src/lib/use-sync-requests.ts"), "utf8");
  const requestsView = readFileSync(join(root, "src/components/requests-view.tsx"), "utf8");
  assert.match(progress, /assembleRequestPayload/);
  assert.match(progress, /attachSeerrDetailTitles/);
  assert.match(lookup, /attachSeerrDetailTitles/);
  assert.match(progress, /loadPresenceFacts/);
  assert.match(progress, /recover/);
  assert.match(progress, /listRecoverTargets/);
  assert.match(progress, /seerrMediaGhostRows/);
  assert.match(progress, /deferred: true/);
  assert.match(progress, /const recoverNote = maybeRecover/);
  assert.doesNotMatch(progress, /await maybeRecover/);
  assert.doesNotMatch(progress, /force: true/);
  assert.match(progress, /ms: 4000/);
  assert.match(progress, /spawnWireImport/);
  assert.match(progress, /maybeImportAvailable/);
  assert.match(progress, /mergeRequestListTitles/);
  assert.match(lookup, /mergeRequestListTitles/);
  assert.match(seerr, /mergeRequestListTitles/);
  assert.match(requestsView, /tvSeasonChips/);
  assert.match(lookup, /scheduleBoxProbe/);
  assert.match(sync, /\/api\/request\?recover=1/);
  assert.doesNotMatch(sync, /recoveredOnce/);
  assert.match(requestsView, /requestShowsRetry/);
  assert.match(progress, /titleRequestSeasonPayload/);
  assert.match(seerr, /honest\?\.reason/);
  assert.match(lookup, /assembleRequestPayload/);
  assert.match(lookup, /kickArrRecover/);
  assert.match(lookup, /mediaType: parsed.mediaType/);
  assert.match(lookup, /seerr reuse/);
  assert.match(progress, /dispatchRequestGet/);
  assert.match(lookup, /if \(method === "GET"\) return false/);
  assert.doesNotMatch(lookup, /Jellyfin is only on localhost, not the LAN/);
  const status = readFileSync(join(root, "scripts/reelos-request-status.mjs"), "utf8");
  assert.match(status, /Never `ls` dump trees on FUSE/);
  assert.match(status, /export function listDirNames/);
  assert.match(seerr, /Jellyfin library hit \(movie TMDB\)/);
  assert.match(seerr, /Radarr hasFile \/ Sonarr season episodeFileCount/);
  assert.match(seerr, /Ghost: Seerr AVAILABLE/);
  assert.match(seerr, /Requested — Radarr has no movie yet/);
  assert.match(seerr, /Searching — no file yet/);
  assert.match(seerr, /tvRequestReason/);
  assert.match(seerr, /On disk, importing/);
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

test("Discover browse drops titles this box already has", () => {
  const hits = [
    { id: 157336, mediaType: "movie", title: "Interstellar", releaseDate: "2014-11-07", mediaInfo: { status: 5 } },
    { id: 27205, mediaType: "movie", title: "Inception", releaseDate: "2010-07-16", mediaInfo: { status: 1 } },
    { id: 155, mediaType: "movie", title: "The Dark Knight", releaseDate: "2008-07-18", mediaInfo: { status: 4 } },
    { id: 550, mediaType: "movie", title: "Fight Club", releaseDate: "1999-10-15", mediaInfo: { status: 2 } },
  ];
  const out = mapSeerrDiscoverResults(hits, {
    mediaType: "movie",
    excludeIds: new Set(["tmdb-27205"]),
  });
  assert.deepEqual(
    out.map((t) => t.id),
    ["tmdb-550"],
  );
  assert.equal(seerrAlreadyHave({ mediaInfo: { status: 5 } }), true);
  assert.equal(seerrAlreadyHave({ mediaInfo: { status: 1 } }), false);
});

test("Discover pick tonight has no John Wick if it is on Home", () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  const hits = [
    { id: 245891, mediaType: "movie", title: "John Wick", releaseDate: "2014-10-24" },
    { id: 2059, mediaType: "movie", title: "National Treasure", releaseDate: "2004-11-19" },
    { id: 550, mediaType: "movie", title: "Fight Club", releaseDate: "1999-10-15" },
  ];
  const home = [
    {
      id: "jf-wick",
      kind: "movie",
      title: "John Wick",
      year: 2014,
      ids: ["jf-wick"],
      jellyfinId: "wick",
    },
    {
      id: "tmdb-2059",
      kind: "movie",
      title: "National Treasure",
      year: 2004,
      ids: ["tmdb-2059"],
      jellyfinId: "nt",
    },
  ];
  const owned = discoverOwnedIndex(home);
  assert.equal(discoverTitleIsOwned({ id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie" }, owned), true);
  const picks = mapSeerrDiscoverResults(hits, { mediaType: "movie", excludeIds: owned, now });
  assert.deepEqual(
    picks.map((t) => t.id),
    ["tmdb-550"],
  );
  const search = mapSeerrSearchResults(hits, { q: "john", excludeOwned: owned });
  assert.equal(
    search.some((t) => /john wick$/i.test(t.title) && t.year === 2014),
    false,
  );
});

test("AbortError / timeout is a retryable lookup error, not an empty shelf", () => {
  const abort = new Error("The operation was aborted");
  abort.name = "AbortError";
  assert.equal(lookupFailureMessage(abort), "Seerr lookup timed out. Try the search again.");
  assert.match(lookupFailureMessage(new Error("timeout")), /timed out/);
  assert.deepEqual(mapSeerrSearchResults([], { q: "interstellar" }), []);
});

test("Discover like boosts similar titles ahead of the rest of pick tonight", () => {
  const now = Date.parse("2026-09-13T00:00:00Z");
  const hits = [
    { id: 242582, mediaType: "movie", title: "Nightcrawler", releaseDate: "2014-10-31" },
    { id: 273481, mediaType: "movie", title: "Sicario", releaseDate: "2015-09-17" },
    { id: 198663, mediaType: "movie", title: "The Maze Runner", releaseDate: "2014-09-10" },
  ];
  const picks = mapSeerrDiscoverResults(hits, {
    mediaType: "movie",
    now,
    boostIds: ["tmdb-273481"],
  });
  assert.equal(picks[0].id, "tmdb-273481");
  assert.ok(picks.some((t) => t.id === "tmdb-242582"));
});

test("Discover pick tonight drops unreleased 2026 junk", () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  assert.equal(discoverHitReleased({ title: "Moon", releaseDate: "2009-07-17" }, now), true);
  assert.equal(discoverHitReleased({ title: "Mutiny", releaseDate: "2026-11-06" }, now), false);
  assert.equal(discoverHitReleased({ name: "Paradise Hotel", firstAirDate: "2026-12-01" }, now), false);
  assert.equal(discoverHitReleased({ title: "Moana", releaseDate: "2026-11-25" }, now), false);
  const picks = mapSeerrDiscoverResults(
    [
      { id: 1, title: "Mutiny", releaseDate: "2026-11-06", mediaType: "movie" },
      { id: 17431, title: "Moon", releaseDate: "2009-07-17", mediaType: "movie" },
      { id: 2, title: "Colony", releaseDate: "2027-01-01", mediaType: "movie" },
    ],
    { mediaType: "movie", limit: 16, now },
  );
  assert.deepEqual(
    picks.map((t) => t.id),
    ["tmdb-17431"],
  );
});

test("Discover is finishing / pick tonight — library stays on Home", () => {
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const ping = readFileSync(join(root, "scripts/wizard-honesty.mjs"), "utf8");
  const title = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  assert.doesNotMatch(discover, /label="On this box"/);
  assert.match(discover, /Titles on this box live on Home/);
  assert.match(discover, /Finishing/);
  assert.match(discover, /Pick tonight/);
  assert.match(discover, /filterDiscoverCatalog/);
  assert.match(discover, /scope=discover/);
  assert.match(discover, /Titles on this box live on Home/);
  assert.match(discover, /collapseHomeRequestCards/);
  assert.match(discover, /Looking up movies and shows/);
  assert.match(discover, /lookupErr/);
  assert.match(discover, /\/api\/discover/);
  assert.match(home, /On this box/);
  assert.match(lookup, /overlayLookupWithLibrary/);
  assert.match(discover, /onVote/);
  assert.match(discover, /useCurator/);
  assert.match(discover, /\/api\/discover/);
  assert.match(readFileSync(join(root, "src/components/title-card.tsx"), "utf8"), /Not interested/);
  assert.match(readFileSync(join(root, "src/components/title-card.tsx"), "utf8"), /aria-label="Like"/);
  assert.match(discover, /People/);
  assert.match(discover, /Collections/);
  assert.match(title, /More like this/);
  assert.match(title, /\/api\/similar/);
  assert.match(lookup, /\/api\/curator/);
  assert.match(lookup, /\/api\/similar/);
  assert.match(lookup, /\/api\/person/);
  assert.match(lookup, /\/api\/collection/);
  assert.match(lookup, /mapSeerrSearchResults/);
  assert.match(lookup, /mapSeerrDiscoverResults/);
  assert.match(lookup, /discoverOwnedIndex/);
  assert.match(lookup, /searchParams.get\("scope"\)/);
  assert.match(lookup, /\/api\/discover/);
  assert.match(lookup, /discover\/movies\?page=/);
  assert.match(lookup, /discoverBrowseSeerrPath/);
  assert.match(lookup, /searchParams.get\("kind"\)/);
  assert.match(discover, /to="\/discover\/movies"/);
  assert.match(discover, /to="\/discover\/shows"/);
  const browse = readFileSync(join(root, "src/components/discover-browse-view.tsx"), "utf8");
  assert.match(browse, /\/api\/discover\?/);
  assert.match(browse, /IntersectionObserver/);
  assert.match(browse, /filterDiscoverCatalog/);
  assert.match(title, /resolved.jellyfinId/);
  assert.match(ping, /"User-Agent": "ReelOS"/);
  assert.match(lookup, /buildSeerrAddPayload/);
  assert.match(lookup, /lookupFailureMessage/);
  assert.match(lookup, /ms: 45000/);
  assert.doesNotMatch(lookup, /seasons = .*["']all["']/);
  assert.match(title, /season: series \? season/);
  assert.match(home, /On this box/);
});

test("search overlay attaches JF Watch and keeps a JF-only name", () => {
  const passengers = {
    id: "tmdb-274870",
    kind: "movie",
    title: "Passengers",
    year: 2016,
    ids: ["tmdb-274870"],
  };
  const jfPassengers = {
    id: "tmdb-274870",
    kind: "movie",
    title: "Passengers",
    year: 2016,
    ids: ["tmdb-274870", "jf-de7507144367"],
    jellyfinId: "de7507144367fccb43412273ba23ab8a",
  };
  const jfOnly = {
    id: "jf-abc",
    kind: "movie",
    title: "House Cut",
    year: 1999,
    ids: ["jf-abc"],
    jellyfinId: "abc",
  };
  const overlaid = overlayLookupWithLibrary([passengers], [jfPassengers, jfOnly], "Passengers");
  assert.equal(overlaid[0].id, "tmdb-274870");
  assert.equal(overlaid[0].jellyfinId, "de7507144367fccb43412273ba23ab8a");
  assert.equal(overlaid[0].inLibrary, true);
  const only = overlayLookupWithLibrary([], [jfOnly], "house cut");
  assert.equal(only.length, 1);
  assert.equal(only[0].id, "jf-abc");
  const empty = overlayLookupWithLibrary([], [jfOnly], "passengers");
  assert.deepEqual(empty, []);
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
  assert.doesNotMatch(caddy, /handle \/play\*/);
  assert.match(caddy, /ReelOS shell player/);
  assert.match(caddy, /handle_errors/);
  assert.match(caddy, /Updating ReelOS/);
  assert.doesNotMatch(caddy, /<<HTML/);
});

test("needsRequestTitle treats tmdb-2059 as unnamed", () => {
  assert.equal(needsRequestTitle({ titleId: "tmdb-2059" }), true);
  assert.equal(needsRequestTitle({ titleId: "tmdb-2059", title: "tmdb-2059" }), true);
  assert.equal(needsRequestTitle({ titleId: "tmdb-2059", title: "National Treasure" }), false);
});

test("attachSeerrDetailTitles names National Treasure from Seerr movie detail", async () => {
  clearRequestTitleCache();
  const calls = [];
  const seerrFetch = async (path) => {
    calls.push(path);
    return {
      ok: true,
      json: {
        id: 2059,
        title: "National Treasure",
        releaseDate: "2004-11-19",
        posterPath: "/nt.jpg",
        mediaType: "movie",
      },
    };
  };
  const { rows, titles } = await attachSeerrDetailTitles(
    [{ id: "seerr-9", titleId: "tmdb-2059", status: "downloading", progress: 0 }],
    { seerrFetch, key: "x", now: 1_000 },
  );
  assert.equal(rows[0].title, "National Treasure");
  assert.equal(titles[0].title, "National Treasure");
  assert.equal(titles[0].id, "tmdb-2059");
  assert.equal(calls[0], "/api/v1/movie/2059");
  const again = await attachSeerrDetailTitles(rows, { seerrFetch, key: "x", now: 2_000 });
  assert.equal(calls.length, 1);
  assert.equal(again.rows[0].title, "National Treasure");
});

test("attachSeerrDetailTitles fills a TMDB poster for a named grabbing row", async () => {
  clearRequestTitleCache();
  const seerrFetch = async () => ({
    ok: true,
    json: {
      id: 66732,
      name: "Stranger Things",
      firstAirDate: "2016-07-15",
      posterPath: "/st.jpg",
      mediaType: "tv",
    },
  });
  const { titles } = await attachSeerrDetailTitles(
    [{ id: "seerr-st", titleId: "tmdb-tv-66732", title: "Stranger Things", status: "downloading", progress: 0 }],
    { seerrFetch, key: "x", now: 1_000 },
  );
  assert.equal(titles[0].title, "Stranger Things");
  assert.match(String(titles[0].poster), /image\.tmdb\.org.*\/st\.jpg/);
});

test("search maps people and collections without turning them into movies", () => {
  const hits = [
    { id: 6384, mediaType: "person", name: "Keanu Reeves", knownForDepartment: "Acting", profilePath: "/k.jpg" },
    { id: 404609, mediaType: "collection", name: "John Wick Collection", posterPath: "/c.jpg" },
    { id: 324552, mediaType: "movie", title: "John Wick: Chapter 2", releaseDate: "2017-02-08" },
  ];
  const people = mapSeerrPersonHits(hits);
  const collections = mapSeerrCollectionHits(hits);
  const titles = mapSeerrSearchResults(hits, { q: "john wick" });
  assert.equal(people[0].tmdbId, 6384);
  assert.equal(people[0].name, "Keanu Reeves");
  assert.equal(collections[0].tmdbId, 404609);
  assert.deepEqual(
    titles.map((t) => t.id),
    ["tmdb-324552"],
  );
  assert.equal(normalizeMediaType("person"), null);
  assert.equal(normalizeMediaType("collection"), null);
});

test("person credits keep owned library titles even if Discover hid them", () => {
  const person = mapSeerrPersonDetail(
    {
      id: 6384,
      name: "Keanu Reeves",
      combinedCredits: {
        cast: [
          { id: 245891, title: "John Wick", releaseDate: "2014-10-24", mediaType: "movie" },
          { id: 550, title: "Fight Club", releaseDate: "1999-10-15", mediaType: "movie" },
        ],
      },
    },
    {
      libraryTitles: [{ id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie", jellyfinId: "wick" }],
      excludeHidden: { hidden: ["tmdb-245891", "tmdb-550"] },
    },
  );
  assert.deepEqual(
    person.credits.map((t) => t.id),
    ["tmdb-245891"],
    "John Wick stays on the actor page because it is on this box",
  );
  assert.equal(person.credits[0].inLibrary, true);
});

test("Discover browse paths are genre/category pages excluding owned", () => {
  assert.equal(discoverBrowseKind("movies"), "movie");
  assert.equal(discoverBrowseKind("shows"), "tv");
  assert.equal(discoverBrowseSeerrPath({ kind: "movie", page: 2 }), "/api/v1/discover/movies?page=2");
  assert.equal(discoverBrowseSeerrPath({ kind: "tv", genre: "18", page: 3 }), "/api/v1/discover/tv/genre/18?page=3");
  assert.equal(
    discoverBrowseSeerrPath({ kind: "movie", category: "upcoming" }),
    "/api/v1/discover/movies/upcoming?page=1",
  );
  assert.match(discoverBrowseSeerrPath({ kind: "movie", category: "trending" }), /trending/);
  assert.equal(mapSeerrGenres([], FALLBACK_MOVIE_GENRES)[0].name, "Action");
});


