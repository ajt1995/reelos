import { test } from "node:test";
import assert from "node:assert/strict";
import { ReelOSGeminiClient } from "./ai/gemini-client.ts";

test("ReelOSGeminiClient - initializes unconfigured when GEMINI_API_KEY is empty", () => {
  const client = new ReelOSGeminiClient({ apiKey: "" });
  assert.equal(client.isConfigured(), false);
});

test("ReelOSGeminiClient - deterministic offline grace curation works without API key", async () => {
  const client = new ReelOSGeminiClient({ apiKey: "" });
  const history = [{ title: "Inception", genre: "Sci-Fi" }];
  const catalog = [
    { title: "Interstellar", genre: "Sci-Fi", year: 2014 },
    { title: "The Dark Knight", genre: "Action", year: 2008 },
    { title: "Arrival", genre: "Sci-Fi", year: 2016 },
  ];

  const recommendations = await client.curateEveningShelf(history, catalog);

  assert.equal(recommendations.length, 2); // Both Sci-Fi titles matched
  assert.equal(recommendations[0].title, "Interstellar");
  assert.equal(recommendations[1].title, "Arrival");
  assert.match(recommendations[0].reason, /Locally recommended/);
});

test("ReelOSGeminiClient - fallback pool handles novel genres gracefully", async () => {
  const client = new ReelOSGeminiClient({ apiKey: "" });
  const history = [{ title: "Some Drama", genre: "Drama" }];
  const catalog = [
    { title: "Toy Story", genre: "Animation", year: 1995 },
    { title: "Up", genre: "Animation", year: 2009 },
  ];

  const recommendations = await client.curateEveningShelf(history, catalog);

  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].title, "Toy Story");
});
