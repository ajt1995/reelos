import test from "node:test";
import assert from "node:assert/strict";
import { createAssetId, createEditionId, createTimelineIdentity, createTrackId, createWorkId, validateEvent } from "./intelligence-contracts.mjs";

test("canonical media identities are stable and exact timelines diverge", () => {
  const workId = createWorkId({ kind: "movie", namespace: "tmdb", externalId: "42" });
  const editionId = createEditionId({ workId, cut: "theatrical", runtimeTicks: 90000, provenance: "personal" });
  const assetId = createAssetId({ contentHash: `sha256:${"a".repeat(64)}`, byteLength: 1234 });
  const videoTrackId = createTrackId({ assetId, kind: "video", index: 0, codec: "h264", fingerprint: "stream-a" });
  const one = createTimelineIdentity({ editionId, assetId, videoTrackId, timebaseNumerator: 1, timebaseDenominator: 90000, durationTicks: 90000 });
  const same = createTimelineIdentity({ editionId, assetId, videoTrackId, timebaseNumerator: 1, timebaseDenominator: 90000, durationTicks: 90000 });
  const shifted = createTimelineIdentity({ editionId, assetId, videoTrackId, timebaseNumerator: 1, timebaseDenominator: 90000, ptsOrigin: 1, durationTicks: 90000 });
  assert.equal(one.id, same.id);
  assert.notEqual(one.id, shifted.id);
});

test("event validation rejects secrets and non-taste exports", () => {
  assert.throws(() => validateEvent({ type: "playback.started", source: "test", profileId: "profile-a", payload: { accessToken: "nope" } }), /credentials/);
  assert.throws(() => validateEvent({ type: "playback.started", source: "test", profileId: "profile-a", payload: { sourceUrl: "https:\/\/private" } }), /private locations/);
  assert.throws(() => validateEvent({ type: "playback.started", source: "test", profileId: "profile-a", privacyClass: "export-candidate", payload: {} }), /anonymous taste/);
  assert.throws(() => validateEvent({ type: "playback.started", source: "test", payload: {} }), /requires profileId/);
  assert.throws(() => validateEvent({ type: "taste.export-candidate", source: "test", privacyClass: "export-candidate", payload: { titleId: "private" } }), /export allowlist/);
  const event = validateEvent({ type: "taste.export-candidate", source: "test", privacyClass: "export-candidate",
    payload: { schemaVersion: 1, dimensions: [0.1, 0.2], cohortSize: 25, noise: "dp-v1" } });
  assert.equal(event.type, "taste.export-candidate");
});
