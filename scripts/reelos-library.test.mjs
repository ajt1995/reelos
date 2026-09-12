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
  looksLikeSeasonFolderTitle,
  looksLikeCompletePackTitle,
  mapJellyfinItem,
  mapJellyfinItems,
  mergeShelf,
  parseLibraryLimit,
  serveLibrary,
  shelfTitleKey,
  stripMatchingYear,
  stripCompletePackSuffix,
  stripSeasonFolderSuffix,
  titleYear,
  yearsCompatible,
  looksLikeHashTitle,
  humanTitleFromSceneName,
  identifyLibraryTitle,
  hostPathFromJellyfin,
  dumpSearchPaths,
  repairHashTitles,
  seasonsFromDumpNames,
  hashDumpIds,
  jellyfinHasPrimaryImage,
  UNKNOWN_ON_BOX,
  libraryRowHidden,
  homeShelfRows,
  healRemovedIds,
} from "./reelos-library.mjs";

const sampleItem = {
  Id: "jf-1",
  Name: "Night Harbor",
  Type: "Movie",
  ProductionYear: 2024,
  Overview: "A very long synopsis that used to ride every /api/library payload.",
  ProviderIds: { Tmdb: "550" },
  ImageTags: { Primary: "abc123" },
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
  assert.match(full, /Fields=Path%2CProviderIds/);
  assert.match(full, /EnableImages=true/);
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
  assert.equal(t.poster, "/api/jf/Items/jf-1/Images/Primary?maxWidth=240&quality=70");
});

test("mapJellyfinItem strips a trailing (Year) that matches ProductionYear", () => {
  assert.equal(stripMatchingYear("John Wick (2014)", 2014), "John Wick");
  assert.equal(stripMatchingYear("Night at the Museum (2006)", 2006), "Night at the Museum");
  assert.equal(stripMatchingYear("Interstellar", 2014), "Interstellar");
  assert.equal(stripMatchingYear("Dune (1984)", 2021), "Dune (1984)");
  const t = titleFrom({
    Id: "jf-wick",
    Name: "John Wick (2014)",
    Type: "Movie",
    ProductionYear: 2014,
    ProviderIds: { Tmdb: "245891" },
  });
  assert.equal(t.title, "John Wick");
  assert.equal(t.year, 2014);
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
  assert.ok(out.find((t) => t.title === "The Expanse").ids.includes("tmdb-tv-63639"));
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

test("Home shelf collapses JF season-folder names onto the real series row", () => {
  assert.equal(stripSeasonFolderSuffix("Brooklyn Nine-Nine S01"), "Brooklyn Nine-Nine");
  assert.equal(stripSeasonFolderSuffix("The Walking Dead - Season 1"), "The Walking Dead");
  assert.equal(stripSeasonFolderSuffix("The Walking Dead"), "The Walking Dead");
  assert.equal(
    stripSeasonFolderSuffix(
      "Brooklyn Nine-Nine (2013) Season 1 S01 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 5.1 RZeroX)",
    ),
    "Brooklyn Nine-Nine",
  );
  assert.equal(
    stripSeasonFolderSuffix(
      "The.Expanse.S01.2160p.AMZN.WEB-DL.x265.10bit.HDR.DTS-HD.MA.5.1-SAFETY[rartv]",
    ).replace(/[._]+/g, " ").replace(/\s+/g, " ").trim(),
    "The Expanse",
  );
  assert.equal(
    stripSeasonFolderSuffix("Brooklyn Nine-Nine S01 Season 1 1080p 5.1Ch Web-DL ReEnc-DeeJayAhmed"),
    "Brooklyn Nine-Nine",
  );
  assert.equal(looksLikeSeasonFolderTitle("Brooklyn Nine-Nine S01"), true);
  const b99 = titleFrom({
    Id: "jf-b99",
    Name: "Brooklyn Nine-Nine",
    Type: "Series",
    ProductionYear: 2013,
    ProviderIds: { Tvdb: "269586" },
  });
  const b99s01 = titleFrom({
    Id: "jf-b99-s01",
    Name: "Brooklyn Nine-Nine S01",
    Type: "Series",
    ProductionYear: 2013,
    ProviderIds: {},
  });
  b99s01.poster = "";
  const twd = titleFrom({
    Id: "jf-twd",
    Name: "The Walking Dead",
    Type: "Series",
    ProductionYear: 2010,
    ProviderIds: { Tvdb: "153021" },
  });
  const twds1 = titleFrom({
    Id: "jf-twd-s1",
    Name: "The Walking Dead - Season 1",
    Type: "Series",
    ProductionYear: 2010,
    ProviderIds: {},
  });
  twds1.poster = "";
  const out = dedupeLibraryTitles([b99s01, b99, twd, twds1]);
  assert.equal(out.length, 2);
  assert.equal(
    out.filter((t) => stripSeasonFolderSuffix(t.title) === "Brooklyn Nine-Nine").length,
    1,
  );
  assert.equal(out.filter((t) => stripSeasonFolderSuffix(t.title) === "The Walking Dead").length, 1);
  assert.equal(out.find((t) => t.title === "Brooklyn Nine-Nine").jellyfinId, "jf-b99");
  assert.equal(out.find((t) => t.title === "The Walking Dead").jellyfinId, "jf-twd");
  assert.equal(shelfTitleKey(b99), shelfTitleKey(b99s01));
  assert.equal(shelfTitleKey(twd), shelfTitleKey(twds1));
});

test("jf-only TWD Season 1 (2011) collapses onto the 2010 series even when years disagree", () => {
  // House after 1.2.50.8: PremiereDate year on the season-folder Series ≠ series start.
  const series = titleFrom({
    Id: "jf-9b12",
    Name: "The Walking Dead",
    Type: "Series",
    ProductionYear: 2010,
    ProviderIds: { Tvdb: "153021", Tmdb: "1402" },
  });
  const seasonFolder = titleFrom({
    Id: "jf-c64258",
    Name: "The Walking Dead - Season 1",
    Type: "Series",
    ProductionYear: 2011,
    ProviderIds: {},
  });
  seasonFolder.poster = "";
  assert.equal(shelfTitleKey(series), "tv:thewalkingdead");
  assert.equal(shelfTitleKey(seasonFolder), "tv:thewalkingdead");
  assert.equal(yearsCompatible(2010, 2011, series, seasonFolder), true);
  for (const order of [
    [seasonFolder, series],
    [series, seasonFolder],
  ]) {
    const out = dedupeLibraryTitles(order);
    assert.equal(out.length, 1, JSON.stringify(out.map((t) => [t.title, t.year, t.id])));
    assert.equal(out[0].title, "The Walking Dead");
    assert.equal(out[0].year, 2010);
    assert.equal(out[0].id, "tvdb-153021");
    assert.deepEqual(out[0].ids.filter((i) => /^tmdb-|^tvdb-/.test(i)).sort(), [
      "tmdb-1402",
      "tmdb-tv-1402",
      "tvdb-153021",
    ]);
  }
});

test("remakes with real ids and different years stay separate after season-year relaxation", () => {
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

test("a season folder joins the remake it shares a year with, not the first one scanned", () => {
  const bridge = (id, year, tvdb) =>
    titleFrom({
      Id: id,
      Name: "The Bridge",
      Type: "Series",
      ProductionYear: year,
      ProviderIds: { Tvdb: tvdb },
    });
  const seasonFolder = titleFrom({
    Id: "jf-bridge-s1",
    Name: "The Bridge - Season 1",
    Type: "Series",
    ProductionYear: 2013,
    ProviderIds: {},
  });
  seasonFolder.poster = "";
  const out = dedupeLibraryTitles([bridge("jf-bridge-11", 2011, "248975"), bridge("jf-bridge-13", 2013, "264586"), seasonFolder]);
  assert.equal(out.length, 2, JSON.stringify(out.map((t) => [t.title, t.year, t.id])));
  assert.deepEqual(
    out.map((t) => t.year).sort(),
    [2011, 2013],
  );
  assert.equal(out.find((t) => t.year === 2013).id, "tvdb-264586");
});

test("The EXPANSE Complete dump collapses onto The Expanse series", () => {
  assert.equal(stripCompletePackSuffix("The EXPANSE Complete"), "The EXPANSE");
  assert.equal(stripCompletePackSuffix("The Expanse Complete 2020"), "The Expanse");
  assert.equal(looksLikeCompletePackTitle("The EXPANSE Complete"), true);
  const series = titleFrom({
    Id: "jf-expanse",
    Name: "The Expanse",
    Type: "Series",
    ProductionYear: 2015,
    ProviderIds: { Tvdb: "280619", Tmdb: "63639" },
  });
  const complete = titleFrom({
    Id: "jf-expanse-complete",
    Name: "The EXPANSE Complete",
    Type: "Series",
    ProductionYear: 2020,
    ProviderIds: {},
  });
  complete.poster = "";
  assert.equal(shelfTitleKey(series), shelfTitleKey(complete));
  for (const order of [
    [complete, series],
    [series, complete],
  ]) {
    const out = dedupeLibraryTitles(order);
    assert.equal(out.length, 1, JSON.stringify(out.map((t) => [t.title, t.year, t.id])));
    assert.equal(out[0].id, "tvdb-280619");
    assert.equal(out[0].title, "The Expanse");
    assert.equal(out[0].year, 2015);
  }
});

test("two matched series that differ only by a season suffix stay two rows", () => {
  // Anime split seasons are separate TVDB series that can share a production year.
  const s1 = titleFrom({
    Id: "jf-vs1",
    Name: "Vinland Saga",
    Type: "Series",
    ProductionYear: 2019,
    ProviderIds: { Tvdb: "359274" },
  });
  const s2 = titleFrom({
    Id: "jf-vs2",
    Name: "Vinland Saga S2",
    Type: "Series",
    ProductionYear: 2019,
    ProviderIds: { Tvdb: "421739" },
  });
  const out = dedupeLibraryTitles([s1, s2]);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((t) => t.title).sort(),
    ["Vinland Saga", "Vinland Saga S2"],
  );
  // An unmatched dump of the same name still collapses onto the series row.
  const dump = titleFrom({ Id: "jf-vs3", Name: "Vinland Saga S2", Type: "Series", ProductionYear: 2019 });
  dump.poster = "";
  assert.equal(dedupeLibraryTitles([s1, s2, dump]).length, 2);
  // Different premiere years must not override aliasSafe — still two real series.
  const s2later = titleFrom({
    Id: "jf-vs2b",
    Name: "Vinland Saga S2",
    Type: "Series",
    ProductionYear: 2023,
    ProviderIds: { Tvdb: "421739", Tmdb: "135647" },
  });
  const splitYears = dedupeLibraryTitles([s1, s2later]);
  assert.equal(splitYears.length, 2);
  assert.deepEqual(
    splitYears.map((t) => t.title).sort(),
    ["Vinland Saga", "Vinland Saga S2"],
  );
});

test("a bare season folder name is not stripped to an empty shelf key", () => {
  for (const name of [" S01", "- Season 1", "  Season 2", ".s1"]) {
    assert.equal(stripSeasonFolderSuffix(name), name.trim());
    assert.notEqual(shelfTitleKey({ title: name, kind: "tv" }), "tv:");
  }
  const rows = dedupeLibraryTitles([
    titleFrom({ Id: "jf-a", Name: " S01", Type: "Series" }),
    titleFrom({ Id: "jf-b", Name: "- Season 1", Type: "Series" }),
  ]);
  assert.equal(rows.length, 2);
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

test("full request serves a Home slice immediately and refreshes in the background", async () => {
  const cache = createLibraryCache();
  const slice = titleFrom(sampleItem);
  const extra = titleFrom({ ...sampleItem, Id: "jf-2", ProviderIds: { Tmdb: "551" }, Name: "Other" });
  cache.write([slice], { now: 1, complete: false });
  let fetches = 0;
  let refreshed = 0;
  const t0 = Date.now();
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
      refreshed += 1;
      cache.write([slice, extra], { now: 3, complete: true });
    },
  });
  const elapsed = Date.now() - t0;
  assert.equal(fetches, 0);
  assert.equal(out.fromCache, true);
  assert.deepEqual(out.titles.map((t) => t.id), ["tmdb-550"]);
  assert.equal(refreshed, 1);
  assert.ok(elapsed < 20, `stale serve took ${elapsed}ms`);
});

test("live Jellyfin fetch is not hidden by a stale Remove list", async () => {
  const cache = createLibraryCache();
  const out = await serveLibrary({
    url: "/api/library",
    host: "box.local",
    now: 5,
    cache,
    removedIds: ["tmdb-550", "jf-abc"],
    getAuth: async () => ({ token: "tok", id: "u" }),
    fetchItems: async () => ({ Items: [sampleItem] }),
  });
  assert.equal(out.fromCache, false);
  assert.equal(out.titles.length, 1);
  assert.equal(out.titles[0].id, "tmdb-550");
});

test("plugin and Home wire the lean /api/library path", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const plugin = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const store = readFileSync(join(root, "src/lib/store.ts"), "utf8");
  assert.match(plugin, /serveLibrary/);
  assert.match(plugin, /libraryItemsUrl/);
  assert.match(plugin, /handleJellyfinImage/);
  assert.match(plugin, /\/api\/jf\/Items\//);
  assert.doesNotMatch(plugin, /Fields=Overview,ProviderIds/);
  assert.match(home, /hydrateShelf\(\{ limit: 24, force: true \}\)/);
  assert.doesNotMatch(home, /setInterval/);
  assert.doesNotMatch(home, /visibilitychange/);
  assert.match(home, /jfLive/);
  assert.match(home, /jellyfinHop/);
  assert.match(home, /inFlightRequests\(requests, \{ titles: shelf \}\)/);
  assert.doesNotMatch(home, /\/api\/box/);
  assert.match(store, /shelf: s\.shelf/);
  const rootFile = readFileSync(join(root, "src/routes/__root.tsx"), "utf8");
  assert.match(rootFile, /setHydrated\(\);/);
  assert.match(rootFile, /\/api\/ready\?limit=24/);
  assert.match(rootFile, /applyReadyPayload/);
  assert.match(rootFile, /AbortSignal\.timeout\(4000\)/);
  assert.match(store, /if \(!force && get\(\)\.shelfReady\) return/);
  const sync = readFileSync(join(root, "src/lib/use-sync-requests.ts"), "utf8");
  assert.match(sync, /hydrateShelf\(\{ limit: 24, force: true, fresh: true \}\)/);
});

test("cache freshness helper", () => {
  assert.equal(canServeStale({ titles: [] }), false);
  assert.equal(canServeStale({ titles: [titleFrom(sampleItem)] }), true);
  assert.equal(cacheIsFresh({ titles: [1], at: 10 }, 20, 15), true);
  assert.equal(cacheIsFresh({ titles: [1], at: 10 }, 30, 15), false);
});

test("hash dump names are not human titles", () => {
  assert.equal(looksLikeHashTitle("73ceff573dc30bebc3fcf26f61de07b25f927a74"), true);
  assert.equal(looksLikeHashTitle("a".repeat(64)), true);
  assert.equal(looksLikeHashTitle("Rick and Morty"), false);
  assert.equal(looksLikeHashTitle("Unknown on this box"), false);
});

test("scene names parse a series from SxxExx files without ffprobe", () => {
  const ep = humanTitleFromSceneName(
    "Rick And Morty S04E01 Edge Of Tomorty Rick Die Rickpeat 720p BluRay H264 5.1 BONE.mp4",
  );
  assert.equal(ep.title, "Rick And Morty");
  const dotted = humanTitleFromSceneName("Rick.And Morty S04E10 Star Mort Rickturn Of The Jerri 720p BluRay.mp4");
  assert.equal(dotted.title, "Rick And Morty");
  const movie = humanTitleFromSceneName("Interstellar.2014.2160p.PROPER.IMAX.REMUX.mkv");
  assert.equal(movie.title, "Interstellar");
  assert.equal(movie.year, 2014);
  assert.equal(humanTitleFromSceneName("73ceff573dc30bebc3fcf26f61de07b25f927a74").title, "");
});

test("identifyLibraryTitle uses episode files when JF Name is an infohash", () => {
  const ided = identifyLibraryTitle({
    name: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    path: "/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74",
    files: [
      "Rick And Morty S04E01 Edge Of Tomorty Rick Die Rickpeat 720p BluRay H264 5.1 BONE.mp4",
      "Rick And Morty S04E02 The Old Man And The Seat 720p BluRay H264 5.1 BONE.mp4",
    ],
  });
  assert.equal(ided.title, "Rick And Morty");
  const unknown = identifyLibraryTitle({
    name: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    path: "/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74",
    files: [],
  });
  assert.equal(unknown.title, UNKNOWN_ON_BOX);
});

test("host dump paths never list FUSE /mnt/debrid", () => {
  assert.equal(hostPathFromJellyfin("/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74"), "/mnt/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74");
  assert.equal(hostPathFromJellyfin("/mnt/debrid/__all__/73ceff"), "");
  const paths = dumpSearchPaths("/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74", "73ceff573dc30bebc3fcf26f61de07b25f927a74");
  assert.ok(paths.includes("/mnt/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74"));
  assert.equal(paths.some((p) => p.startsWith("/mnt/debrid")), false);
});

test("hash dump of Rick and Morty S04 collapses onto the tvdb series and keeps jf-*", () => {
  const series = titleFrom({
    Id: "2e58b382fb6f70f674e1e7273b2d05f8",
    Name: "Rick and Morty",
    Type: "Series",
    ProductionYear: 2013,
    ProviderIds: { Tvdb: "275274", Tmdb: "60625" },
  });
  const hashDump = mapJellyfinItems(
    [
      {
        Id: "103ae87fbbbd9bb920ee3803dcffc570",
        Name: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
        Type: "Series",
        ProductionYear: null,
        Path: "/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74",
        ProviderIds: {},
      },
    ],
    "10.0.0.5",
    {
      listFiles: () => [
        "Rick And Morty S04E01 Edge Of Tomorty Rick Die Rickpeat 720p BluRay H264 5.1 BONE.mp4",
      ],
    },
  )[0];
  assert.equal(hashDump.title, "Rick And Morty");
  assert.equal(hashDump.id, "jf-103ae87fbbbd9bb920ee3803dcffc570");
  const out = dedupeLibraryTitles([hashDump, series]);
  assert.equal(out.length, 1, JSON.stringify(out.map((t) => [t.title, t.id])));
  assert.equal(out[0].title, "Rick and Morty");
  assert.equal(out[0].year, 2013);
  assert.equal(out[0].id, "tvdb-275274");
  assert.ok(out[0].ids.includes("jf-103ae87fbbbd9bb920ee3803dcffc570"));
  assert.ok(out[0].ids.includes("tvdb-275274"));
});

test("a removed leftover complete-pack jf id does not hide the tvdb series", () => {
  const series = titleFrom({
    Id: "jf-expanse",
    Name: "The Expanse",
    Type: "Series",
    ProductionYear: 2015,
    ProviderIds: { Tvdb: "280619", Tmdb: "63639" },
  });
  const complete = titleFrom({
    Id: "77e7da0ad1f894e644580d250824ebee",
    Name: "The EXPANSE Complete Season 5 S05 (2020) 1080p AMZN Web-DL x264",
    Type: "Series",
    ProductionYear: 2020,
    ProviderIds: {},
  });
  const out = dedupeLibraryTitles([complete, series]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "tvdb-280619");
  assert.equal(out[0].ids.includes("jf-77e7da0ad1f894e644580d250824ebee"), false);
  assert.equal(libraryRowHidden(out[0], ["jf-77e7da0ad1f894e644580d250824ebee", "77e7da0ad1f894e644580d250824ebee"]), false);
  assert.equal(libraryRowHidden(out[0], ["tvdb-280619"]), true);
});

test("stale cache hash rows repair from dump filenames then collapse", () => {
  const series = titleFrom({
    Id: "jf-rm",
    Name: "Rick and Morty",
    Type: "Series",
    ProductionYear: 2013,
    ProviderIds: { Tvdb: "275274" },
  });
  const cached = titleFrom({
    Id: "103ae87fbbbd9bb920ee3803dcffc570",
    Name: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    Type: "Series",
    ProviderIds: {},
  });
  const repaired = repairHashTitles([cached, series], {
    listFiles: (t) =>
      looksLikeHashTitle(t.title)
        ? ["Rick And Morty S04E05 Rattlestar Ricklactica 720p BluRay H264 5.1 BONE.mp4"]
        : [],
  });
  assert.equal(repaired.find((t) => t.jellyfinId === "103ae87fbbbd9bb920ee3803dcffc570").title, "Rick And Morty");
  const out = dedupeLibraryTitles(repaired);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Rick and Morty");
  assert.ok(out[0].ids.includes("jf-103ae87fbbbd9bb920ee3803dcffc570"));
  assert.ok(out[0].ids.includes("73ceff573dc30bebc3fcf26f61de07b25f927a74"));
  assert.deepEqual(out[0].onDiskSeasons, [4]);
});

test("stale cache hash rows repair from dump filenames then collapse", () => {
  assert.deepEqual(
    seasonsFromDumpNames(["Rick And Morty S04E01 Edge Of Tomorty.mkv", "Rick And Morty S04E10.mkv"]),
    [4],
  );
  assert.deepEqual(hashDumpIds("73ceff573dc30bebc3fcf26f61de07b25f927a74", "/symlinks/sonarr/73ceff573dc30bebc3fcf26f61de07b25f927a74"), [
    "73ceff573dc30bebc3fcf26f61de07b25f927a74",
  ]);
  assert.equal(jellyfinHasPrimaryImage({ ImageTags: {} }), false);
  assert.equal(jellyfinHasPrimaryImage({ ImageTags: { Primary: "abc" } }), true);
  assert.equal(jellyfinHasPrimaryImage({}), false);
  const bare = titleFrom({
    Id: "jf-hash",
    Name: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    Type: "Series",
    ImageTags: {},
    ProviderIds: {},
  });
  assert.equal(bare.poster, "");
});

test("Jellyfin Items URL asks for Path so hash dumps can be named from files", () => {
  assert.match(libraryItemsUrl(), /Fields=Path%2CProviderIds%2CImageTags|Fields=Path,ProviderIds,ImageTags/);
  assert.doesNotMatch(libraryItemsUrl(), /Overview/);
});

test("Home hides the hash leftover when named Rick is on the shelf", () => {
  const named = {
    id: "tvdb-275274",
    kind: "tv",
    title: "Rick and Morty",
    year: 2013,
    poster: "/api/jf/Items/named/Images/Primary",
    ids: ["tvdb-275274", "tmdb-tv-60625", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "3d32e281cfcb09816952099c4ff468f6",
  };
  const hash = {
    id: "jf-103ae87fbbbd9bb920ee3803dcffc570",
    kind: "tv",
    title: "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    year: 0,
    poster: "",
    ids: ["73ceff573dc30bebc3fcf26f61de07b25f927a74", "jf-103ae87fbbbd9bb920ee3803dcffc570"],
    jellyfinId: "103ae87fbbbd9bb920ee3803dcffc570",
    fromHashDump: true,
  };
  const shown = homeShelfRows([hash, named]);
  assert.deepEqual(shown.map((t) => t.id), ["tvdb-275274"]);
  assert.equal(libraryRowHidden(named, [
    "73ceff573dc30bebc3fcf26f61de07b25f927a74",
    "jf-103ae87fbbbd9bb920ee3803dcffc570",
    "tvdb-275274",
    "tmdb-60625",
    "tmdb-tv-60625",
  ]), false);
  assert.deepEqual(
    healRemovedIds(
      [
        "73ceff573dc30bebc3fcf26f61de07b25f927a74",
        "jf-103ae87fbbbd9bb920ee3803dcffc570",
        "tvdb-275274",
        "tmdb-60625",
        "tmdb-tv-60625",
      ],
      [named],
    ).some((id) => /^(tmdb-|tvdb-)/.test(id)),
    false,
  );
  assert.deepEqual(seasonsFromDumpNames(["Season 04", "Rick And Morty S04E01.mkv"]), [4]);
});
