import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  kickArrRecover,
  kickTvSeasonRecover,
  listMissingRecoverTargets,
  loadPresenceFacts,
  planArrPostRecover,
  planTvPostRecover,
  resetPresenceFactsCache,
  waitForArrRow,
} from "./reelos-request-status.mjs";

test("presence facts read the JF shelf cache and *arr hasFile index", async () => {
  resetPresenceFactsCache();
  const dir = join(tmpdir(), `reelos-facts-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "library-shelf.json");
  writeFileSync(
    file,
    JSON.stringify({
      at: 1,
      complete: true,
      titles: [{ id: "tmdb-1593", kind: "movie", ids: ["tmdb-1593"] }],
    }),
  );
  const facts = await loadPresenceFacts({
    force: true,
    libraryFile: file,
    fetchArr: async (url) => {
      if (String(url).includes("/movie")) return [{ tmdbId: 1593, hasFile: true }];
      return [
        {
          tmdbId: 1402,
          seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 6 } }],
        },
      ];
    },
  });
  assert.equal(facts.libraryTitles[0].id, "tmdb-1593");
  assert.equal(facts.arrIndex.movieHasFile.has("1593"), true);
  assert.equal(facts.arrIndex.seasonHasFile.has("tmdb:1402:1"), true);
  assert.equal(facts.arrReady, true);
  assert.ok(Array.isArray(facts.series));
  assert.ok(Array.isArray(facts.dumps.sonarr));
});

test("TV POST recover searches a missing season and always imports", () => {
  assert.deepEqual(planTvPostRecover({ mediaType: "movie" }), { search: false, import: false });
  assert.deepEqual(planTvPostRecover({ mediaType: "tv", season: 1, arrHasSeasonFile: false }), {
    search: true,
    import: true,
  });
  assert.deepEqual(planTvPostRecover({ mediaType: "tv", season: 1, arrHasSeasonFile: true }), {
    search: false,
    import: true,
  });
});

test("movie POST recover MoviesSearchs a 0-file title (Interstellar / John Wick)", () => {
  assert.deepEqual(planArrPostRecover({ mediaType: "movie", arrHasFile: false }), {
    search: true,
    import: true,
  });
  assert.deepEqual(planArrPostRecover({ mediaType: "movie", arrHasFile: true }), {
    search: false,
    import: true,
  });
  assert.deepEqual(planArrPostRecover({ mediaType: "tv", season: 1, arrHasFile: false }), {
    search: true,
    import: true,
  });
});

test("GET recover lists Interstellar + B99 S01 when *arr has 0 files", () => {
  const targets = listMissingRecoverTargets({
    movies: [
      { tmdbId: 157336, title: "Interstellar", monitored: true, hasFile: false, statistics: { movieFileCount: 0 } },
      { tmdbId: 245891, title: "John Wick", monitored: true, hasFile: false },
      { tmdbId: 1593, title: "Night at the Museum", hasFile: true, statistics: { movieFileCount: 1 } },
    ],
    series: [
      {
        tmdbId: 48891,
        title: "Brooklyn Nine-Nine",
        monitored: true,
        seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } }],
      },
      {
        tmdbId: 1402,
        title: "The Walking Dead",
        monitored: true,
        seasons: [{ seasonNumber: 1, monitored: false, statistics: { episodeFileCount: 0 } }],
      },
    ],
  });
  assert.deepEqual(
    targets.map((t) => `${t.mediaType}:${t.tmdb}:${t.season ?? ""}`),
    ["tv:48891:1", "movie:157336:", "movie:245891:"],
  );
});

test("kickTvSeasonRecover SeasonSearch when Sonarr has TWD S01 with 0 files", async () => {
  const posts = [];
  const result = await kickTvSeasonRecover({
    tmdb: 1402,
    season: 1,
    sonarrKey: "test",
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      if (String(url).includes("/series") && (opts.method || "GET") === "GET") {
        return [
          {
            id: 9,
            tmdbId: 1402,
            title: "The Walking Dead",
            seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }],
          },
        ];
      }
      if (String(url).includes("/command")) {
        posts.push(opts.body);
        return { ok: true };
      }
      return null;
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.seriesId, 9);
  assert.equal(result.importSpawned, true);
  assert.equal(posts[0]?.name, "SeasonSearch");
  assert.equal(posts[0]?.seasonNumber, 1);
  assert.equal(posts[0]?.seriesId, 9);
});

test("kickTvSeasonRecover does not search a season that already has files", async () => {
  const posts = [];
  const result = await kickTvSeasonRecover({
    tmdb: 1402,
    season: 1,
    sonarrKey: "test",
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      if (String(url).includes("/series")) {
        return [
          {
            id: 9,
            tmdbId: 1402,
            seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 6 } }],
          },
        ];
      }
      if (String(url).includes("/command")) {
        posts.push(opts.body);
        return { ok: true };
      }
      return null;
    },
  });
  assert.equal(result.searched, false);
  assert.equal(posts.length, 0);
  assert.equal(result.importSpawned, true);
});

test("kickArrRecover MoviesSearch when Radarr has Interstellar with 0 files", async () => {
  const posts = [];
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 157336,
    radarrKey: "test",
    waitTries: 1,
    waitMs: 0,
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      if (String(url).includes("/movie") && (opts.method || "GET") === "GET") {
        return [{ id: 4, tmdbId: 157336, title: "Interstellar", hasFile: false }];
      }
      if (String(url).includes("/command")) {
        posts.push(opts.body);
        return { ok: true };
      }
      return null;
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.movieId, 4);
  assert.equal(result.command, "MoviesSearch");
  assert.deepEqual(posts[0], { name: "MoviesSearch", movieIds: [4] });
});

test("kickArrRecover waits for Seerr to land Interstellar in Radarr", async () => {
  let lookups = 0;
  const posts = [];
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 157336,
    radarrKey: "test",
    waitTries: 4,
    waitMs: 0,
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      if (String(url).includes("/movie") && (opts.method || "GET") === "GET") {
        lookups += 1;
        if (lookups < 3) return [];
        return [{ id: 4, tmdbId: 157336, hasFile: false }];
      }
      if (String(url).includes("/command")) {
        posts.push(opts.body);
        return { ok: true };
      }
      return null;
    },
  });
  assert.ok(lookups >= 3);
  assert.equal(result.searched, true);
  assert.equal(posts[0]?.name, "MoviesSearch");
});

test("waitForArrRow returns null when *arr never gets the title", async () => {
  const hit = await waitForArrRow({
    url: "http://127.0.0.1:7878/api/v3/movie",
    key: "test",
    tries: 2,
    delayMs: 0,
    match: (m) => String(m?.tmdbId) === "157336",
    fetchArr: async () => [],
  });
  assert.equal(hit, null);
});
