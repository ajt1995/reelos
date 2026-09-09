import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { isLiveEngineTitleId, titleInCache } from "./adapter.ts";
import type { Title } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function title(id: string): Title {
  return {
    id,
    kind: id.startsWith("tmdb-tv-") ? "tv" : "movie",
    title: id,
    year: 2014,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "4k",
    popularity: 50,
  };
}

test("live Seerr/TMDB era ids are not lab-Cached (no Discover glow)", () => {
  assert.equal(isLiveEngineTitleId("tmdb-157336"), true);
  assert.equal(isLiveEngineTitleId("tmdb-286217"), true);
  assert.equal(isLiveEngineTitleId("tmdb-tv-48891"), true);
  assert.equal(isLiveEngineTitleId("tmdb-tv-62560"), true);
  assert.equal(titleInCache(title("tmdb-157336")), false);
  assert.equal(titleInCache(title("tmdb-286217")), false);
  assert.equal(titleInCache(title("tmdb-tv-48891")), false);
  assert.equal(titleInCache(title("tmdb-tv-62560")), false);
  assert.equal(titleInCache(title("night-harbor")), true);
  assert.equal(titleInCache(title("hollow-broadcast")), false);
});

test("Discover search cards do not take request, progress, or Cached glow", () => {
  const discover = readFileSync(join(root, "src/components/discover-view.tsx"), "utf8");
  const card = readFileSync(join(root, "src/components/title-card.tsx"), "utf8");
  const adapter = readFileSync(join(root, "src/lib/adapter.ts"), "utf8");
  assert.match(discover, /\/api\/lookup\?q=/);
  assert.match(discover, /<TitleCard key=\{t\.id\} title=\{t\} \/>/);
  assert.doesNotMatch(discover, /request=\{/);
  assert.doesNotMatch(discover, /progress=\{/);
  assert.doesNotMatch(discover, /In progress/i);
  assert.match(card, /showCache/);
  assert.match(adapter, /isLiveEngineTitleId/);
  assert.match(adapter, /tmdb-\|tvdb-\|jf-/);
});
