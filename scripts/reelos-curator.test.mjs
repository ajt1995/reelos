import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  curatorPath,
  filterCuratorHidden,
  filterLibraryTitles,
  hideCuratorTitle,
  readCurator,
  resetCurator,
  titleIsCuratorHidden,
} from "./reelos-curator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Not interested persists on the box and reset clears it", () => {
  const state = mkdtempSync(join(tmpdir(), "reelos-curator-"));
  try {
    const fight = { id: "tmdb-550", ids: ["tmdb-550"], title: "Fight Club", year: 1999, kind: "movie" };
    const wick = { id: "tmdb-245891", ids: ["tmdb-245891", "jf-wick"], jellyfinId: "wick", title: "John Wick", year: 2014, kind: "movie" };
    const picks = [fight, { id: "tmdb-17431", title: "Moon", year: 2009, kind: "movie" }];
    const hidden = hideCuratorTitle(fight, state);
    assert.equal(hidden.ok, true);
    assert.ok(hidden.hidden.includes("tmdb-550"));
    assert.equal(readFileSync(curatorPath(state), "utf8").includes("tmdb-550"), true);
    assert.equal(titleIsCuratorHidden(fight, readCurator(state)), true);
    const filtered = filterCuratorHidden(picks, readCurator(state));
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["tmdb-17431"],
    );
    const library = filterLibraryTitles([wick, fight]);
    assert.deepEqual(
      library.map((t) => t.id),
      ["tmdb-245891", "tmdb-550"],
      "owned library is not filtered by curator hide",
    );
    const cleared = resetCurator(state);
    assert.equal(cleared.count, 0);
    assert.deepEqual(
      filterCuratorHidden(picks, readCurator(state)).map((t) => t.id),
      ["tmdb-550", "tmdb-17431"],
    );
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("curator module never talks to Google", () => {
  const src = readFileSync(join(root, "scripts/reelos-curator.mjs"), "utf8");
  assert.doesNotMatch(src, /google|oauth|accounts\.google/i);
});

test("Discover UI and Settings expose Not interested / Reset curator preferences", () => {
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  const card = readFileSync(join(root, "src/components/title-card.tsx"), "utf8");
  const settings = readFileSync(join(root, "src/components/settings-view.tsx"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const library = readFileSync(join(root, "src/components/library-view.tsx"), "utf8");
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  assert.match(card, /Not interested/);
  assert.match(discover, /onHide/);
  assert.match(discover, /\/api\/curator/);
  assert.match(settings, /Reset curator preferences/);
  assert.match(settings, /\/api\/curator\/reset/);
  assert.doesNotMatch(home, /Not interested/);
  assert.doesNotMatch(library, /filterCuratorHidden/);
  assert.match(plugin, /\/api\/curator/);
  assert.match(plugin, /resetCurator/);
  assert.match(plugin, /excludeHidden: readCurator/);
  const libraryHandler = plugin.slice(plugin.indexOf("async function handleLibrary"), plugin.indexOf("async function handleDisks"));
  assert.doesNotMatch(libraryHandler, /filterCuratorHidden/);
  assert.doesNotMatch(libraryHandler, /readCurator/);
});
