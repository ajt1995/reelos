import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collapseDumpTwins,
  dedupeLibraryTitles,
  homeShelfRows,
  isDumpTwinCard,
  libraryRowHidden,
  mapJellyfinItems,
} from "./reelos-library.mjs";
import { assembleSeasonEpisodes } from "./reelos-episodes.mjs";
import {
  decorateTitlesWithDiskSeasons,
  discoverTitleIsOwned,
  IMPORTING_SEASON_COPY,
  seasonChipLabel,
  titleRequestSeasonPayload,
} from "./reelos-seerr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Live HP 2026-09-12 read-only snapshot of The Rookie. */
function houseRookieLibrary() {
  const named = mapJellyfinItems(
    [
      {
        Id: "01c2efb0f4c9b916b1ccaffe1d81e598",
        Name: "The Rookie",
        Type: "Series",
        ProductionYear: 2018,
        Path: "/symlinks/sonarr/The Rookie S02E01 Impact 720p AMZN WEB-DL DDP5 1 H 264-NTb [ UIndex.org ]",
        ProviderIds: { Tvdb: "350665", Tmdb: "79744" },
        ImageTags: { Primary: "abc" },
      },
      {
        Id: "2386265ad4db671e09e3168ff0ac46eb",
        Name: "www UIndex org    -    The Rookie",
        Type: "Series",
        ProductionYear: 0,
        Path: "/symlinks/sonarr/www.UIndex.org    -    The.Rookie.S02E14.Casualties.1080p.HEVC.x265-MeGusta",
        ProviderIds: {},
        ImageTags: {},
      },
    ],
    "10.0.0.5",
    { listFiles: () => [] },
  );
  return decorateTitlesWithDiskSeasons(dedupeLibraryTitles(named), {
    series: [
      {
        title: "The Rookie",
        tmdbId: 79744,
        tvdbId: 350665,
        statistics: { episodeFileCount: 20 },
        seasons: [
          { seasonNumber: 1, statistics: { episodeFileCount: 20, episodeCount: 20 } },
          { seasonNumber: 2, statistics: { episodeFileCount: 0, episodeCount: 20 } },
          { seasonNumber: 3, statistics: { episodeFileCount: 0, episodeCount: 20 } },
          { seasonNumber: 8, statistics: { episodeFileCount: 0, episodeCount: 20 } },
          {
            seasonNumber: 9,
            statistics: { episodeFileCount: 0, episodeCount: 1, totalEpisodeCount: 1 },
          },
        ],
      },
    ],
    arrIndex: {
      seasonHasFile: new Set(["tmdb:79744:1", "tvdb:350665:1"]),
    },
    dumps: {
      sonarr: [
        "The Rookie S02E01 Impact 720p AMZN WEB-DL DDP5 1 H 264-NTb [ UIndex.org ]",
        "www.UIndex.org    -    The.Rookie.S02E14.Casualties.1080p.HEVC.x265-MeGusta",
        "The Rookie S03",
        "The Rookie S08",
      ],
    },
    requests: [
      { titleId: "tmdb-tv-79744", season: 3, reason: "Files linked — waiting for Sonarr import" },
      { titleId: "tmdb-tv-79744", season: 4, reason: "Files linked — waiting for Sonarr import" },
      { titleId: "tmdb-tv-79744", season: 5, reason: "Searching — no file yet" },
      { titleId: "tmdb-tv-79744", season: 6, reason: "Files linked — waiting for Sonarr import" },
      { titleId: "tmdb-tv-79744", season: 7, reason: "Files linked — waiting for Sonarr import" },
      { titleId: "tmdb-tv-79744", season: 8, reason: "Files linked — waiting for Sonarr import" },
    ],
  });
}

test("house Rookie fixture: named 2018 card, no UIndex twin, S01 Watch S02 Importing S09 Coming", () => {
  const titles = houseRookieLibrary();
  const shown = homeShelfRows(titles);
  assert.deepEqual(shown.map((t) => t.title), ["The Rookie"]);
  assert.equal(shown[0].year, 2018);
  assert.ok(shown[0].poster);
  assert.equal(isDumpTwinCard(shown[0]), false);
  assert.ok(collapseDumpTwins(titles).every((t) => !/UIndex/i.test(t.title)));
  const rookie = shown[0];
  assert.ok(rookie.onDiskSeasons.includes(1));
  assert.ok(!rookie.onDiskSeasons.includes(2), "dump S02 must not be Watch");
  assert.ok(rookie.importingSeasons.includes(2));
  assert.ok(rookie.importingSeasons.includes(3));
  assert.ok(rookie.importingSeasons.includes(8));
  assert.ok(!rookie.importingSeasons.includes(5), "S05 searching is Request, not Importing");
  assert.equal(seasonChipLabel({ onDisk: true }), "Watch");
  assert.equal(seasonChipLabel({ importing: true }), "Importing");
  assert.equal(seasonChipLabel({ unreleased: true }), "Coming");
  assert.equal(seasonChipLabel({ importing: true, unreleased: true }), "Coming");
  const parsed = { mediaType: "tv", tmdb: "79744", tvdb: "350665", titleId: "tmdb-tv-79744" };
  const payload = titleRequestSeasonPayload({
    id: "tmdb-tv-79744",
    parsed,
    facts: {
      arrIndex: { seasonHasFile: new Set(["tmdb:79744:1", "tvdb:350665:1"]) },
      series: [
        {
          title: "The Rookie",
          tmdbId: 79744,
          tvdbId: 350665,
          seasons: [{ seasonNumber: 9, statistics: { episodeCount: 1, totalEpisodeCount: 1 } }],
        },
      ],
      dumps: { sonarr: ["The Rookie S03", "The Rookie S08"] },
    },
    libraryTitles: titles,
    title: { seasonList: [1, 2, 3, 4, 5, 6, 7, 8, 9], unreleasedSeasons: [9], importingSeasons: [2] },
  });
  assert.ok(payload.onDiskSeasons.includes(1));
  assert.ok(!payload.onDiskSeasons.includes(2));
  assert.ok(payload.importingSeasons.includes(2));
  assert.ok(payload.importingSeasons.includes(3));
  assert.ok(payload.importingSeasons.includes(8));
  assert.ok(!payload.importingSeasons.includes(5));
  assert.ok(payload.unreleasedSeasons.includes(9));
  const s2 = titleRequestSeasonPayload({
    id: "tmdb-tv-79744",
    season: 2,
    parsed,
    facts: { arrIndex: { seasonHasFile: new Set(["tmdb:79744:1"]) } },
    libraryTitles: titles,
    title: { importingSeasons: [2], unreleasedSeasons: [9], seasonList: [1, 2, 9] },
  });
  assert.notEqual(s2.status, "downloaded");
  assert.equal(s2.reason, IMPORTING_SEASON_COPY);
  const eps = assembleSeasonEpisodes({
    seasonNumber: 2,
    sonarrEpisodes: [{ episodeNumber: 1, title: "Impact", hasFile: false }],
    seasonRequested: true,
    seasonImporting: true,
  });
  assert.equal(eps[0].status, "importing");
  assert.equal(eps[0].label, IMPORTING_SEASON_COPY);
  assert.equal(
    discoverTitleIsOwned({ id: "tmdb-tv-79744", title: "The Rookie", year: 2018, kind: "tv" }, titles),
    true,
  );
  assert.equal(libraryRowHidden(rookie, ["jf-2386265ad4db671e09e3168ff0ac46eb"]), false);
  const home = readFileSync(join(root, "src/components/home-view.tsx"), "utf8");
  const titlePage = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  const accordion = readFileSync(join(root, "src/components/season-episode-accordion.tsx"), "utf8");
  assert.match(home, /homeInFlightRequests/);
  assert.match(home, /homeShelfRows/);
  assert.match(titlePage, /IMPORTING_SEASON_COPY/);
  assert.match(titlePage, /importingSeasonNumbersForTitle/);
  assert.match(accordion, /IMPORTING_SEASON_COPY/);
  assert.match(accordion, /thisImporting/);
  assert.match(accordion, /setEpisodes\(\[\]\)/);
  assert.match(accordion, /thisUnreleased \? null/);
});

test("Rookie journey stamp stays wizard 7 / beta off / skip 49", () => {
  const status = readFileSync(join(root, "STATUS.md"), "utf8");
  const store = readFileSync(join(root, "src/lib/store.ts"), "utf8");
  const wizard = readFileSync(join(root, "src/components/wizard.tsx"), "utf8");
  assert.match(status, /1\.2\.50\.56/);
  assert.match(store, /betaChannel: false/);
  assert.match(wizard, /const TOTAL = 7/);
  assert.doesNotMatch(status, /\b#136\b/);
});
