import assert from "node:assert/strict";
import { test } from "node:test";
import { homeShelfRows, mergeShelf, dumpMatchesNamed } from "./shelf.ts";
import type { Title } from "./types.ts";

function title(id: string): Title {
  return {
    id,
    kind: "movie",
    title: id,
    year: 2024,
    rating: 0,
    genres: [],
    overview: "",
    poster: "",
    maxQuality: "4k",
    popularity: 50,
  };
}

test("limited Home merge keeps extra Library titles", () => {
  const prev = [title("a"), title("b"), title("c")];
  const next = [title("a"), title("d")];
  assert.deepEqual(
    mergeShelf(prev, next, true).map((t) => t.id),
    ["a", "d", "b", "c"],
  );
});

test("full Library response replaces the shelf", () => {
  const prev = [title("a"), title("b")];
  const next = [title("c")];
  assert.deepEqual(
    mergeShelf(prev, next, false).map((t) => t.id),
    ["c"],
  );
});

test("limited Home merge drops a persisted hash leftover when named Rick arrives", () => {
  const hash: Title = {
    ...title("jf-103ae87fbbbd9bb920ee3803dcffc570"),
    kind: "tv",
    title: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    year: 0,
    poster: "",
    ids: ["73ceff573dc30bebc3fcf26f61de07b25f927a74"],
    jellyfinId: "103ae87fbbbd9bb920ee3803dcffc570",
    fromHashDump: true,
  };
  const rick: Title = {
    ...title("tvdb-275274"),
    kind: "tv",
    title: "Rick and Morty",
    year: 2013,
    poster: "/p.jpg",
    ids: ["tvdb-275274", "tmdb-tv-60625", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "3d32e281cfcb09816952099c4ff468f6",
  };
  assert.deepEqual(
    mergeShelf([hash, title("tmdb-245891")], [rick, title("tmdb-245891")], true).map((t) => t.title),
    ["Rick and Morty", "tmdb-245891"],
  );
});

test("homeShelfRows keeps named Rick and drops the 73ceff leftover", () => {
  const hash: Title = {
    ...title("jf-103ae87fbbbd9bb920ee3803dcffc570"),
    kind: "tv",
    title: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    year: 0,
    poster: "",
    ids: ["73ceff573dc30bebc3fcf26f61de07b25f927a74"],
    jellyfinId: "103ae87fbbbd9bb920ee3803dcffc570",
    fromHashDump: true,
  };
  const rick: Title = {
    ...title("tvdb-275274"),
    kind: "tv",
    title: "Rick and Morty",
    year: 2013,
    poster: "/p.jpg",
    ids: ["tvdb-275274", "tmdb-tv-60625", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "3d32e281cfcb09816952099c4ff468f6",
  };
  assert.deepEqual(homeShelfRows([hash, rick]).map((t) => t.title), ["Rick and Morty"]);
});

test("homeShelfRows hides org-Silo / Reacher II Ponte dumps when named cards exist", () => {
  const silo = {
    ...title("tvdb-403245"),
    kind: "tv",
    title: "Silo",
    year: 2023,
    poster: "/p.jpg",
    ids: ["tvdb-403245", "tmdb-tv-125988"],
  };
  const orgSilo = {
    ...title("jf-org-silo"),
    kind: "tv",
    title: "org - Silo",
    year: 0,
    poster: "",
    ids: ["jf-org-silo"],
  };
  const torrenting = {
    ...title("jf-tor"),
    kind: "tv",
    title: "www Torrenting com - Silo",
    year: 0,
    poster: "",
    ids: ["jf-tor"],
  };
  const reacher = {
    ...title("tvdb-366924"),
    kind: "tv",
    title: "Reacher",
    year: 2022,
    poster: "/p.jpg",
    ids: ["tvdb-366924", "tmdb-tv-108978"],
  };
  const ponte = {
    ...title("jf-ponte"),
    kind: "tv",
    title: "Reacher II Ponte",
    year: 2026,
    poster: "",
    ids: ["jf-ponte"],
  };
  assert.equal(dumpMatchesNamed(orgSilo, silo), true);
  assert.equal(dumpMatchesNamed(torrenting, silo), true);
  assert.equal(dumpMatchesNamed(ponte, reacher), true);
  assert.deepEqual(
    homeShelfRows([orgSilo, reacher, ponte, torrenting, silo]).map((t) => t.title),
    ["Reacher", "Silo"],
  );
});

test("homeShelfRows hides UIndex Rookie and Reacher episode dumps when named cards exist", () => {
  const rookie = {
    ...title("tvdb-350665"),
    kind: "tv",
    title: "The Rookie",
    year: 2018,
    poster: "/p.jpg",
    ids: ["tvdb-350665", "tmdb-tv-79744"],
  };
  const uindex = {
    ...title("jf-2386"),
    kind: "tv",
    title: "www UIndex org    -    The Rookie",
    year: 0,
    poster: "",
    ids: ["jf-2386"],
    path: "/symlinks/sonarr/www.UIndex.org    -    The.Rookie.S02E14.Casualties.1080p.HEVC.x265-MeGusta",
  };
  const reacher = {
    ...title("tvdb-366924"),
    kind: "tv",
    title: "Reacher",
    year: 2022,
    poster: "/p.jpg",
    ids: ["tvdb-366924", "tmdb-tv-108978"],
  };
  const dump = {
    ...title("jf-598e"),
    kind: "tv",
    title: "Reacher Il Ponte",
    year: 2026,
    poster: "",
    ids: ["jf-598e"],
  };
  assert.equal(dumpMatchesNamed(uindex, rookie), true);
  assert.equal(dumpMatchesNamed(dump, reacher), true);
  assert.deepEqual(
    homeShelfRows([uindex, rookie, dump, reacher, title("tmdb-245891")]).map((t) => t.title),
    ["The Rookie", "Reacher", "tmdb-245891"],
  );
});

test("homeShelfRows hides unmatched year-0 dump leftovers", () => {
  const tpb: Title = {
    ...title("jf-tpb"),
    title: "TPB",
    year: 0,
    poster: "",
    fromDump: true,
    path: "/symlinks/radarr/TPB /Pulp.Fiction.1994.mkv",
  };
  const kaiju: Title = {
    ...title("jf-kaiju"),
    kind: "tv",
    title: "Kaijuu 8-gou (Season 1) [BD",
    year: 0,
    poster: "",
    fromDump: true,
  };
  assert.deepEqual(
    homeShelfRows([tpb, kaiju]).map((t) => t.title),
    [],
  );
});

