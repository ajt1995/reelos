import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { kickTvSeasonRecover, loadPresenceFacts, planTvPostRecover, resetPresenceFactsCache } from "./reelos-request-status.mjs";

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
