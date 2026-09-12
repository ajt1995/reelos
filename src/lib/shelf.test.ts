import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeShelf } from "./shelf.ts";
import type { Title } from "./types.ts";

function title(id: string): Title {
  return {
    id,
    kind: "movie",
    title: id,
    year: 2024,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "4k",
    popularity: 50,
  };
}

test("limited Home merge keeps extra Library titles", () => {
  const prev = [title("a"), title("b"), title("c")];
  const next = [title("a"), title("d")];
  assert.deepEqual(
    mergeShelf(prev, next, true).map((t) => t.id),
    ["a", "d", "b", "c"],
  );
});

test("full Library response replaces the shelf", () => {
  const prev = [title("a"), title("b")];
  const next = [title("c")];
  assert.deepEqual(
    mergeShelf(prev, next, false).map((t) => t.id),
    ["c"],
  );
});

test("limited Home merge drops a persisted hash leftover when named Rick arrives", () => {
  const hash: Title = {
    ...title("jf-103ae87fbbbd9bb920ee3803dcffc570"),
    kind: "tv",
    title: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    year: 0,
    poster: "",
    ids: ["73ceff573dc30bebc3fcf26f61de07b25f927a74"],
    jellyfinId: "103ae87fbbbd9bb920ee3803dcffc570",
    fromHashDump: true,
  };
  const rick: Title = {
    ...title("tvdb-275274"),
    kind: "tv",
    title: "Rick and Morty",
    year: 2013,
    poster: "/p.jpg",
    ids: ["tvdb-275274", "tmdb-tv-60625", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "3d32e281cfcb09816952099c4ff468f6",
  };
  assert.deepEqual(
    mergeShelf([hash, title("tmdb-245891")], [rick, title("tmdb-245891")], true).map((t) => t.title),
    ["Rick and Morty", "tmdb-245891"],
  );
});
