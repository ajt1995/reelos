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
  likeCuratorTitle,
  mergeLikedSimilar,
  rankDiscoverByLikes,
  readCurator,
  resetCurator,
  titleIsCuratorHidden,
  titleIsCuratorLiked,
  voteCuratorTitle,
} from "./reelos-curator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Not interested persists on the box and reset clears it", () => {
  const state = mkdtempSync(join(tmpdir(), "reelos-curator-"));
  try {
    const heat = { id: "tmdb-949", ids: ["tmdb-949"], title: "Heat", year: 1995, kind: "movie" };
    const zodiac = { id: "tmdb-1949", title: "Zodiac", year: 2007, kind: "movie" };
    const prisoners = {
      id: "tmdb-146233",
      ids: ["tmdb-146233", "jf-prisoners"],
      jellyfinId: "prisoners",
      title: "Prisoners",
      year: 2013,
      kind: "movie",
    };
    const picks = [heat, zodiac];
    const hidden = hideCuratorTitle(heat, state);
    assert.equal(hidden.ok, true);
    assert.ok(hidden.hidden.includes("tmdb-949"));
    assert.equal(readFileSync(curatorPath(state), "utf8").includes("tmdb-949"), true);
    assert.equal(titleIsCuratorHidden(heat, readCurator(state)), true);
    const filtered = filterCuratorHidden(picks, readCurator(state));
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["tmdb-1949"],
    );
    const library = filterLibraryTitles([prisoners, heat]);
    assert.deepEqual(
      library.map((t) => t.id),
      ["tmdb-146233", "tmdb-949"],
      "owned library is not filtered by curator hide",
    );
    const cleared = resetCurator(state);
    assert.equal(cleared.count, 0);
    assert.deepEqual(
      filterCuratorHidden(picks, readCurator(state)).map((t) => t.id),
      ["tmdb-949", "tmdb-1949"],
    );
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("Like boosts similar in Discover and does not hide Home/Library", () => {
  const state = mkdtempSync(join(tmpdir(), "reelos-curator-like-"));
  try {
    const heat = { id: "tmdb-949", ids: ["tmdb-949"], title: "Heat", year: 1995, kind: "movie" };
    const sicario = { id: "tmdb-273481", title: "Sicario", year: 2015, kind: "movie" };
    const nightcrawler = { id: "tmdb-242582", title: "Nightcrawler", year: 2014, kind: "movie" };
    const liked = likeCuratorTitle(heat, state);
    assert.ok(liked.liked.includes("tmdb-949"));
    assert.equal(titleIsCuratorLiked(heat, readCurator(state)), true);
    assert.equal(titleIsCuratorHidden(heat, readCurator(state)), false);
    const discover = [nightcrawler, sicario, heat];
    const ranked = rankDiscoverByLikes(discover, liked.liked);
    assert.equal(ranked[0].id, "tmdb-949");
    const merged = mergeLikedSimilar([nightcrawler], [sicario], { limit: 8 });
    assert.deepEqual(
      merged.map((t) => t.id),
      ["tmdb-273481", "tmdb-242582"],
    );
    const library = filterLibraryTitles([heat, sicario]);
    assert.deepEqual(
      library.map((t) => t.id),
      ["tmdb-949", "tmdb-273481"],
    );
    voteCuratorTitle(heat, "dislike", state);
    assert.equal(titleIsCuratorHidden(heat, readCurator(state)), true);
    assert.equal(titleIsCuratorLiked(heat, readCurator(state)), false);
    resetCurator(state);
    assert.deepEqual(readCurator(state).liked, []);
    assert.deepEqual(readCurator(state).hidden, []);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("curator module never talks to Google", () => {
  const src = readFileSync(join(root, "scripts/reelos-curator.mjs"), "utf8");
  assert.doesNotMatch(src, /google|oauth|accounts\.google/i);
});

test("Discover UI and Settings expose Like / Not interested / Reset curator preferences", () => {
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  const card = readFileSync(join(root, "src/components/title-card.tsx"), "utf8");
  const settings = readFileSync(join(root, "src/components/settings-view.tsx"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const library = readFileSync(join(root, "src/components/library-view.tsx"), "utf8");
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const title = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  const useCurator = readFileSync(join(root, "src/lib/use-curator.ts"), "utf8");
  assert.match(card, /Not interested/);
  assert.match(card, /aria-label="Like"/);
  assert.match(card, /size-11/);
  assert.match(discover, /onVote/);
  assert.match(discover, /useCurator/);
  assert.match(useCurator, /\/api\/curator/);
  assert.match(discover, /voteDiscover/);
  assert.match(title, /onVote/);
  assert.match(title, /More like this/);
  assert.match(settings, /Reset curator preferences/);
  assert.match(settings, /\/api\/curator\/reset/);
  assert.match(settings, /likes and Not interested/);
  assert.doesNotMatch(home, /Not interested/);
  assert.doesNotMatch(library, /filterCuratorHidden/);
  assert.match(plugin, /\/api\/curator/);
  assert.match(plugin, /resetCurator/);
  assert.match(plugin, /voteCuratorTitle/);
  assert.match(plugin, /likedSimilarTitles/);
  assert.match(plugin, /excludeHidden: readCurator/);
  const libraryHandler = plugin.slice(plugin.indexOf("async function handleLibrary"), plugin.indexOf("async function handleDisks"));
  assert.doesNotMatch(libraryHandler, /filterCuratorHidden/);
  assert.doesNotMatch(libraryHandler, /readCurator/);
});
