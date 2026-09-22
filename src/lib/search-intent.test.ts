import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSearchIntent,
  suggestionsForIntent,
} from "../experience/search-intent.ts";

test("natural-language search separates kind, time, mood, and exclusions", () => {
  const intent = parseSearchIntent(
    "A funny movie under 95 minutes without horror",
  );
  assert.equal(intent.kind, "movie");
  assert.equal(intent.maxMinutes, 95);
  assert.deepEqual(intent.moods, ["funny"]);
  assert.deepEqual(intent.excludedTerms, ["horror"]);
  assert.equal(intent.lookupQuery, "funny");
});

test("a named performer becomes the live lookup query without losing constraints", () => {
  const intent = parseSearchIntent(
    "A series with Ayo Edebiri without violence",
  );
  assert.equal(intent.kind, "series");
  assert.equal(intent.person, "ayo edebiri");
  assert.equal(intent.lookupQuery, "ayo edebiri");
  assert.deepEqual(intent.excludedTerms, ["violence"]);
});

test("remembered-scene language is recognized without claiming scene certainty", () => {
  const intent = parseSearchIntent(
    "I remember a scene where they dance in a diner",
  );
  assert.equal(intent.sceneClue, true);
  assert.ok(intent.terms.includes("dance"));
  assert.ok(intent.terms.includes("diner"));
});

test("books are a first-class content intent", () => {
  const intent = parseSearchIntent("a cozy book to read");
  assert.equal(intent.kind, "book");
  assert.deepEqual(intent.moods, ["comfort"]);
});

test("ambiguous searches receive concise refinements", () => {
  const suggestions = suggestionsForIntent(parseSearchIntent("something strange"));
  assert.deepEqual(
    suggestions.map((item) => item.label),
    ["Movies", "Series", "Books", "Under 100 min", "No horror"],
  );
});
