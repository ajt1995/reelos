import assert from "node:assert/strict";
import { test } from "node:test";
import { houseHomeShelf, houseRawShelf, HOUSE_UNMATCHED_DUMP, mergeLibraryJson } from "./cloud-house-shelf.mjs";
import { isDumpTwinCard } from "./reelos-library.mjs";

test("cloud house shelf: named titles win dump twins; unmatched dump stays removable", () => {
  const home = houseHomeShelf().map((t) => t.title);
  assert.deepEqual([...home].sort(), ["Reacher", "Silo", "The Rookie", HOUSE_UNMATCHED_DUMP.title].sort());
  assert.ok(!home.some((n) => /UIndex org - Silo|Torrenting|Il Ponte|UIndex org - The Rookie/i.test(n)));
  assert.equal(isDumpTwinCard(HOUSE_UNMATCHED_DUMP), true);
  const merged = mergeLibraryJson({ titles: [] });
  assert.ok(merged.titles.some((t) => t.title === "The Rookie"));
  assert.ok(!merged.titles.some((t) => t.title === "www UIndex org - Silo"));
  assert.equal(houseRawShelf().length > merged.titles.length, true);
});
