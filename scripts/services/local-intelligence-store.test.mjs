import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { LocalIntelligenceStore } from "./local-intelligence-store.mjs";

async function fixture(t) {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-intelligence-test-"));
  const db = new PGlite(); await db.waitReady;
  const store = await new LocalIntelligenceStore({ db, stateDir }).initialize();
  t.after(async () => { await db.close(); fs.rmSync(stateDir, { recursive: true, force: true }); });
  return { db, store };
}

test("event and outbox commit together and duplicate IDs are idempotent", async (t) => {
  const { store } = await fixture(t);
  const input = { eventId: "evt-1", type: "taste.set", source: "test", profileId: "profile-a", payload: { reaction: "love" } };
  const first = await store.appendEvent(input);
  const second = await store.appendEvent(input);
  assert.equal(first.sequence, 1); assert.equal(first.duplicate, false);
  assert.equal(second.sequence, 1); assert.equal(second.duplicate, true);
  const replay = await store.readEvents({ partitionKey: "profile:profile-a" });
  assert.equal(replay.length, 1); assert.equal(replay[0].payload.reaction, "love");
  const pending = await store.pendingOutbox(); assert.equal(pending.length, 1); assert.equal(pending[0].event_id, "evt-1");
  assert.equal(JSON.parse(pending[0].payload_json).payload.reaction, "love");
  await assert.rejects(() => store.appendEvent({ ...input, payload: { reaction: "less" } }), /different content/);
  await store.recordOutboxAttempt("evt-1", { delivered: true });
  assert.equal((await store.pendingOutbox()).length, 0);
});

test("feature blobs are content addressed and profile deletion prevents replay resurrection", async (t) => {
  const { db, store } = await fixture(t);
  await store.appendEvent({ eventId: "evt-profile", type: "playback.completed", source: "test", profileId: "profile-a", payload: { completion: 1 } });
  const feature = await store.putFeature({ scope: "profile", entityId: "profile-a", featureSet: "taste-v1",
    featureSchemaVersion: 1, extractorVersion: "extractor-v1", sourceWatermark: 1, profileId: "profile-a", lineage: { event: "evt-profile" } }, Buffer.from("private-feature"));
  assert.ok(fs.existsSync(store.blobPath(feature.blobHash)));
  const deletion = await store.deleteProfile("profile-a");
  assert.match(deletion.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal((await store.listFeatures({ profileId: "profile-a", includeInvalidated: true })).length, 0);
  assert.equal(fs.existsSync(store.blobPath(feature.blobHash)), false);
  const rows = (await db.query(`SELECT event_id FROM intelligence_events WHERE profile_id = $1`, ["profile-a"])).rows;
  assert.equal(rows.length, 0);
  await assert.rejects(() => store.appendEvent({ type: "taste.set", source: "replay", profileId: "profile-a", payload: { reaction: "like" } }), /deleted/);
  await assert.rejects(() => store.putFeature({ scope: "profile", entityId: "profile-a", featureSet: "taste-v1",
    featureSchemaVersion: 1, extractorVersion: "extractor-v1", sourceWatermark: 2, profileId: "profile-a" }, Buffer.from("again")), /deleted/);
});

test("media deletion and source revocation invalidate dependent features and emit durable events", async (t) => {
  const { store } = await fixture(t);
  const common = { scope: "media", featureSchemaVersion: 1, extractorVersion: "extractor-v1", sourceWatermark: 1 };
  await store.putFeature({ ...common, entityId: "asset-a", featureSet: "scenes-v1", assetId: "asset-a", editionId: "edition-a", sourceId: "source-a" }, Buffer.from("scene"));
  await store.invalidateMedia({ assetId: "asset-a" });
  let features = await store.listFeatures({ assetId: "asset-a", includeInvalidated: true });
  assert.equal(features[0].invalidation_reason, "media_deleted");
  await store.putFeature({ ...common, entityId: "asset-b", featureSet: "audio-v1", assetId: "asset-b", editionId: "edition-b", sourceId: "source-a" }, Buffer.from("audio"));
  await store.revokeSource("source-a");
  features = await store.listFeatures({ assetId: "asset-b", includeInvalidated: true });
  assert.equal(features[0].invalidation_reason, "source_revoked");
  const pending = await store.pendingOutbox();
  assert.deepEqual(pending.map((row) => JSON.parse(row.payload_json).payload.reason), ["media_deleted", "source_revoked"]);
});
