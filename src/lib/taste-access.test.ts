import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const catalogSource = readFileSync(
  new URL("../experience/experience-catalog.ts", import.meta.url),
  "utf8",
);
const worldSource = readFileSync(
  new URL("../experience/reelos-world.tsx", import.meta.url),
  "utf8",
);

test("taste calibration includes commercial metadata without a provider", () => {
  assert.match(catalogSource, /The Batman/);
  assert.match(worldSource, /tasteFieldViewport\(\s*TASTE_ITEMS/);
  assert.match(worldSource, /Anything you love belongs here/);
  assert.doesNotMatch(worldSource.match(/function EndlessTasteField[\s\S]*?function ReactionButton/)?.[0] ?? "", /sourceIsAccessible|titleCanUseProvider/);
});

test("dismiss is the only profile gate on taste candidates", () => {
  const policy = catalogSource.match(
    /export function tasteItemsForProfile[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(policy);
  assert.match(policy, /dismissedTasteIds/);
  assert.doesNotMatch(policy, /accessible|provider|debrid|sourceIsAccessible/);
});

test("taste tuning uses the same endless field in setup and profile refinement", () => {
  assert.equal((worldSource.match(/<EndlessTasteField/g) ?? []).length, 2);
  assert.match(worldSource, /Tap to like\. Tap again to love/);
  assert.doesNotMatch(worldSource, /Next batch|Load more|More tastes|training complete/i);
  assert.match(worldSource, /reelos-taste-actions fixed/);
});
