import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildSeerrAddPayload,
  collectionFromSeerrMovie,
  mapCollectionDetail,
  mapPersonCredits,
  mapPersonDetail,
  mapSeerrCollectionHits,
  mapSeerrPersonHits,
  mapSeerrSearchResults,
  normalizeMediaType,
  overlayLibraryOnTitle,
  requestBodyForTitle,
} from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const SEARCH_HITS = [
  { id: 6384, mediaType: "person", name: "Keanu Reeves", profilePath: "/keanu.jpg" },
  {
    id: 245891,
    mediaType: "movie",
    title: "John Wick",
    releaseDate: "2014-10-24",
    posterPath: "/wick.jpg",
  },
  { id: 404609, mediaType: "collection", name: "John Wick Collection", posterPath: "/box.jpg" },
  { id: 1402, mediaType: "tv", name: "The Walking Dead", firstAirDate: "2010-10-31" },
];

test("search splits people and collections out of titles[]", () => {
  const titles = mapSeerrSearchResults(SEARCH_HITS, { q: "john wick" });
  const people = mapSeerrPersonHits(SEARCH_HITS);
  const collections = mapSeerrCollectionHits(SEARCH_HITS);
  assert.deepEqual(
    titles.map((t) => t.id),
    ["tmdb-245891", "tmdb-tv-1402"],
  );
  assert.equal(people.length, 1);
  assert.equal(people[0].id, 6384);
  assert.equal(people[0].name, "Keanu Reeves");
  assert.equal(collections.length, 1);
  assert.equal(collections[0].id, 404609);
  assert.equal(collections[0].name, "John Wick Collection");
  assert.equal(normalizeMediaType("person"), null);
  assert.equal(normalizeMediaType("collection"), null);
  assert.equal(buildSeerrAddPayload({ mediaType: "person", tmdb: 6384 }), null);
  assert.equal(buildSeerrAddPayload({ mediaType: "collection", tmdb: 404609 }), null);
});

test("collections come from TMDB only — no invented box sets", () => {
  assert.equal(collectionFromSeerrMovie({ title: "John Wick" }), null);
  assert.equal(collectionFromSeerrMovie({ similar: [{ id: 324552, title: "John Wick: Chapter 2" }] }), null);
  assert.equal(collectionFromSeerrMovie({ belongsToCollection: { name: "John Wick Collection" } }), null);
  assert.equal(collectionFromSeerrMovie({ belongs_to_collection: { id: 404609, name: "" } }), null);
  const real = collectionFromSeerrMovie({
    belongsToCollection: { id: 404609, name: "John Wick Collection", posterPath: "/box.jpg" },
  });
  assert.equal(real.id, 404609);
  assert.equal(real.name, "John Wick Collection");
  assert.equal(mapCollectionDetail({ parts: [{ id: 245891, title: "John Wick" }] }, []), null);
  const detail = mapCollectionDetail(
    {
      id: 404609,
      name: "John Wick Collection",
      overview: "Assassin movies.",
      posterPath: "/box.jpg",
      parts: [
        { id: 245891, title: "John Wick", releaseDate: "2014-10-24", mediaType: "movie" },
        { id: 324552, title: "John Wick: Chapter 2", release_date: "2017-02-10" },
      ],
    },
    [{ id: "tmdb-245891", jellyfinId: "jf-wick", title: "John Wick" }],
  );
  assert.equal(detail.source, "tmdb");
  assert.equal(detail.parts.length, 2);
  assert.equal(detail.parts[0].id, "tmdb-245891");
  assert.equal(detail.parts[0].inLibrary, true);
  assert.equal(detail.parts[1].inLibrary, false);
  assert.equal(detail.onBox, 1);
  assert.equal(requestBodyForTitle(detail.parts[1])?.tmdb, 324552);
  assert.equal(requestBodyForTitle(detail.parts[1])?.mediaType, "movie");
  assert.equal(requestBodyForTitle({ id: "collection-404609", kind: "movie", title: "John Wick Collection" }), null);
});

test("person filmography is cast-only, overlays the box, Request uses the title TMDB id", () => {
  const credits = mapPersonCredits(
    {
      cast: [
        { id: 245891, mediaType: "movie", title: "John Wick", releaseDate: "2014-10-24" },
        { id: 1402, media_type: "tv", name: "The Walking Dead", first_air_date: "2010-10-31" },
        { id: 245891, mediaType: "movie", title: "John Wick (dup)" },
      ],
      crew: [{ id: 603, mediaType: "movie", title: "The Matrix", job: "Thanks" }],
    },
    [{ id: "tmdb-tv-1402", jellyfinId: "jf-twd", title: "The Walking Dead", kind: "tv" }],
  );
  assert.equal(credits.length, 2);
  assert.equal(credits.some((t) => t.id === "tmdb-603"), false);
  const wick = credits.find((t) => t.id === "tmdb-245891");
  const twd = credits.find((t) => t.id === "tmdb-tv-1402");
  assert.equal(wick.inLibrary, false);
  assert.equal(twd.inLibrary, true);
  assert.equal(requestBodyForTitle(wick)?.titleId, "tmdb-245891");
  assert.equal(requestBodyForTitle(twd)?.titleId, "tmdb-tv-1402");
  assert.equal(requestBodyForTitle(twd)?.season, 1);
  assert.equal(requestBodyForTitle({ id: "person-6384", kind: "movie", title: "Keanu Reeves" }), null);
  const person = mapPersonDetail({ id: 6384, name: "Keanu Reeves", knownForDepartment: "Acting" }, { cast: [] }, []);
  assert.equal(person.id, 6384);
  assert.equal(mapPersonDetail({ id: 6384, name: "" }, { cast: [] }, []), null);
});

test("library overlay marks inLibrary from the JF row", () => {
  const hit = overlayLibraryOnTitle(
    { id: "tmdb-245891", ids: ["tmdb-245891"], title: "John Wick", kind: "movie" },
    [{ id: "tmdb-245891", jellyfinId: "abc", title: "John Wick" }],
  );
  assert.equal(hit.inLibrary, true);
  assert.equal(hit.jellyfinId, "abc");
  assert.equal(
    overlayLibraryOnTitle({ id: "tmdb-9", title: "Missing", kind: "movie" }, [{ id: "tmdb-245891", jellyfinId: "abc" }])
      .inLibrary,
    false,
  );
});

test("door wires collection/person APIs and search entry points; wizard stays 7", () => {
  const plugin = read("scripts/reelos-lookup-plugin.mjs");
  assert.match(plugin, /pathOnly === "\/api\/collection"/);
  assert.match(plugin, /pathOnly === "\/api\/person"/);
  assert.match(plugin, /seerrFetch\(`\/api\/v1\/collection\/\$\{id\}`/);
  assert.match(plugin, /seerrFetch\(`\/api\/v1\/person\/\$\{id\}`/);
  assert.match(plugin, /combined_credits/);
  assert.match(plugin, /people\.push\(\.\.\.mapSeerrPersonHits/);
  assert.match(plugin, /collections\.push\(\.\.\.mapSeerrCollectionHits/);
  assert.match(plugin, /collectionFromSeerrMovie/);
  assert.doesNotMatch(plugin, /reelos-episodes/);
  assert.doesNotMatch(plugin, /invent.*collection|fake collection/i);

  const home = read("src/components/home-view.tsx");
  assert.match(home, /Search movies, shows, people/);
  assert.doesNotMatch(home, /Search movies, shows, music/);
  assert.match(home, /to="\/person\/\$id"/);
  assert.match(home, /to="\/collection\/\$id"/);
  assert.match(home, /to="\/title\/\$id"/);

  const discover = read("src/components/discover-view.tsx");
  assert.match(discover, /Looking up movies and shows/);
  assert.match(discover, /Find a title or actor/);
  assert.match(discover, /to="\/person\/\$id"/);
  assert.match(discover, />People</);
  assert.match(discover, />Collections</);

  const title = read("src/components/title-view-live.tsx");
  assert.match(title, /Collection · \{resolved\.collection\.name\}/);
  assert.match(title, /to="\/collection\/\$id"/);

  const presence = read("src/components/presence-row.tsx");
  assert.match(presence, /In library/);
  assert.match(presence, /Request S01/);
  assert.match(presence, /\{series \? "Request S01" : "Request"\}/);
  assert.match(presence, /\bWatch\b/);
  assert.match(presence, /postTitleRequest/);
  assert.doesNotMatch(presence, /absolute inset-0/);

  const collectionView = read("src/components/collection-view.tsx");
  assert.match(collectionView, /\/api\/collection\?id=/);
  assert.doesNotMatch(collectionView, /min-h-\[280px\]|kenburns|absolute inset-0/);

  const personView = read("src/components/person-view.tsx");
  assert.match(personView, /\/api\/person\?id=/);
  assert.doesNotMatch(personView, /absolute inset-0 size-full object-cover/);

  assert.match(read("src/components/wizard.tsx"), /const TOTAL = 7/);
  assert.match(read("src/lib/store.ts"), /betaChannel: false/);
});
