import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadPresenceFacts, resetPresenceFactsCache } from "./reelos-request-status.mjs";

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
});
