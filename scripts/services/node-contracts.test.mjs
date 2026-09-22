import assert from "node:assert/strict";
import test from "node:test";
import { resolveHouseholdDelta, validateHouseholdDelta, validateNodeCapabilityManifest } from "./node-contracts.mjs";

test("node manifests expose measured capability truth without inventing compute", () => {
  const manifest = validateNodeCapabilityManifest({
    schemaVersion: 1, nodeId: "android-phone-a", householdId: "home-a", platform: "android", version: "2.5.4",
    workloads: ["playback", "analysis"], generatedAt: 1,
    resourceLimits: { memoryBytes: 1024, storageBytes: 2048, concurrency: 1, playbackPriority: true },
    capabilities: {
      playback: { stage: "active", measured: true },
      transcode: { stage: "unavailable", measured: false, reason: "hardware gate pending" },
    },
  });
  assert.equal(manifest.capabilities.transcode.stage, "unavailable");
  assert.equal(manifest.resourceLimits.playbackPriority, true);
  assert.match(manifest.manifestHash, /^[a-f0-9]{64}$/);
});

test("household deltas require profile ownership and reject secrets", () => {
  const base = { schemaVersion: 1, deltaId: "delta-a", householdId: "home-a", originNodeId: "node-a",
    scope: "taste", entityId: "taste-a", operation: "upsert", revision: 1, occurredAt: 1,
    payload: { likes: ["title-a"] } };
  assert.throws(() => validateHouseholdDelta(base), { code: "household_delta_owner_required" });
  assert.throws(() => validateHouseholdDelta({ ...base, ownerProfileId: "adult-a", payload: { accessToken: "secret" } }),
    { code: "node_contract_secret" });
  assert.equal(validateHouseholdDelta({ ...base, ownerProfileId: "adult-a" }).ownerProfileId, "adult-a");
});

test("progress merges monotonically and equal-revision conflicts fail closed", () => {
  const make = (deltaId, revision, positionTicks, scope = "progress") => ({
    schemaVersion: 1, deltaId, householdId: "home-a", originNodeId: "node-a", scope,
    entityId: "title-a", ownerProfileId: "adult-a", operation: "upsert", revision, occurredAt: 1,
    payload: { positionTicks },
  });
  assert.equal(resolveHouseholdDelta(make("delta-a", 1, 10), make("delta-b", 1, 20)).payload.positionTicks, 20);
  assert.equal(resolveHouseholdDelta(make("delta-a", 2, 10), make("delta-b", 1, 20)).revision, 2);
  assert.throws(() => resolveHouseholdDelta(make("delta-a", 1, 10, "preference"), make("delta-b", 1, 20, "preference")),
    { code: "household_delta_conflict" });
});
