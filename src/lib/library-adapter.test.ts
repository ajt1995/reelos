import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapLibraryTitle,
  mergeExperienceTitles,
} from "../experience/library-adapter.ts";

test("live library titles become verified local ReelOS titles with playback identity", () => {
  const mapped = mapLibraryTitle({
    id: "tmdb-12",
    jellyfinId: "jf-99",
    kind: "movie",
    title: "A Real Film",
    year: 2024,
    runtime: 102,
    genres: ["Adventure"],
    overview: "From the actual box.",
    poster: "/poster.jpg",
  });
  assert.ok(mapped);
  assert.equal(mapped.playbackId, "jf-99");
  assert.deepEqual(mapped.sources, [{ kind: "retained_local", verified: true }]);
  assert.ok(mapped.moods.includes("wonder"));
});

test("the adapter never invents child safety from animation or family genres", () => {
  const mapped = mapLibraryTitle({
    id: "animated",
    kind: "movie",
    title: "Animated",
    genres: ["Animation", "Family"],
  });
  assert.equal(mapped?.family, false);
  const approved = mapLibraryTitle({
    id: "approved",
    kind: "movie",
    title: "Approved",
    genres: ["Drama"],
    isKids: true,
  });
  assert.equal(approved?.family, true);
});

test("live shelf data wins over preview catalog duplicates", () => {
  const live = mapLibraryTitle({
    id: "same",
    jellyfinId: "jf-same",
    title: "Live title",
  });
  const preview = mapLibraryTitle({ id: "same", title: "Preview title" });
  assert.ok(live && preview);
  const merged = mergeExperienceTitles([preview], [live]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, "Live title");
});

test("only explicit verified original annotations add preparation eligibility", () => {
  for (const sourceKind of ["personal_import", "public_domain"]) {
    const mapped = mapLibraryTitle({ id: "original", title: "Verified original", sourceKind, sourceVerified: true });
    assert.deepEqual(mapped?.sources, [{ kind: sourceKind, verified: true }]);
  }
});

test("native provider and retained sources stay distinct while unverified claims never masquerade as originals", () => {
  for (const claim of [
    {}, { sourceKind: "personal_import" }, { sourceKind: "public_domain", sourceVerified: false },
    { sourceKind: "public_catalog", sourceVerified: true }, { sourceKind: "unknown", sourceVerified: true },
  ]) {
    assert.deepEqual(mapLibraryTitle({ id: "title", title: "Shelf entry", ...claim })?.sources, [{ kind: "retained_local", verified: true }]);
  }
  assert.deepEqual(mapLibraryTitle({ id: "provider", title: "Provider", sourceKind: "debrid", sourceVerified: true })?.sources,
    [{ kind: "debrid", verified: true }]);
  assert.deepEqual(mapLibraryTitle({ id: "retained", title: "Retained", sourceKind: "retained_local", sourceVerified: true })?.sources,
    [{ kind: "retained_local", verified: true }]);
});
