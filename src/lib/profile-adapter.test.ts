import assert from "node:assert/strict";
import test from "node:test";
import {
  profileFromServer,
  profileToServer,
} from "../experience/profile-adapter.ts";
import type { ExperienceProfile } from "../experience/experience-state.ts";

const profile: ExperienceProfile = {
  id: "austin",
  name: "Austin",
  color: "#2563eb",
  motion: "expressive",
  density: "compact",
  exploration: "adventurous",
  reactions: { arrival: "love" },
  dismissedTasteIds: ["unknown"],
  lessLikeIds: ["loud"],
  savedIds: ["charade-1963"],
  progress: { arrival: 0.4 },
  bookProgress: { dune: 0.2 },
  bookLocations: { dune: "epubcfi(/6/14)" },
  bookBookmarks: { dune: ["epubcfi(/6/8)", "epubcfi(/6/14)"] },
  readingAppearance: { theme: "sepia", fontSizeIndex: 3 },
  familyPlayback: {
    languageSeverity: "strong",
    religiousLanguage: true,
    audioTreatment: "soften",
    subtitleTreatment: "replace",
    exceptions: ["The Princess Bride"],
  },
  audioPreference: "original",
  subtitleLanguage: "English",
};

test("experience profiles round-trip through the server contract", () => {
  const encoded = profileToServer(profile, "2468");
  assert.equal(encoded.experienceVersion, 2);
  assert.equal(encoded.pin, "2468");
  assert.deepEqual(encoded.watchlist, profile.savedIds);
  const decoded = profileFromServer({
    ...encoded,
    pin: undefined,
    pinEnabled: true,
    updatedAt: 123,
  });
  assert.ok(decoded);
  assert.equal(decoded.pinEnabled, true);
  assert.deepEqual(decoded.reactions, profile.reactions);
  assert.deepEqual(decoded.savedIds, profile.savedIds);
  assert.deepEqual(decoded.bookProgress, profile.bookProgress);
  assert.deepEqual(decoded.bookLocations, profile.bookLocations);
  assert.deepEqual(decoded.bookBookmarks, profile.bookBookmarks);
  assert.deepEqual(decoded.readingAppearance, profile.readingAppearance);
  assert.deepEqual(decoded.familyPlayback, profile.familyPlayback);
});

test("reader appearance is bounded and safely defaults", () => {
  const decoded = profileFromServer({
    ...profileToServer(profile),
    readingAppearance: { theme: "laser", fontSizeIndex: 99 },
  });
  assert.deepEqual(decoded?.readingAppearance, {
    theme: "dark",
    fontSizeIndex: 4,
  });
});

test("legacy profiles do not overwrite the personal-world profile state", () => {
  assert.equal(profileFromServer({ id: "res-primary", name: "Primary" }), null);
});
