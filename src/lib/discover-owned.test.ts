import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverOwnedIndex, discoverTitleIsOwned, filterDiscoverCatalog } from "./discover-owned.ts";

const johnWick = {
  id: "tmdb-245891",
  kind: "movie" as const,
  title: "John Wick",
  year: 2014,
  ids: ["tmdb-245891", "jf-wick"],
  jellyfinId: "wick",
};

test("John Wick on Home is owned for Discover pick tonight", () => {
  const owned = discoverOwnedIndex([johnWick]);
  assert.equal(
    discoverTitleIsOwned({ id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie" }, owned),
    true,
  );
  assert.equal(
    discoverTitleIsOwned({ id: "tmdb-550", title: "Fight Club", year: 1999, kind: "movie" }, owned),
    false,
  );
});

test("JF-only John Wick still matches Discover by name and year", () => {
  const owned = discoverOwnedIndex([
    { id: "jf-wick", title: "John Wick", year: 2014, kind: "movie", ids: ["jf-wick"], jellyfinId: "wick" },
  ]);
  assert.equal(
    discoverTitleIsOwned({ id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie" }, owned),
    true,
  );
});

test("Discover search drops already-have and keeps a title that is not on the box", () => {
  const hits = [
    { id: "tmdb-245891", title: "John Wick", year: 2014, kind: "movie" },
    { id: "tmdb-245891-2", title: "John Wick: Chapter 2", year: 2017, kind: "movie" },
  ];
  const out = filterDiscoverCatalog(hits, [johnWick]);
  assert.deepEqual(
    out.map((t) => t.id),
    ["tmdb-245891-2"],
  );
});
