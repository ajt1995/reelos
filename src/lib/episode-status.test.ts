import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyEpisodeStatus,
  episodeRequestAction,
  EPISODE_STATUS_LABEL,
  EPISODE_STATUSES,
  seasonChipLabel,
  seasonIsUnreleasedFact,
  seasonShowsRequestButton,
  UNRELEASED_SEASON_COPY,
} from "./episode-status.ts";

test("client episode vocab matches Austin: in library / importing / downloading / missing / requested", () => {
  assert.deepEqual([...EPISODE_STATUSES], ["in-library", "importing", "downloading", "requested", "missing"]);
  assert.equal(EPISODE_STATUS_LABEL["in-library"], "In library");
  assert.equal(EPISODE_STATUS_LABEL.importing, "On disk, importing");
  assert.equal(EPISODE_STATUS_LABEL.downloading, "Downloading");
  assert.equal(EPISODE_STATUS_LABEL.requested, "Requested");
  assert.equal(EPISODE_STATUS_LABEL.missing, "Missing");
});

test("Request is on missing; Request again is on requested after Remove", () => {
  assert.equal(episodeRequestAction("missing"), "Request");
  assert.equal(episodeRequestAction("requested"), null);
  assert.equal(episodeRequestAction("requested", true), "Request again");
  assert.equal(episodeRequestAction("in-library", true), null);
  assert.equal(episodeRequestAction("downloading"), null);
  assert.equal(classifyEpisodeStatus({ hasFile: true }), "in-library");
  assert.equal(classifyEpisodeStatus({ importing: true, requested: true }), "importing");
  assert.equal(episodeRequestAction("importing"), null);
});

test("announced season fixture is Coming, not Request or Watch", () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  const fact = { episodeCount: 0, airDate: "2027-06-01" };
  assert.equal(seasonIsUnreleasedFact(fact, now), true);
  assert.equal(seasonChipLabel({ unreleased: seasonIsUnreleasedFact(fact, now) }), "Coming");
  assert.notEqual(seasonChipLabel({ unreleased: true }), "Request");
  assert.notEqual(seasonChipLabel({ unreleased: true }), "Watch");
  assert.equal(seasonChipLabel({ onDisk: true }), "Watch");
  assert.equal(seasonChipLabel({ importing: true }), "Importing");
  assert.equal(seasonChipLabel({ importing: true, unreleased: true }), "Coming");
  assert.notEqual(seasonChipLabel({ importing: true }), "Watch");
  assert.equal(seasonChipLabel({}), "Request");
  assert.match(UNRELEASED_SEASON_COPY, /not released/i);
  assert.equal(seasonShowsRequestButton({ open: true, loading: false }), true);
  assert.equal(
    seasonShowsRequestButton({ open: true, loading: false, onDisk: false, importing: false, unreleased: false }),
    true,
  );
  assert.equal(seasonShowsRequestButton({ open: true, loading: false, unreleased: true }), false);
  assert.equal(seasonShowsRequestButton({ open: true, loading: false, importing: true }), false);
  assert.equal(seasonShowsRequestButton({ open: true, loading: false, onDisk: true }), false);
  assert.equal(seasonShowsRequestButton({ open: true, loading: true }), false);
  assert.equal(seasonShowsRequestButton({ open: false, loading: false }), false);
});
