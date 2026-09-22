import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_CATALOGS, mapLocCinemaItem, searchPublicCinema } from "./public-catalogs.mjs";

test("public catalogs are prewired and always enabled", () => {
  assert.ok(PUBLIC_CATALOGS.length >= 5);
  assert.ok(PUBLIC_CATALOGS.every((catalog) => catalog.enabled === true));
  assert.ok(PUBLIC_CATALOGS.some((catalog) => catalog.id === "loc-national-screening-room"));
  assert.ok(PUBLIC_CATALOGS.some((catalog) => catalog.id === "project-gutenberg"));
});

test("LOC results expose catalog access but not playback without explicit rights", () => {
  const item = mapLocCinemaItem({
    id: "http://www.loc.gov/item/abc123/",
    title: "A Film",
    date: "1912",
    resources: [{ files: [{ url: "https://media.loc.gov/a-film.mp4" }] }],
  });
  assert.equal(item.sourceKind, "public_catalog");
  assert.equal(item.playable, false);
  assert.equal(item.sourceUri, "https://www.loc.gov/item/abc123/");
});

test("LOC results allow direct media only with item-level open-rights evidence", () => {
  const item = mapLocCinemaItem({
    id: "https://www.loc.gov/item/open123/",
    title: "An Open Film",
    rights_advisory: "No known copyright or other restrictions.",
    resources: [{ files: [{ url: "https://media.loc.gov/open-film.mp4" }] }],
  });
  assert.equal(item.sourceKind, "public_domain");
  assert.equal(item.playable, true);
  assert.equal(item.sourceUri, "https://media.loc.gov/open-film.mp4");
});

test("public cinema search uses the official LOC collection endpoint", async () => {
  let called = "";
  const results = await searchPublicCinema("alice", {
    fetchImpl: async (url) => {
      called = String(url);
      return {
        ok: true,
        json: async () => ({ results: [{ id: "https://www.loc.gov/item/alice1/", title: "Alice" }] }),
      };
    },
  });
  assert.match(called, /loc\.gov\/collections\/national-screening-room/);
  assert.equal(results[0].id, "loc-alice1");
});
