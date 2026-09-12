import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  assembleSeasonEpisodes,
  classifyEpisodeStatus,
  episodeStatusLabel,
  EPISODE_STATUS_LABEL,
  EPISODE_STATUSES,
  jellyfinEpisodesFromLibrary,
  loadSeasonEpisodeList,
  seasonWasRequested,
} from "./reelos-episodes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("episode status vocab is Austin's honest labels", () => {
  assert.deepEqual(EPISODE_STATUSES, ["in-library", "importing", "downloading", "requested", "missing"]);
  assert.equal(episodeStatusLabel("in-library"), "In library");
  assert.equal(episodeStatusLabel("importing"), "On disk, importing");
  assert.equal(episodeStatusLabel("downloading"), "Downloading");
  assert.equal(episodeStatusLabel("requested"), "Requested");
  assert.equal(episodeStatusLabel("missing"), "Missing");
  assert.equal(EPISODE_STATUS_LABEL["in-library"], "In library");
});

test("classify prefers library, then queue, then requested, else missing", () => {
  assert.equal(classifyEpisodeStatus({ hasFile: true, inQueue: true, requested: true }), "in-library");
  assert.equal(classifyEpisodeStatus({ inJellyfin: true }), "in-library");
  assert.equal(classifyEpisodeStatus({ inQueue: true, requested: true }), "downloading");
  assert.equal(classifyEpisodeStatus({ requested: true }), "requested");
  assert.equal(classifyEpisodeStatus({ importing: true, requested: true, inJellyfin: true }), "importing");
  assert.equal(classifyEpisodeStatus({}), "missing");
});

test("Seerr pending/processing/partial is requested, AVAILABLE is not", () => {
  assert.equal(seasonWasRequested(1), true);
  assert.equal(seasonWasRequested(2), true);
  assert.equal(seasonWasRequested(3), true);
  assert.equal(seasonWasRequested(4), true);
  assert.equal(seasonWasRequested(5), false);
  assert.equal(seasonWasRequested(0), false);
});

test("assembleSeasonEpisodes merges Sonarr files, queue, Jellyfin, Seerr names", () => {
  const rows = assembleSeasonEpisodes({
    seasonNumber: 1,
    seerrEpisodes: [
      { episodeNumber: 1, name: "Dulcinea" },
      { episodeNumber: 2, name: "The Big Empty" },
      { episodeNumber: 3, name: "Remember the Cant" },
      { episodeNumber: 4, name: "CQB" },
    ],
    sonarrEpisodes: [
      { episodeNumber: 1, title: "Dulcinea", hasFile: true, monitored: true },
      { episodeNumber: 2, title: "The Big Empty", hasFile: false, monitored: true },
      { episodeNumber: 3, title: "Remember the Cant", hasFile: false, monitored: true },
      { episodeNumber: 4, title: "CQB", hasFile: false, monitored: true },
    ],
    queueItems: { records: [{ episode: { seasonNumber: 1, episodeNumber: 2 } }] },
    jellyfinEpisodes: [{ IndexNumber: 1 }],
    seasonRequested: true,
  });
  assert.deepEqual(
    rows.map((r) => `${r.episodeNumber}:${r.status}:${r.label}`),
    ["1:in-library:In library", "2:downloading:Downloading", "3:requested:Requested", "4:requested:Requested"],
  );
});

test("Rookie S02 dump-linked episodes are On disk, importing — not Requested Watch", () => {
  const rows = assembleSeasonEpisodes({
    seasonNumber: 2,
    seerrEpisodes: [
      { episodeNumber: 1, name: "Impact" },
      { episodeNumber: 2, name: "The Roundup" },
    ],
    sonarrEpisodes: [
      { episodeNumber: 1, title: "Impact", hasFile: false, monitored: true },
      { episodeNumber: 2, title: "The Roundup", hasFile: false, monitored: true },
    ],
    seasonRequested: true,
    seasonImporting: true,
  });
  assert.deepEqual(
    rows.map((r) => `${r.episodeNumber}:${r.status}:${r.label}`),
    ["1:importing:On disk, importing", "2:importing:On disk, importing"],
  );
});

test("Jellyfin dump filenames mark those episodes in-library", () => {
  const rows = jellyfinEpisodesFromLibrary(
    [{ ids: ["tmdb-tv-63639"], files: ["The.Expanse.S01E01.mkv", "The.Expanse.S01E04.mkv", "The.Expanse.S02E01.mkv"] }],
    63639,
    1,
  );
  assert.deepEqual(
    rows.map((r) => r.IndexNumber),
    [1, 4],
  );
});

test("missing stays missing when the season was never requested", () => {
  const rows = assembleSeasonEpisodes({
    seasonNumber: 6,
    sonarrEpisodes: [{ episodeNumber: 1, title: "Strange Dogs", hasFile: false, monitored: false }],
    seasonRequested: false,
  });
  assert.equal(rows[0]?.status, "missing");
  assert.equal(rows[0]?.label, "Missing");
});

test("loadSeasonEpisodeList uses Sonarr + Seerr and does not invent files", async () => {
  const payload = await loadSeasonEpisodeList({
    titleId: "tmdb-tv-63639",
    season: 1,
    seerrKey: "k",
    sonarrKey: "s",
    factsLoader: async () => ({
      libraryTitles: [],
      series: [{ id: 4, tmdbId: 63639, title: "The Expanse" }],
      movies: [],
    }),
    fetchArr: async (url) => {
      if (String(url).includes("/episode?")) {
        return [
          { episodeNumber: 1, title: "Dulcinea", hasFile: true },
          { episodeNumber: 2, title: "The Big Empty", hasFile: false },
        ];
      }
      if (String(url).includes("/queue")) return { records: [] };
      return [];
    },
    fetchSeerr: async (path) => {
      if (String(path).endsWith("/tv/63639")) {
        return { json: { mediaInfo: { seasons: [{ seasonNumber: 1, status: 3 }] } } };
      }
      if (String(path).includes("/season/1")) {
        return {
          json: {
            episodes: [
              { episodeNumber: 1, name: "Dulcinea" },
              { episodeNumber: 2, name: "The Big Empty" },
            ],
          },
        };
      }
      return { json: {} };
    },
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.source, "sonarr");
  assert.equal(payload.episodes[0]?.status, "in-library");
  assert.equal(payload.episodes[1]?.status, "requested");
  assert.equal(payload.vocab["missing"], "Missing");
});

test("loadSeasonEpisodeList hides TBA announced seasons as Coming, not Request rows", async () => {
  const payload = await loadSeasonEpisodeList({
    titleId: "tmdb-tv-125988",
    season: 4,
    seerrKey: "k",
    sonarrKey: "s",
    factsLoader: async () => ({
      libraryTitles: [],
      series: [
        {
          id: 10,
          tmdbId: 125988,
          title: "Silo",
          seasons: [{ seasonNumber: 4, statistics: { episodeFileCount: 0, episodeCount: 1, totalEpisodeCount: 1 } }],
        },
      ],
      movies: [],
    }),
    fetchArr: async (url) => {
      if (String(url).includes("/episode?")) return [{ episodeNumber: 1, title: "TBA", hasFile: false }];
      if (String(url).includes("/queue")) return { records: [] };
      return [];
    },
    fetchSeerr: async () => ({ json: { seasons: [{ seasonNumber: 4, episodeCount: 0, airDate: "2027-06-01" }] } }),
  });
  assert.equal(payload.unreleased, true);
  assert.deepEqual(payload.episodes, []);
  assert.match(String(payload.copy), /not released/i);
});

test("GET /api/episodes is its own plugin; POST can request an episode", () => {
  const plugin = readFileSync(join(root, "scripts/reelos-episodes-plugin.mjs"), "utf8");
  const lookup = readFileSync(join(root, "scripts/reelos-lookup-plugin.mjs"), "utf8");
  const vite = readFileSync(join(root, "vite.config.ts"), "utf8");
  const box = readFileSync(join(root, "scripts/reelos-box.mjs"), "utf8");
  assert.match(plugin, /pathOnly !== "\/api\/episodes"/);
  assert.match(plugin, /loadSeasonEpisodeList/);
  assert.match(vite, /reelosEpisodesPlugin/);
  assert.match(box, /dispatchEpisodes/);
  assert.match(lookup, /body\.episode/);
  assert.match(lookup, /episode,/);
});

test("title page accordion sits in the text column with Austin's status vocab", () => {
  const view = readFileSync(join(root, "src/components/title-view-live.tsx"), "utf8");
  const acc = readFileSync(join(root, "src/components/season-episode-accordion.tsx"), "utf8");
  const labels = readFileSync(join(root, "src/lib/episode-status.ts"), "utf8");
  assert.match(view, /SeasonEpisodeAccordion/);
  assert.match(view, /removedHere/);
  assert.match(view, /onRemoved=\{\(\) => setRemovedHere\(true\)\}/);
  assert.match(view, /className="title-copy"/);
  assert.match(acc, /aria-expanded/);
  assert.match(acc, /Request this season/);
  assert.match(acc, /Request again/);
  assert.match(acc, /data-episode-status/);
  assert.match(labels, /In library/);
  assert.match(labels, /Downloading/);
  assert.match(labels, /Requested/);
  assert.match(labels, /Missing/);
});
