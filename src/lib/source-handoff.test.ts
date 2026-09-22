import assert from "node:assert/strict";
import test from "node:test";
import { inspectSourceLink } from "../experience/source-handoff.ts";

test("source links are reviewed locally without exposing private query material", () => {
  const review = inspectSourceLink("https://example.test/torznab/api");
  assert.equal(review?.safeToReview, true);
  assert.equal(review?.display, "example.test/torznab/api");
  const privateReview = inspectSourceLink("https://example.test/torznab/api?apikey=do-not-store");
  assert.equal(privateReview?.safeToReview, false);
  assert.doesNotMatch(privateReview?.display || "", /apikey|do-not-store/i);
});

test("ordinary title queries are not treated as source setup", () => {
  assert.equal(inspectSourceLink("a moody movie with Florence Pugh"), null);
  assert.equal(inspectSourceLink("https://example.test/a-normal-page"), null);
});
