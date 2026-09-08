import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  applyStuckNotes,
  mapSeerrStatus,
  parseTitleId,
  realSeasonNumbers,
  seasonCount,
  seerrRequestRow,
  seerrSearchHit,
  titleIdFor,
  tmdbPoster,
} from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("TV ids stay distinct from movie tmdb ids", () => {
  assert.deepEqual(parseTitleId("tmdb-tv-80566"), { mediaType: "tv", tmdb: "80566", titleId: "tmdb-tv-80566" });
  assert.deepEqual(parseTitleId("tmdb-550"), { mediaType: "movie", tmdb: "550", titleId: "tmdb-550" });
  assert.equal(titleIdFor("tv", 80566), "tmdb-tv-80566");
  assert.equal(titleIdFor("movie", 550), "tmdb-550");
});

test("season selectors skip specials and fake uncapped counts", () => {
  const seasons = [
    { seasonNumber: 0, name: "Specials" },
    { seasonNumber: 1 },
    { seasonNumber: 2 },
    { seasonNumber: 3 },
  ];
  assert.deepEqual(realSeasonNumbers(seasons), [1, 2, 3]);
  assert.equal(seasonCount(seasons), 3);
  assert.equal(seasonCount(4), 4);
  assert.equal(seasonCount([]), 0);
});

test("search hits map TMDB posters and TV season counts", () => {
  const movie = seerrSearchHit({
    id: 550,
    mediaType: "movie",
    title: "Fight Club",
    releaseDate: "1999-10-15",
    posterPath: "/pB8BM7pdSp6B6Ih7QZ9Wbu2uLku.jpg",
    voteAverage: 8.4,
    overview: "An insomniac.",
  });
  assert.equal(movie.id, "tmdb-550");
  assert.equal(movie.kind, "movie");
  assert.equal(movie.year, 1999);
  assert.equal(tmdbPoster("/p.jpg"), "https://image.tmdb.org/t/p/w500/p.jpg");

  const show = seerrSearchHit({
    id: 80566,
    mediaType: "tv",
    name: "Resident Alien",
    firstAirDate: "2021-01-27",
    numberOfSeasons: 3,
    seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 3 }],
  });
  assert.equal(show.id, "tmdb-tv-80566");
  assert.equal(show.seasons, 3);
  assert.deepEqual(show.seasonList, [1, 2, 3]);
});

test("Seerr media/request status maps onto the phone pills", () => {
  assert.equal(mapSeerrStatus(5, 2), "downloaded");
  assert.equal(mapSeerrStatus(3, 2), "grabbing");
  assert.equal(mapSeerrStatus(4, 2), "grabbing");
  assert.equal(mapSeerrStatus(2, 1), "queued");
  assert.equal(mapSeerrStatus(1, 4), "failed");
});

test("request rows survive Apply because they come from Seerr ids", () => {
  const row = seerrRequestRow({
    id: 9,
    type: "tv",
    status: 2,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    requestedBy: { displayName: "Austin" },
    seasons: [{ seasonNumber: 2 }],
    media: { tmdbId: 80566, status: 3 },
  }, {});
  assert.equal(row.id, "seerr-9");
  assert.equal(row.titleId, "tmdb-tv-80566");
  assert.equal(row.status, "downloading");
  assert.equal(row.season, 2);
  assert.equal(row.requester, "Austin");
});

test("stuck-notes mark a grabbing Seerr row failed and leave available alone", () => {
  const notes = { "tmdb-tv-80566": { status: "failed", reason: "Cached but symlink missing" } };
  const grabbing = seerrRequestRow(
    {
      id: 9,
      type: "tv",
      status: 2,
      createdAt: "2026-09-08T00:00:00.000Z",
      updatedAt: "2026-09-08T00:00:00.000Z",
      seasons: [{ seasonNumber: 2 }],
      media: { tmdbId: 80566, status: 3 },
    },
    notes,
  );
  assert.equal(grabbing.status, "failed");
  assert.equal(grabbing.reason, "Cached but symlink missing");
  const ok = applyStuckNotes(
    { titleId: "tmdb-tv-80566", status: "available", engine: "downloaded", progress: 100 },
    notes,
  );
  assert.equal(ok.status, "available");
});

test("compose and Caddy name the service seerr on 5055", () => {
  const yml = readFileSync(join(root, "install/compose/docker-compose.yml"), "utf8");
  const caddy = readFileSync(join(root, "install/compose/Caddyfile"), "utf8");
  assert.match(yml, /^\s+seerr:/m);
  assert.match(yml, /fallenbagel\/jellyseerr/);
  assert.match(yml, /5055:5055/);
  assert.match(yml, /profiles: \["jellyfin", "seerr"\]/);
  assert.match(caddy, /handle \/seerr\*/);
  assert.match(caddy, /127\.0\.0\.1:5055/);
});
