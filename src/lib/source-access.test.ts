import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_DEBRID_CONNECTION,
  publicPlaybackPath,
  accessibleTitleIds,
  sourceIsAccessible,
  sourcesForExperienceTitle,
  titleIsAccessible,
  titleCanUseProvider,
} from "../experience/source-access.ts";

test("public-domain media is accessible without debrid", () => {
  assert.equal(
    titleIsAccessible(
      "night-of-the-living-dead-1968",
      DEFAULT_DEBRID_CONNECTION,
    ),
    true,
  );
});

test("Night of the Living Dead uses the complete archived film, not the retired URL", () => {
  const [source] = sourcesForExperienceTitle("night-of-the-living-dead-1968");
  assert.equal(source.kind, "public_domain");
  assert.equal(source.uri, "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4");
});

test("public playback uses an authenticated same-origin title route, never a client URL", () => {
  assert.equal(publicPlaybackPath("night-of-the-living-dead-1968"), "/api/stream/public/night-of-the-living-dead-1968");
  assert.equal(publicPlaybackPath("https://example.com/movie.mp4"), null);
  assert.equal(publicPlaybackPath("../../private"), null);
  assert.equal(publicPlaybackPath("dark-knight"), null);
  assert.equal(publicPlaybackPath("toString"), null);
});

test("commercial metadata is not Library access without a connected provider", () => {
  assert.equal(
    titleIsAccessible("dark-knight", DEFAULT_DEBRID_CONNECTION),
    false,
  );
  assert.deepEqual(
    accessibleTitleIds(
      ["dark-knight", "night-of-the-living-dead-1968"],
      DEFAULT_DEBRID_CONNECTION,
    ),
    ["night-of-the-living-dead-1968"],
  );
});

test("an unverified provider candidate never becomes availability", () => {
  const [candidate] = sourcesForExperienceTitle("dark-knight");
  assert.equal(
    sourceIsAccessible(candidate, {
      enabled: true,
      provider: "torbox",
      status: "connected",
    }),
    false,
  );
});

test("only the provider with a native acquisition adapter offers Find a source", () => {
  assert.equal(titleCanUseProvider("dark-knight", {
    enabled: true, provider: "torbox", status: "connected",
  }), true);
  assert.equal(titleCanUseProvider("dark-knight", {
    enabled: true, provider: "real-debrid", status: "connected",
  }), false);
});

test("a public catalog record is discoverable but not falsely playable", () => {
  assert.equal(
    sourceIsAccessible(
      {
        kind: "public_catalog",
        verified: true,
        uri: "https://www.loc.gov/item/example/",
      },
      DEFAULT_DEBRID_CONNECTION,
    ),
    false,
  );
});
