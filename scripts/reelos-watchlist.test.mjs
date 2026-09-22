import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWatchlistUrl,
  defaultWatchlistConfig,
  filterMissingWatchlistItems,
  parseTitleAndYear,
  parseWatchlistXml,
  syncWatchlistFeed,
} from "./reelos-watchlist.mjs";

test("buildWatchlistUrl supports letterboxd, trakt, and custom urls", () => {
  assert.equal(buildWatchlistUrl("letterboxd", "resident"), "https://letterboxd.com/resident/watchlist/rss/");
  assert.equal(buildWatchlistUrl("trakt", "resident"), "https://trakt.tv/users/resident/watchlist.atom");
  assert.equal(buildWatchlistUrl("custom", "https://example.com/feed.rss"), "https://example.com/feed.rss");
  assert.equal(buildWatchlistUrl("letterboxd", ""), "");
});

test("parseTitleAndYear extracts clean title and 4-digit release year", () => {
  assert.deepEqual(parseTitleAndYear("Inception (2010)"), { title: "Inception", year: 2010 });
  assert.deepEqual(parseTitleAndYear("Blade Runner 2049 (2017)"), { title: "Blade Runner 2049", year: 2017 });
  assert.deepEqual(parseTitleAndYear("The Matrix"), { title: "The Matrix", year: null });
  assert.deepEqual(parseTitleAndYear(""), { title: "", year: null });
});

test("parseWatchlistXml parses Letterboxd RSS format with tmdb:movieId", () => {
  const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://letterboxd.com">
  <channel>
    <title>Letterboxd Watchlist</title>
    <item>
      <title>Oppenheimer (2023)</title>
      <link>https://letterboxd.com/film/oppenheimer-2023/</link>
      <letterboxd:filmTitle>Oppenheimer</letterboxd:filmTitle>
      <letterboxd:filmYear>2023</letterboxd:filmYear>
      <tmdb:movieId>872585</tmdb:movieId>
    </item>
    <item>
      <title>Dune: Part Two (2024)</title>
      <link>https://letterboxd.com/film/dune-part-two/</link>
      <description>https://www.themoviedb.org/movie/693134</description>
    </item>
  </channel>
</rss>`;

  const items = parseWatchlistXml(sampleRss);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Oppenheimer");
  assert.equal(items[0].year, 2023);
  assert.equal(items[0].tmdbId, "872585");
  assert.equal(items[0].mediaType, "movie");

  assert.equal(items[1].title, "Dune: Part Two");
  assert.equal(items[1].year, 2024);
  assert.equal(items[1].tmdbId, "693134");
});

test("parseWatchlistXml parses Trakt Atom format", () => {
  const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Watchlist</title>
  <entry>
    <title>Severance (2022)</title>
    <link href="https://trakt.tv/shows/severance" />
  </entry>
  <entry>
    <title>Civil War (2024)</title>
    <link href="https://trakt.tv/movies/civil-war-2024" />
  </entry>
</feed>`;

  const items = parseWatchlistXml(sampleAtom);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Severance");
  assert.equal(items[0].year, 2022);
  assert.equal(items[0].mediaType, "tv");

  assert.equal(items[1].title, "Civil War");
  assert.equal(items[1].year, 2024);
  assert.equal(items[1].mediaType, "movie");
});

test("filterMissingWatchlistItems excludes existing library titles and requests", () => {
  const items = [
    { title: "Inception", tmdbId: "27205" },
    { title: "Interstellar", tmdbId: "157336" },
    { title: "Tenet", tmdbId: "577922" },
  ];
  const library = [{ title: "Inception", tmdb: "27205" }];
  const requests = [{ title: "Interstellar", tmdbId: "157336" }];

  const missing = filterMissingWatchlistItems(items, library, requests);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].title, "Tenet");
});

test("syncWatchlistFeed successfully syncs feed and triggers requests", async () => {
  const requested = [];
  const fakeXml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Tenet (2020)</title>
    <tmdb:movieId>577922</tmdb:movieId>
  </item>
</channel></rss>`;

  const res = await syncWatchlistFeed({
    config: { enabled: true, service: "letterboxd", username: "resident", feedUrl: "https://letterboxd.com/resident/watchlist/rss/" },
    fetchFeed: async () => fakeXml,
    requestSeerr: async (req) => {
      requested.push(req);
      return { ok: true };
    },
    getLibraryTitles: () => [],
    getExistingRequests: () => [],
  });

  assert.equal(res.ok, true);
  assert.equal(res.synced, 1);
  assert.equal(requested.length, 1);
  assert.equal(requested[0].tmdbId, "577922");
  assert.equal(requested[0].mediaType, "movie");
});

