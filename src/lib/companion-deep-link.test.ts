import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCompanionDeepLink,
  resolveCompanionSeed,
} from "../experience/companion-deep-link.ts";
import type { ExperienceTitle } from "../experience/experience-catalog.ts";
import type { DebridConnection } from "../experience/source-access.ts";

const disconnected: DebridConnection = {
  enabled: false,
  provider: "torbox",
  status: "disabled",
};

const connected: DebridConnection = {
  enabled: true,
  provider: "torbox",
  status: "connected",
};

function title(
  patch: Partial<ExperienceTitle> = {},
): ExperienceTitle {
  return {
    id: "series-one",
    playbackId: "jf-123",
    title: "Series One",
    year: 2024,
    kind: "series",
    genres: ["Drama"],
    poster: "/poster.jpg",
    backdrop: "/backdrop.jpg",
    note: "",
    people: [],
    moods: [],
    minutes: 50,
    family: true,
    sources: [{ kind: "personal_import", verified: true }],
    ...patch,
  };
}

test("legacy companion query keeps a safe id and valid episode coordinates", () => {
  assert.deepEqual(
    parseCompanionDeepLink({ id: "jf-123", season: "2", episode: "7" }),
    { id: "jf-123", season: 2, episode: 7 },
  );
});

test("malformed companion values are ignored without becoming lookup paths", () => {
  assert.equal(parseCompanionDeepLink({ id: "../../secrets", season: 1 }), undefined);
  assert.deepEqual(
    parseCompanionDeepLink({ id: "jf-123", season: "NaN", episode: -4 }),
    { id: "jf-123", season: undefined, episode: undefined },
  );
});

test("an authorized personal title seeds the matching episode", () => {
  const seed = resolveCompanionSeed(
    { id: "jf-123", season: 2, episode: 7 },
    [title()],
    disconnected,
    false,
  );
  assert.equal(seed?.title.id, "series-one");
  assert.equal(seed?.season, 2);
  assert.equal(seed?.episode, 7);
});

test("unavailable provider titles and unknown ids fail closed", () => {
  const providerTitle = title({
    sources: [{ kind: "debrid", provider: "torbox", verified: true }],
  });
  assert.equal(
    resolveCompanionSeed({ id: "jf-123" }, [providerTitle], disconnected, false),
    undefined,
  );
  assert.equal(
    resolveCompanionSeed({ id: "missing" }, [title()], connected, false),
    undefined,
  );
});

test("child profiles cannot hydrate an adult companion context", () => {
  assert.equal(
    resolveCompanionSeed(
      { id: "jf-123", season: 1, episode: 1 },
      [title({ family: false })],
      connected,
      true,
    ),
    undefined,
  );
});

test("movie links ignore meaningless season and episode coordinates", () => {
  const seed = resolveCompanionSeed(
    { id: "movie-one", season: 3, episode: 4 },
    [title({ id: "movie-one", playbackId: "movie-one", kind: "movie" })],
    disconnected,
    false,
  );
  assert.equal(seed?.season, undefined);
  assert.equal(seed?.episode, undefined);
});
