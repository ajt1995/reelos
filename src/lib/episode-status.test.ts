import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyEpisodeStatus,
  episodeRequestAction,
  EPISODE_STATUS_LABEL,
  EPISODE_STATUSES,
} from "./episode-status.ts";

test("client episode vocab matches Austin: in library / downloading / missing / requested", () => {
  assert.deepEqual([...EPISODE_STATUSES], ["in-library", "downloading", "requested", "missing"]);
  assert.equal(EPISODE_STATUS_LABEL["in-library"], "In library");
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
});
