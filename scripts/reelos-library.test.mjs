import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  HOME_SHELF_LIMIT,
  applyLibraryLimit,
  cacheIsFresh,
  canServeStale,
  createLibraryCache,
  createTokenCache,
  dedupeLibraryTitles,
  libraryItemsUrl,
  mapJellyfinItem,
  mergeShelf,
  parseLibraryLimit,
  serveLibrary,
  shelfTitleKey,
  titleYear,
} from "./reelos-library.mjs";

const sampleItem = {
  Id: "jf-1",
  Name: "Night Harbor",
  Type: "Movie",
  ProductionYear: 2024,
  Overview: "A very long synopsis that used to ride every /api/library payload.",
  ProviderIds: { Tmdb: "550" },
};

function titleFrom(it, host = "10.0.0.5") {
  return mapJellyfinItem(it, host);
}

test("Home shelf limit stays 24 and parser rejects junk", () => {
  assert.equal(HOME_SHELF_LIMIT, 24);
  assert.equal(parseLibraryLimit(null), null);
  assert.equal(parseLibraryLimit("24"), 24);
  assert.equal(parseLibraryLimit("-1"), null);
  assert.equal(parseLibraryLimit("99999"), 2000);
});

test("Jellyfin Items URL is lean: no Overview, optional Limit", () => {
  const full = libraryItemsUrl();
  assert.match(full, /Fields=ProviderIds/);
  assert.match(full, /EnableImages=false/);
  assert.match(full, /EnableTotalRecordCount=false/);
  assert.doesNotMatch(full, /Overview/);
  assert.doesNotMatch(full, /(?:\?|&)Limit=/);

  const home = libraryItemsUrl({ limit: 24 });
  assert.match(home, /(?:\?|&)Limit=24/);
  assert.doesNotMatch(home, /Overview/);
});

test("mapJellyfinItem drops Overview and keeps real ids", () => {
  const t = titleFrom(sampleItem);
  assert.equal(t.id, "tmdb-550");
  assert.equal(t.title, "Night Harbor");
  assert.equal(t.overview, "");
  assert.equal(t.jellyfinId, "jf-1");
  assert.equal(t.poster, "http://10.0.0.5:8096/Items/jf-1/Images/Primary");
});

test("Home shelf collapses duplicate Interstellar / Expanse / Museum rows", () => {
  const interstellar = (id, poster) =>
    titleFrom({
      Id: id,
      Name: "Interstellar",
      Type: "Movie",
      ProductionYear: 2014,
      ProviderIds: { Tmdb: "157336" },
    }, "10.0.0.5");
  const museumBare = titleFrom({
    Id: "jf-museum-empty",
    Name: "Night at the Museum",
    Type: "Movie",
    ProductionYear: 2006,
    ProviderIds: {},
  });
  museumBare.poster = "";
  const museumArt = titleFrom({
    Id: "jf-museum-art",
    Name: "Night at the Museum",
    Type: "Movie",
    ProductionYear: 2006,
    ProviderIds: { Tmdb: "1593" },
  });
  const expanseArt = titleFrom({
    Id: "jf-expanse",
    Name: "The Expanse",
    Type: "Series",
    ProductionYear: 2015,
    ProviderIds: { Tvdb: "280619", Tmdb: "63639" },
  });
  const expanseBare = titleFrom({
    Id: "jf-expanse-ph",
    Name: "The Expanse",
    Type: "Series",
    ProductionYear: 2015,
    ProviderIds: {},
  });
  expanseBare.poster = "";
  const out = dedupeLibraryTitles([
    interstellar("jf-a"),
    interstellar("jf-b"),
    interstellar("jf-c"),
    museumBare,
    museumArt,
    museumBare,
    expanseBare,
    expanseArt,
  ]);
  const titles = out.map((t) => t.title);
  assert.equal(titles.filter((n) => n === "Interstellar").length, 1);
  assert.equal(titles.filter((n) => n === "Night at the Museum").length, 1);
  assert.equal(titles.filter((n) => n === "The Expanse").length, 1);
  assert.equal(out.find((t) => t.title === "Night at the Museum").jellyfinId, "jf-museum-art");
  assert.equal(out.find((t) => t.title === "The Expanse").jellyfinId, "jf-expanse");
  assert.equal(shelfTitleKey(interstellar("jf-a")), "movie:interstellar");
});

test("Home shelf keeps remakes: Dune 1984 is not a duplicate of Dune 2021", () => {
  const dune = (id, year, tmdb) =>
    titleFrom({
      Id: id,
      Name: "Dune",
      Type: "Movie",
      ProductionYear: year,
      ProviderIds: { Tmdb: tmdb },
    });
  const out = dedupeLibraryTitles([dune("jf-dune-84", 1984, "841"), dune("jf-dune-21", 2021, "438631")]);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((t) => t.year).sort(),
    [1984, 2021],
  );
});

test("an unmatched copy with no year still collapses into the matched row", () => {
  const matched = titleFrom({
    Id: "jf-wick",
    Name: "John Wick",
    Type: "Movie",
    ProductionYear: 2014,
    ProviderIds: { Tmdb: "245891" },
  });
  const bare = titleFrom({ Id: "jf-wick-2", Name: "John Wick", Type: "Movie", ProviderIds: {} });
  bare.poster = "";
  assert.equal(titleYear(bare), 0);
  for (const order of [
    [matched, bare, bare],
    [bare, matched, bare],
  ]) {
    const out = dedupeLibraryTitles(order);
    assert.equal(out.length, 1);
    assert.equal(out[0].jellyfinId, "jf-wick");
    assert.equal(out[0].year, 2014);
  }
  // A no-year copy must not bridge two real remakes into one row.
  const later = titleFrom({
    Id: "jf-wick-4",
    Name: "John Wick",
    Type: "Movie",
    ProductionYear: 2023,
    ProviderIds: { Tmdb: "603692" },
  });
  const bridged = dedupeLibraryTitles([matched, bare, later]);
  assert.equal(bridged.length, 2);
  assert.deepEqual(
    bridged.map((t) => t.year).sort(),
    [2014, 2023],
  );
});

test("token cache hits by user/PIN and expires", () => {
  let now = 1_000;
  const tokens = createTokenCache({ ttlMs: 100, now: () => now });
  assert.equal(tokens.get("ada", "pin"), null);
  tokens.set("ada", "pin", { token: "t1", id: "u1" });
  assert.deepEqual(tokens.get("ada", "pin"), { token: "t1", id: "u1" });
  assert.equal(tokens.get("ada", "other"), null);
  now = 1_200;
  assert.equal(tokens.get("ada", "pin"), null);
});

test("stale complete cache is served without waiting on Jellyfin", async () => {
  const cache = createLibraryCache();
  cache.write([titleFrom(sampleItem)], { now: 1, complete: true });
  let fetches = 0;
  const t0 = Date.now();
  const out = await serveLibrary({
    url: "/api/library?limit=24",
    host: "10.0.0.5",
    now: 2_000,
    ttlMs: 30_000,
    cache,
    getAuth: async () => {
      throw new Error("auth should not run on stale hit");
    },
    fetchItems: async () => {
      fetches += 1;
      await new Promise((r) => setTimeout(r, 80));
      return { Items: [] };
    },
  });
  const elapsed = Date.now() - t0;
  assert.equal(out.fromCache, true);
  assert.equal(out.titles.length, 1);
  assert.equal(out.titles[0].id, "tmdb-550");
  assert.equal(fetches, 0);
  assert.ok(elapsed < 20, `stale serve took ${elapsed}ms`);
});

test("cold limited fetch writes incomplete cache and does not invent titles", async () => {
  const cache = createLibraryCache();
  const out = await serveLibrary({
    url: "/api/library?limit=24",
    host: "box.local",
    now: 5,
    cache,
    getAuth: async () => ({ token: "tok", id: "u" }),
    fetchItems: async (_auth, limit) => {
      assert.equal(limit, 24);
      return { Items: [sampleItem] };
    },
  });
  assert.equal(out.fromCache, false);
  assert.equal(out.titles.length, 1);
  assert.equal(cache.read().complete, false);

  const empty = await serveLibrary({
    url: "/api/library?fresh=1",
    host: "box.local",
    now: 6,
    cache,
    getAuth: async () => ({ token: "tok", id: "u" }),
    fetchItems: async () => ({ Items: [] }),
  });
  assert.deepEqual(empty.titles, []);
  assert.equal(empty.error, null);
});

test("auth miss with no cache stays empty; with cache keeps last real titles", async () => {
  const empty = await serveLibrary({
    url: "/api/library",
    host: "box.local",
    cache: createLibraryCache(),
    getAuth: async () => null,
    fetchItems: async () => ({ Items: [sampleItem] }),
  });
  assert.deepEqual(empty.titles, []);
  assert.match(empty.error, /Jellyfin/);

  const cache = createLibraryCache();
  cache.write([titleFrom(sampleItem)], { now: 1, complete: true });
  const stale = await serveLibrary({
    url: "/api/library",
    host: "box.local",
    cache,
    getAuth: async () => null,
    fetchItems: async () => ({ Items: [] }),
  });
  assert.equal(stale.titles[0].id, "tmdb-550");
});

test("mergeShelf limited fetch does not shrink a larger shelf", () => {
  const a = titleFrom(sampleItem);
  const b = titleFrom({ ...sampleItem, Id: "jf-2", ProviderIds: { Tmdb: "551" }, Name: "Other" });
  assert.deepEqual(mergeShelf([a, b], [a], true).map((t) => t.id), ["tmdb-550", "tmdb-551"]);
  assert.deepEqual(mergeShelf([a, b], [a], false).map((t) => t.id), ["tmdb-550"]);
  assert.equal(applyLibraryLimit([a, b], 1).length, 1);
});

test("full request waits on refresh when only a Home slice is cached", async () => {
  const cache = createLibraryCache();
  const slice = titleFrom(sampleItem);
  const extra = titleFrom({ ...sampleItem, Id: "jf-2", ProviderIds: { Tmdb: "551" }, Name: "Other" });
  cache.write([slice], { now: 1, complete: false });
  let fetches = 0;
  const out = await serveLibrary({
    url: "/api/library",
    host: "10.0.0.5",
    now: 2,
    cache,
    getAuth: async () => ({ token: "tok" }),
    fetchItems: async () => {
      fetches += 1;
      return { Items: [sampleItem] };
    },
    refresh: async () => {
      cache.write([slice, extra], { now: 3, complete: true });
    },
  });
  assert.equal(fetches, 0);
  assert.equal(out.fromCache, true);
  assert.deepEqual(
    out.titles.map((t) => t.id),
    ["tmdb-550", "tmdb-551"],
  );
});

test("plugin and Home wire the lean /api/library path", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const store = readFileSync(join(root, "src/lib/store.ts"), "utf8");
  assert.match(plugin, /serveLibrary/);
  assert.match(plugin, /libraryItemsUrl/);
  assert.doesNotMatch(plugin, /Fields=Overview,ProviderIds/);
  assert.match(home, /hydrateShelf\(\{ limit: 24 \}\)/);
  assert.match(store, /shelf: s\.shelf/);
  assert.doesNotMatch(store, /if \(get\(\)\.shelf\.length\) return/);
});

test("cache freshness helper", () => {
  assert.equal(canServeStale({ titles: [] }), false);
  assert.equal(canServeStale({ titles: [titleFrom(sampleItem)] }), true);
  assert.equal(cacheIsFresh({ titles: [1], at: 10 }, 20, 15), true);
  assert.equal(cacheIsFresh({ titles: [1], at: 10 }, 30, 15), false);
});
