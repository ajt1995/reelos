import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDecisionPicks } from "../experience/decision-engine.ts";
import type { ExperienceProfile } from "../experience/experience-state.ts";
import type { ExperienceTitle } from "../experience/experience-catalog.ts";

const source = [{ kind: "public_domain" as const, verified: true, uri: "https://example.test/movie.mp4" }];
const title = (
  id: string,
  moods: string[],
  minutes: number,
  genre = "Drama",
  family = false,
): ExperienceTitle => ({
  id,
  title: id,
  year: 2020,
  kind: "movie",
  genres: [genre],
  poster: "",
  backdrop: "",
  note: `${id} note`,
  people: [],
  moods,
  minutes,
  family,
  sources: source,
});

const profile: ExperienceProfile = {
  id: "person",
  name: "Person",
  color: "#fff",
  motion: "subtle",
  density: "comfortable",
  exploration: "balanced",
  reactions: { loved: "love", cozy: "cozy" },
  dismissedTasteIds: [],
  lessLikeIds: ["avoid"],
  savedIds: ["saved"],
  progress: {},
  bookProgress: {},
  audioPreference: "original",
  subtitleLanguage: "English",
};

const titles = [
  title("loved", ["dark"], 120, "Thriller"),
  title("cozy", ["warm", "comfort"], 92, "Comedy", true),
  title("saved", ["quiet"], 110, "Drama"),
  title("new-wonder", ["wonder", "beautiful"], 98, "Fantasy", true),
  title("new-edge", ["tense", "kinetic"], 130, "Action"),
  title("avoid", ["warm"], 90, "Comedy", true),
];

test("decision picks honor a mood clue and never return less-like titles", () => {
  const picks = buildDecisionPicks({
    profile,
    titles,
    clue: { kind: "mood", value: "wonder", label: "Give me wonder" },
    exploration: "balanced",
  });
  assert.equal(picks[0].title.id, "new-wonder");
  assert.equal(picks.some((pick) => pick.title.id === "avoid"), false);
});

test("kids company only returns family titles when enough are available", () => {
  const familyTitles = [
    ...titles,
    title("family-two", ["playful"], 95, "Animation", true),
  ];
  const picks = buildDecisionPicks({
    profile,
    titles: familyTitles,
    clue: { kind: "company", value: "kids", label: "Kids are here" },
    exploration: "balanced",
  });
  assert.equal(picks.length, 3);
  assert.equal(picks.every((pick) => pick.title.family), true);
});

test("familiar and adventurous modes deliberately produce different first choices", () => {
  const familiar = buildDecisionPicks({
    profile,
    titles,
    clue: { kind: "none" },
    exploration: "familiar",
  });
  const adventurous = buildDecisionPicks({
    profile,
    titles,
    clue: { kind: "none" },
    exploration: "adventurous",
  });
  assert.notEqual(familiar[0].title.id, adventurous[0].title.id);
  assert.ok(["loved", "cozy", "saved"].includes(familiar[0].title.id));
  assert.ok(!["loved", "cozy", "saved"].includes(adventurous[0].title.id));
});

test("a time clue excludes titles outside the chosen window", () => {
  const picks = buildDecisionPicks({
    profile,
    titles,
    clue: { kind: "duration", value: "short", label: "Under 100 minutes" },
    exploration: "balanced",
  });
  assert.equal(picks.every((pick) => pick.title.minutes <= 100), true);
});

test("availability guides an open decision but never overrides an explicit mood", () => {
  const open = buildDecisionPicks({
    profile,
    titles,
    availableIds: ["cozy"],
    clue: { kind: "none" },
    exploration: "balanced",
  });
  assert.equal(open[0].title.id, "cozy");

  const wonder = buildDecisionPicks({
    profile,
    titles,
    availableIds: ["loved"],
    clue: { kind: "mood", value: "wonder", label: "Give me wonder" },
    exploration: "balanced",
  });
  assert.equal(wonder[0].title.id, "new-wonder");
});
