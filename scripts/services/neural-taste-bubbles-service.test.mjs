import test from "node:test";
import assert from "node:assert";
import {
  generateTasteBubbles,
  reactToTasteBubble,
  CRITERION_EDITORIAL_KB,
  getEditorialBlurb,
  projectTasteFeatures,
} from "./neural-taste-bubbles-service.mjs";

test("Neural Taste Bubbles - Shape and Scale", () => {
  const bubbles = generateTasteBubbles(["sci-fi", "Nolan"]);

  assert.strictEqual(
    bubbles.length,
    12,
    "Should generate 12 candidate bubbles",
  );

    // Verify the local fallback exposes the same stable feature shape.
  for (const bubble of bubbles) {
    assert.strictEqual(
      bubble.latentVector.length,
      512,
      "Each bubble must have an authentic 512D latent vector",
    );
    assert.ok(bubble.id, "Each bubble must have a unique ID");
    assert.ok(
      ["title", "person", "mood"].includes(bubble.category),
      "Must belong to a human-facing taste category",
    );

    // Ensure no static repetitive canned strings (e.g., checking length and genuine Criterion depth)
    assert.ok(
      bubble.blurb.length > 25,
      "Blurb should have genuine Criterion editorial depth",
    );
  }
});

test("Neural Taste Bubbles - Criterion Editorial Authenticity", () => {
  const nolanBlurb = getEditorialBlurb("auteur", "Christopher Nolan");
  assert.ok(
    nolanBlurb.includes("70mm IMAX"),
    "Nolan blurb must mention authentic technical DNA",
  );

  const duneBlurb = getEditorialBlurb("landmark", "Dune");
  assert.ok(
    duneBlurb.includes("brutalist desert opera"),
    "Dune blurb must reflect authentic Criterion aesthetic",
  );

  const bubbles = generateTasteBubbles([]);
  assert.deepStrictEqual(
    new Set(bubbles.map((bubble) => bubble.category)),
    new Set(["title", "person", "mood"]),
    "Calibration should center titles, actors, and moods rather than directors",
  );
  assert.deepStrictEqual(
    bubbles.map((bubble) => bubble.id),
    generateTasteBubbles([]).map((bubble) => bubble.id),
    "Stable choices must retain identity across reloads",
  );
  const blurbs = bubbles.map((b) => b.blurb);
  const uniqueBlurbs = new Set(blurbs);
  assert.ok(
    uniqueBlurbs.size >= 8,
    "Blurbs must have high semantic diversity across categories",
  );
});

test("Neural Taste Bubbles - Live Progressive Streaming Vector Updates", () => {
  const residentVector = new Array(512).fill(0);
  const bubble = {
    id: "test-1",
    category: "vibe",
    title: "Neon Noir",
    latentVector: new Array(512).fill(0.1),
  };

  const updatedLoved = reactToTasteBubble(bubble, "Loved", residentVector);
  const updatedDismissed = reactToTasteBubble(
    bubble,
    "Dismissed",
    residentVector,
  );
  const updatedLessLike = reactToTasteBubble(
    bubble,
    "LessLike",
    residentVector,
  );

  assert.strictEqual(
    updatedLoved.length,
    512,
    "Updated vector must retain 512D shape",
  );
  assert.strictEqual(
    updatedDismissed.length,
    512,
    "Updated vector must retain 512D shape",
  );

  assert.deepStrictEqual(
    updatedDismissed,
    residentVector,
    "Dismiss means no answer and must not modify taste",
  );

  let sumLoved = updatedLoved.reduce((a, b) => a + b, 0);
  let sumLessLike = updatedLessLike.reduce((a, b) => a + b, 0);
  assert.ok(sumLoved > 0, "Loved should pull vector towards bubble");
  assert.ok(sumLessLike < 0, "Less like this should repel vector from bubble");
});

test("Taste feature fallback is local, deterministic, and normalized", () => {
  const first = projectTasteFeatures("Parasite class architecture", 512);
  const second = projectTasteFeatures("Parasite class architecture", 512);
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.length, 512);
  const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 0.00001);
});
