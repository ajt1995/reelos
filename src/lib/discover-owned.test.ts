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

test("The Rookie on this box is owned for Discover TV", () => {
  const owned = discoverOwnedIndex([
    {
      id: "tvdb-350665",
      title: "The Rookie",
      year: 2018,
      kind: "tv",
      ids: ["tvdb-350665", "tmdb-tv-79744", "tmdb-79744"],
      jellyfinId: "01c2efb0f4c9b916b1ccaffe1d81e598",
    },
  ]);
  assert.equal(
    discoverTitleIsOwned({ id: "tmdb-tv-79744", title: "The Rookie", year: 2018, kind: "tv" }, owned),
    true,
  );
  const catalog = filterDiscoverCatalog(
    [
      { id: "tmdb-tv-79744", title: "The Rookie", year: 2018, kind: "tv" },
      { id: "tmdb-tv-66732", title: "Stranger Things", year: 2016, kind: "tv" },
    ],
    [
      {
        id: "tvdb-350665",
        title: "The Rookie",
        year: 2018,
        kind: "tv",
        ids: ["tmdb-tv-79744"],
        jellyfinId: "01c2",
      },
    ],
  );
  assert.deepEqual(
    catalog.map((t) => t.title),
    ["Stranger Things"],
  );
});
