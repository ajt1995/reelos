import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  kickArrRecover,
  kickTvSeasonRecover,
  listMissingRecoverTargets,
  listRecoverTargets,
  listSeerrOrphanMovieTargets,
  listUnmonitoredMovieRecoverTargets,
  loadPresenceFacts,
  planArrPostRecover,
  planTvPostRecover,
  resetPresenceFactsCache,
  waitForArrRow,
  decypharrClientMissing,
  pickFallbackProfile,
  hybridQualityShouldAllow,
  commandPosted,
  recoverKickOk,
  pickRadarrLookupMovie,
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
      if (String(url).includes("/downloadclient")) return [];
      if (String(url).includes("/movie")) return [{ tmdbId: 1593, hasFile: true }];
      if (String(url).includes("/torrents")) return [];
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

test("empty command body is not a queued search", () => {
  assert.equal(commandPosted(null), false);
  assert.equal(commandPosted({ ok: true, empty: true }), false);
  assert.equal(commandPosted({ ok: true }), false);
  assert.equal(commandPosted({ id: 9, name: "MoviesSearch" }), true);
  assert.equal(recoverKickOk({ wantedSearch: true, searched: false, command: null }), false);
  assert.equal(recoverKickOk({ wantedSearch: true, searched: true, command: "MoviesSearch" }), true);
  assert.equal(recoverKickOk({ wantedSearch: false, searched: false }), true);
  assert.equal(recoverKickOk({ wantedSearch: true, searched: true, command: "MoviesSearch", grabPath: { missing: true } }), false);
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
        return { id: 1, name: "SeasonSearch" };
      }
      return null;
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.ok, true);
  assert.equal(result.seriesId, 9);
  assert.equal(result.importSpawned, true);
  assert.equal(posts[0]?.name, "SeasonSearch");
  assert.equal(posts[0]?.seasonNumber, 1);
  assert.equal(posts[0]?.seriesId, 9);
});

test("Ultra-HD 2160p-only falls back to Any so EZTV 720p can grab", () => {
  assert.equal(hybridQualityShouldAllow("WEBDL-720p"), true);
  assert.equal(hybridQualityShouldAllow("SDTV"), false);
  const ultra = {
    id: 6,
    name: "Ultra-HD",
    items: [
      { quality: { name: "WEBDL-720p" }, allowed: false },
      { quality: { name: "WEBDL-2160p" }, allowed: true },
    ],
  };
  const any = {
    id: 1,
    name: "Any",
    items: [{ quality: { name: "WEBDL-720p" }, allowed: true }],
  };
  const fb = pickFallbackProfile([ultra, any], 6);
  assert.equal(fb.reason, "any");
  assert.equal(fb.id, 1);
  assert.equal(decypharrClientMissing([]), true);
  assert.equal(
    decypharrClientMissing([
      {
        implementation: "QBittorrent",
        fields: [
          { name: "host", value: "decypharr" },
          { name: "port", value: 8282 },
        ],
      },
    ]),
    false,
  );
  assert.equal(
    decypharrClientMissing([
      {
        enable: false,
        implementation: "QBittorrent",
        fields: [
          { name: "host", value: "decypharr" },
          { name: "port", value: 8282 },
        ],
      },
    ]),
    true,
  );
});

test("kickArrRecover POSTs Decypharr client and Any profile before SeasonSearch", async () => {
  const calls = [];
  const result = await kickTvSeasonRecover({
    tmdb: 48891,
    season: 1,
    sonarrKey: "test",
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      calls.push({ method, url, body: opts.body });
      if (String(url).includes("/series") && method === "GET") {
        return [
          {
            id: 3,
            tmdbId: 48891,
            qualityProfileId: 6,
            seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }],
          },
        ];
      }
      if (String(url).includes("/downloadclient") && method === "GET") return [];
      if (String(url).includes("/qualityprofile") && method === "GET") {
        return [
          {
            id: 6,
            name: "Ultra-HD",
            items: [
              { quality: { name: "WEBDL-720p" }, allowed: false },
              { quality: { name: "WEBDL-2160p" }, allowed: true },
            ],
          },
          { id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] },
        ];
      }
      if (String(url).includes("/command")) return { id: 1, name: "SeasonSearch" };
      return { ok: true };
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.ok, true);
  assert.equal(result.seriesId, 3);
  assert.equal(result.grabPath?.clientAdded, true);
  assert.ok(result.grabPath?.profileWidened === true || result.grabPath?.profileFallback === "any");
  const clientPost = calls.find((c) => c.url.includes("/downloadclient") && c.method === "POST");
  assert.equal(clientPost?.body?.name, "ReelOS-Decypharr");
  const search = calls.find((c) => c.url.includes("/command"));
  assert.equal(search?.body?.name, "SeasonSearch");
  const searchIdx = calls.indexOf(search);
  const clientIdx = calls.indexOf(clientPost);
  assert.ok(clientIdx >= 0 && clientIdx < searchIdx);
  const widened = calls.some((c) => String(c.url).includes("/qualityprofile/6") && c.method === "PUT");
  const seriesPut = calls.find((c) => String(c.url).includes("/series/3") && c.method === "PUT");
  assert.ok(widened || seriesPut?.body?.qualityProfileId === 1);
});

test("recover does not claim failed Sonarr writes succeeded", async () => {
  const result = await kickTvSeasonRecover({
    tmdb: 48891,
    season: 1,
    sonarrKey: "test",
    waitTries: 1,
    waitMs: 0,
    spawnImport: () => false,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      if (String(url).includes("/series") && method === "GET") {
        return [
          {
            id: 3,
            tmdbId: 48891,
            qualityProfileId: 6,
            seasons: [{ seasonNumber: 1, statistics: { episodeFileCount: 0 } }],
          },
        ];
      }
      if (String(url).includes("/downloadclient") && method === "GET") return [];
      if (String(url).includes("/qualityprofile") && method === "GET") {
        return [
          {
            id: 6,
            name: "Ultra-HD",
            items: [
              { quality: { name: "WEBDL-720p" }, allowed: false },
              { quality: { name: "WEBDL-2160p" }, allowed: true },
            ],
          },
          { id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] },
        ];
      }
      return null;
    },
  });
  assert.equal(result.searched, false);
  assert.equal(result.ok, false);
  assert.equal(result.command, null);
  assert.equal(result.importSpawned, false);
  assert.equal(result.grabPath?.clientAdded, false);
  assert.equal(result.grabPath?.profileWidened, false);
  assert.equal(result.grabPath?.profileFallback, "failed");
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
        return { id: 4, name: "MoviesSearch" };
      }
      return null;
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.ok, true);
  assert.equal(result.movieId, 4);
  assert.equal(result.command, "MoviesSearch");
  assert.deepEqual(posts[0], { name: "MoviesSearch", movieIds: [4] });
});

test("kickArrRecover does not claim success after an empty MoviesSearch 2xx", async () => {
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
      if (String(url).includes("/command")) return { ok: true };
      return null;
    },
  });
  assert.equal(result.searched, false);
  assert.equal(result.ok, false);
  assert.equal(result.command, null);
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
        return { id: 4, name: "MoviesSearch" };
      }
      return null;
    },
  });
  assert.ok(lookups >= 3);
  assert.equal(result.searched, true);
  assert.equal(result.ok, true);
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

test("recover includes Seerr movie orphans that Radarr never grew", () => {
  const orphans = listSeerrOrphanMovieTargets({
    seerrRows: [
      { titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059 },
      { titleId: "tmdb-157336", mediaType: "movie", tmdb: 157336 },
    ],
    movies: [{ tmdbId: 157336, hasFile: false }],
  });
  assert.deepEqual(
    orphans.map((t) => t.tmdb),
    [2059],
  );
  // A row Seerr already calls available is in the library: recover must not re-add + re-grab it.
  assert.deepEqual(
    listSeerrOrphanMovieTargets({
      seerrRows: [
        { titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059, status: "available", engine: "downloaded" },
        { titleId: "tmdb-603", mediaType: "movie", tmdb: 603, status: "available", progress: 100 },
        { titleId: "tmdb-604", mediaType: "movie", tmdb: 604, status: "downloading" },
      ],
      movies: [],
    }).map((t) => t.tmdb),
    [604],
  );
  const targets = listRecoverTargets({
    series: [],
    movies: [{ tmdbId: 157336, monitored: true, hasFile: false, statistics: { movieFileCount: 0 } }],
    seerrRows: [{ titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059 }],
  });
  // Interstellar is sitting 0-file in Radarr but nobody requested it this recover.
  assert.deepEqual(
    targets.map((t) => `${t.mediaType}:${t.tmdb}`),
    ["movie:2059"],
  );
});

test("recover with Seerr rows does not MoviesSearch the whole Radarr backlog", () => {
  const targets = listRecoverTargets({
    series: [
      {
        tmdbId: 48891,
        title: "Brooklyn Nine-Nine",
        monitored: true,
        seasons: [{ seasonNumber: 1, monitored: true, statistics: { episodeFileCount: 0 } }],
      },
    ],
    movies: [
      { tmdbId: 157336, title: "Interstellar", monitored: true, hasFile: false, statistics: { movieFileCount: 0 } },
      { tmdbId: 245891, title: "John Wick", monitored: true, hasFile: false },
      { tmdbId: 2059, title: "National Treasure", monitored: true, hasFile: false, statistics: { movieFileCount: 0 } },
    ],
    seerrRows: [{ titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059, status: "downloading" }],
  });
  assert.deepEqual(
    targets.map((t) => `${t.mediaType}:${t.tmdb}`),
    ["movie:2059"],
  );
});

test("recover monitors an unmonitored National Treasure then MoviesSearchs", async () => {
  const calls = [];
  const movie = {
    id: 12,
    tmdbId: 2059,
    title: "National Treasure",
    hasFile: false,
    monitored: false,
    qualityProfileId: 1,
  };
  assert.deepEqual(
    listUnmonitoredMovieRecoverTargets({
      seerrRows: [{ titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059, status: "downloading" }],
      movies: [movie],
    }).map((t) => t.tmdb),
    [2059],
  );
  const targets = listRecoverTargets({
    series: [],
    movies: [movie],
    seerrRows: [{ titleId: "tmdb-2059", mediaType: "movie", tmdb: 2059 }],
  });
  assert.deepEqual(
    targets.map((t) => `${t.mediaType}:${t.tmdb}`),
    ["movie:2059"],
  );
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 2059,
    radarrKey: "test",
    waitTries: 1,
    waitMs: 0,
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      calls.push({ method, url, body: opts.body });
      if (String(url).includes("/movie/") && method === "PUT") return { ...movie, monitored: true };
      if (String(url).includes("/movie") && method === "GET") return [movie];
      if (String(url).includes("/downloadclient") && method === "GET") {
        return [
          {
            implementation: "QBittorrent",
            fields: [
              { name: "host", value: "decypharr" },
              { name: "port", value: 8282 },
            ],
          },
        ];
      }
      if (String(url).includes("/qualityprofile") && method === "GET") {
        return [{ id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] }];
      }
      if (String(url).includes("/command")) return { id: 12, name: "MoviesSearch" };
      return { ok: true };
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.command, "MoviesSearch");
  const put = calls.find((c) => c.method === "PUT" && c.url.includes("/movie/12"));
  assert.equal(put?.body?.monitored, true);
  const search = calls.find((c) => c.url.includes("/command"));
  assert.equal(search?.body?.name, "MoviesSearch");
  assert.ok(calls.indexOf(put) < calls.indexOf(search));
});

test("kickArrRecover POSTs Decypharr + Any on Radarr before MoviesSearch", async () => {
  const calls = [];
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 2059,
    radarrKey: "test",
    waitTries: 1,
    waitMs: 0,
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      calls.push({ method, url, body: opts.body });
      if (String(url).includes("/movie") && !String(url).includes("lookup") && method === "GET") {
        return [{ id: 12, tmdbId: 2059, title: "National Treasure", hasFile: false, qualityProfileId: 6 }];
      }
      if (String(url).includes("/downloadclient") && method === "GET") return [];
      if (String(url).includes("/qualityprofile") && method === "GET") {
        return [
          {
            id: 6,
            name: "Ultra-HD",
            items: [
              { quality: { name: "WEBDL-720p" }, allowed: false },
              { quality: { name: "WEBDL-2160p" }, allowed: true },
            ],
          },
          { id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] },
        ];
      }
      return { ok: true, id: 12 };
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.movieId, 12);
  assert.equal(result.command, "MoviesSearch");
  assert.equal(result.grabPath?.clientAdded, true);
  const clientPost = calls.find((c) => c.url.includes("/downloadclient") && c.method === "POST");
  assert.equal(clientPost?.body?.name, "ReelOS-Decypharr");
  assert.equal(
    clientPost?.body?.fields?.find((f) => f.name === "movieCategory")?.value,
    "radarr",
  );
  const search = calls.find((c) => c.url.includes("/command"));
  assert.equal(search?.body?.name, "MoviesSearch");
  assert.deepEqual(search?.body?.movieIds, [12]);
  const searchIdx = calls.indexOf(search);
  const clientIdx = calls.indexOf(clientPost);
  assert.ok(clientIdx >= 0 && clientIdx < searchIdx);
});

test("kickArrRecover adds National Treasure when Seerr requested but Radarr is empty", async () => {
  const calls = [];
  let movies = [];
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 2059,
    radarrKey: "test",
    waitTries: 2,
    waitMs: 0,
    spawnImport: () => true,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      calls.push({ method, url, body: opts.body });
      if (String(url).includes("/movie/lookup/tmdb")) {
        return { tmdbId: 2059, title: "National Treasure", year: 2004, titleSlug: "national-treasure-2059" };
      }
      if (String(url).includes("/movie/lookup")) return [];
      if (String(url).includes("/rootfolder")) return [{ path: "/symlinks/radarr" }];
      if (String(url).includes("/qualityprofile") && method === "GET") {
        return [{ id: 1, name: "Any", items: [{ quality: { name: "WEBDL-720p" }, allowed: true }] }];
      }
      if (String(url).includes("/downloadclient") && method === "GET") {
        return [
          {
            implementation: "QBittorrent",
            fields: [
              { name: "host", value: "decypharr" },
              { name: "port", value: 8282 },
            ],
          },
        ];
      }
      if (String(url).includes("/movie") && method === "POST") {
        movies = [{ id: 9, tmdbId: 2059, title: "National Treasure", hasFile: false, qualityProfileId: 1 }];
        return movies[0];
      }
      if (String(url).includes("/movie") && method === "GET") return movies;
      if (String(url).includes("/command")) return { id: 9, name: "MoviesSearch" };
      return { ok: true };
    },
  });
  assert.equal(result.searched, true);
  assert.equal(result.ok, true);
  assert.equal(result.movieId, 9);
  assert.equal(result.command, "MoviesSearch");
  assert.equal(result.grabPath?.added, true);
  const add = calls.find((c) => c.url.includes("/movie") && c.method === "POST");
  assert.equal(add?.body?.tmdbId, 2059);
  assert.equal(add?.body?.rootFolderPath, "/symlinks/radarr");
  assert.equal(add?.body?.addOptions?.searchForMovie, false);
  assert.ok(calls.some((c) => String(c.url).includes("/movie/lookup/tmdb?tmdbId=2059")));
  const search = calls.find((c) => c.url.includes("/command"));
  assert.equal(search?.body?.name, "MoviesSearch");
});

test("recover never adds a mismatched lookup hit under the requested tmdbId", async () => {
  const other = { tmdbId: 999999, title: "Some Other Film", year: 1998, titleSlug: "some-other-film-999999" };
  assert.equal(pickRadarrLookupMovie([other], 2059), null);
  assert.equal(pickRadarrLookupMovie(other, 2059), null);
  assert.equal(pickRadarrLookupMovie({ ok: true, empty: true }, 2059), null);
  assert.equal(pickRadarrLookupMovie({ title: "No Ids Here" }, 2059), null);
  assert.equal(pickRadarrLookupMovie([other, { tmdbId: "2059", title: "National Treasure" }], 2059)?.title,
    "National Treasure");

  const calls = [];
  const result = await kickArrRecover({
    mediaType: "movie",
    tmdb: 2059,
    radarrKey: "test",
    waitTries: 1,
    waitMs: 0,
    spawnImport: () => false,
    fetchArr: async (url, _key, _ms, opts = {}) => {
      const method = opts.method || "GET";
      calls.push({ method, url, body: opts.body });
      if (String(url).includes("/movie/lookup/tmdb")) return other;
      if (String(url).includes("/movie/lookup")) return [other];
      if (String(url).includes("/rootfolder")) return [{ path: "/symlinks/radarr" }];
      if (String(url).includes("/qualityprofile")) return [{ id: 1, name: "Any" }];
      if (String(url).includes("/movie")) return [];
      return { ok: true };
    },
  });
  assert.equal(calls.some((c) => c.method === "POST" && c.url.includes("/movie")), false);
  assert.equal(calls.some((c) => String(c.url).includes("/command")), false);
  assert.equal(result.ok, false);
  assert.equal(result.movieId, null);
  assert.equal(result.grabPath?.missing, true);
});
