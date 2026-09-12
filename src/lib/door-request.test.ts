import assert from "node:assert/strict";
import { test } from "node:test";
import { requestBodyForTitle } from "./door-request.ts";
import type { Title } from "./types.ts";

function title(partial: Partial<Title> & Pick<Title, "id" | "kind" | "title">): Title {
  return {
    year: 2014,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "4k",
    popularity: 50,
    ...partial,
  };
}

test("Request from collection/filmography posts the title TMDB id, not a person", () => {
  const movie = requestBodyForTitle(title({ id: "tmdb-324552", kind: "movie", title: "John Wick: Chapter 2" }));
  assert.equal(movie?.titleId, "tmdb-324552");
  assert.equal(movie?.mediaType, "movie");
  assert.equal(movie?.tmdb, 324552);
  assert.equal(movie?.season, undefined);
  const tv = requestBodyForTitle(title({ id: "tmdb-tv-1402", kind: "tv", title: "The Walking Dead", ids: ["tmdb-tv-1402"] }));
  assert.equal(tv?.titleId, "tmdb-tv-1402");
  assert.equal(tv?.mediaType, "tv");
  assert.equal(tv?.season, 1);
  assert.equal(requestBodyForTitle(title({ id: "person-6384", kind: "movie", title: "Keanu Reeves" })), null);
  assert.equal(requestBodyForTitle(title({ id: "collection-404609", kind: "movie", title: "John Wick Collection" })), null);
});
