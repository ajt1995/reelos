import assert from "node:assert/strict";
import { test } from "node:test";
import type { TasteItem } from "../experience/experience-catalog.ts";
import { nextTasteReaction, tasteFieldViewport } from "../experience/taste-field.ts";

const items: TasteItem[] = [
  { id: "batman", title: "The Batman", subtitle: "Crime · rain", kind: "title" },
  { id: "rain", title: "Slow rain", subtitle: "The Batman · neon", kind: "mood" },
  { id: "actor", title: "A Person", subtitle: "A film", kind: "person" },
  { id: "sun", title: "Sunny day", subtitle: "Comedy", kind: "mood" },
];

test("normal taste taps progress from Like to Love without cycling Love away", () => {
  assert.equal(nextTasteReaction(), "like");
  assert.equal(nextTasteReaction("like"), "love");
  assert.equal(nextTasteReaction("love"), "love");
  assert.equal(nextTasteReaction("cozy"), "like");
});

test("the field replenishes without dismissed or just-departed bubbles", () => {
  const viewport = tasteFieldViewport(
    items,
    { reactions: {}, dismissedIds: ["sun"], lessLikeIds: [] },
    ["actor"],
    1,
    4,
  );
  assert.deepEqual(new Set(viewport.map((item) => item.id)), new Set(["batman", "rain"]));
});

test("positive signals affect subsequent choices while preserving people and moods", () => {
  const viewport = tasteFieldViewport(
    items,
    { reactions: { rain: "love" }, dismissedIds: [], lessLikeIds: [] },
    [],
    0,
    3,
  );
  assert.ok(viewport.some((item) => item.kind === "person"));
  assert.ok(viewport.some((item) => item.kind === "mood"));
  assert.ok(viewport.some((item) => item.id === "batman"));
});
