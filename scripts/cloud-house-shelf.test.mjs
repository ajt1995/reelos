import assert from "node:assert/strict";
import { test } from "node:test";
import { houseHomeShelf, houseRawShelf, HOUSE_UNMATCHED_DUMP, mergeLibraryJson, mergeLookupJson, idleUpdateStatus } from "./cloud-house-shelf.mjs";
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

test("lookup overlay: house Importing/Coming wins live Watch; idle update is not applying", () => {
  const live = {
    titles: [
      {
        id: "tmdb-tv-79744",
        title: "The Rookie",
        onDiskSeasons: [1, 2, 3, 4, 5, 6, 7, 8],
        importingSeasons: [],
        unreleasedSeasons: [],
        seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        reason: "Stuck at 0%",
      },
    ],
  };
  const merged = mergeLookupJson(live, "tmdb-tv-79744");
  const t = merged.titles[0];
  assert.deepEqual(t.onDiskSeasons, [1]);
  assert.ok(t.importingSeasons.includes(2) && t.importingSeasons.includes(8));
  assert.deepEqual(t.unreleasedSeasons, [9]);
  assert.equal(t.reason, "On disk, importing");
  const idle = idleUpdateStatus();
  assert.equal(idle.running, false);
  assert.equal(idle.held, false);
  assert.equal(idle.library.splashLock, false);
});
