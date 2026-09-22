import assert from "node:assert/strict";
import { test } from "node:test";
import { useExperienceStore, EMPTY_SETUP_PROFILE, activeExperienceProfile } from "../experience/experience-state.ts";
import { isWorldPath, pathForWorldDestination, pathForWorldView, worldViewForPath } from "../experience/world-routing.ts";

test("consumer world routes have stable direct-link mappings", () => {
  assert.equal(pathForWorldView("home"), "/");
  assert.equal(pathForWorldView("discover"), "/discover");
  assert.equal(pathForWorldView("library"), "/library");
  assert.equal(pathForWorldView("books"), "/books");
  assert.equal(pathForWorldView("taste"), "/calibrate");
  assert.equal(pathForWorldView("devices"), "/connect");
  assert.equal(pathForWorldView("profile"), "/profile");
  assert.equal(pathForWorldView("family"), "/family");
  assert.equal(pathForWorldView("ambiance"), "/ambiance");
  assert.equal(pathForWorldView("player"), undefined);
});

test("consumer world paths restore their shell view while leaving browse and player routes separate", () => {
  assert.equal(worldViewForPath("/discover/"), "discover");
  assert.equal(worldViewForPath("/settings"), "settings");
  assert.equal(worldViewForPath("/settings/advanced"), "settings");
  assert.equal(worldViewForPath("/profile"), "profile");
  assert.equal(worldViewForPath("/family/"), "family");
  assert.equal(worldViewForPath("/ambiance"), "ambiance");
  assert.equal(worldViewForPath("/title/tmdb-123"), "home");
  assert.equal(worldViewForPath("/person/42"), "home");
  assert.equal(worldViewForPath("/collection/9"), "home");
  assert.equal(worldViewForPath("/discover/movies"), undefined);
  assert.equal(worldViewForPath("/play/title-id"), undefined);
  assert.equal(isWorldPath("/companion"), true);
  assert.equal(isWorldPath("/title/title-id"), true);
  assert.equal(isWorldPath("/discover/movies"), false);
  assert.equal(isWorldPath("/play/title-id"), false);
});

test("content destinations have stable encoded direct links", () => {
  assert.equal(pathForWorldDestination({ type: "title", id: "tmdb-123" }), "/title/tmdb-123");
  assert.equal(pathForWorldDestination({ type: "person", id: "Ayo Edebiri" }), "/person/Ayo%20Edebiri");
  assert.equal(pathForWorldDestination({ type: "collection", id: "quiet/strange" }), "/collection/quiet%2Fstrange");
});

function withTasteTestProfile(run: (profileId: string) => void) {
  const original = useExperienceStore.getState();
  const profile = {
    ...EMPTY_SETUP_PROFILE,
    id: "taste-state-test",
    reactions: { "a-title": "love" as const },
    dismissedTasteIds: [],
    lessLikeIds: [],
};
  useExperienceStore.setState({
    activeProfileId: profile.id,
    profiles: [profile],
  });
  try {
    run(profile.id);
  } finally {
    useExperienceStore.setState({
      activeProfileId: original.activeProfileId,
      profiles: original.profiles,
    });
  }
}

test("less like clears a conflicting positive taste signal and remains reversible", () => {
  withTasteTestProfile((profileId) => {
    useExperienceStore.getState().toggleLessLike(profileId, "a-title");
    let profile = useExperienceStore.getState().profiles[0];
    assert.equal(profile.reactions["a-title"], undefined);
    assert.deepEqual(profile.lessLikeIds, ["a-title"]);
    assert.deepEqual(profile.dismissedTasteIds, []);

    useExperienceStore.getState().toggleLessLike(profileId, "a-title");
    profile = useExperienceStore.getState().profiles[0];
    assert.deepEqual(profile.lessLikeIds, []);
    assert.equal(profile.reactions["a-title"], undefined);
  });
});

test("dismiss returns a title to neutral rather than encoding negative feedback", () => {
  withTasteTestProfile((profileId) => {
    useExperienceStore.getState().toggleLessLike(profileId, "a-title");
    useExperienceStore.getState().dismissTaste(profileId, "a-title");
    const profile = useExperienceStore.getState().profiles[0];
    assert.equal(profile.reactions["a-title"], undefined);
    assert.deepEqual(profile.lessLikeIds, []);
    assert.deepEqual(profile.dismissedTasteIds, ["a-title"]);
  });
});

test("an empty service never seeds demonstration people or completes setup", () => {
  const original = useExperienceStore.getState();
  try {
    original.hydrateProfiles([], undefined, false);
    const state = useExperienceStore.getState();
    assert.equal(state.view, "setup");
    assert.equal(state.onboardingComplete, false);
    assert.equal(state.activeProfileId, "");
    assert.deepEqual(state.profiles, []);
    assert.equal(activeExperienceProfile(state).name, "");
  } finally { useExperienceStore.setState(original); }
});

test("partial household creation does not bypass setup on reload", () => {
  const original = useExperienceStore.getState();
  try {
    original.hydrateProfiles([{ ...EMPTY_SETUP_PROFILE, id: "owner", name: "Alex" }], "owner", false);
    assert.equal(useExperienceStore.getState().onboardingComplete, false);
    assert.equal(useExperienceStore.getState().view, "setup");
    original.hydrateProfiles([{ ...EMPTY_SETUP_PROFILE, id: "owner", name: "Alex" }], "owner", true);
    assert.equal(useExperienceStore.getState().view, "home");
  } finally { useExperienceStore.setState(original); }
});

test("a display-only roster cannot restore a private active profile from browser state", () => {
  const original = useExperienceStore.getState();
  try {
    useExperienceStore.setState({ activeProfileId: "other", kidsPresentIds: ["child"], requests: { arrival: { titleId: "arrival", progress: 1, status: "ready" } } });
    original.hydrateProfiles([{ ...EMPTY_SETUP_PROFILE, id: "other", name: "Other", summaryOnly: true }], "other", true);
    const state = useExperienceStore.getState();
    assert.equal(state.activeProfileId, "");
    assert.deepEqual(state.kidsPresentIds, []);
    assert.deepEqual(state.requests, {});
  } finally { useExperienceStore.setState(original); }
});
