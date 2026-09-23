import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { IntelligenceCoordinator } from "./intelligence-coordinator.mjs";
import { validateEvent } from "./intelligence-contracts.mjs";
import {
  SHIPPING_COORDINATOR_CAPABILITIES,
  registerShippingIntelligenceSpecialists,
} from "./shipping-intelligence-specialists.mjs";

function fixture() {
  const features = new Map();
  const fallbacks = new Map();
  const store = {
    async appendEvent(input) {
      const event = input.schemaVersion ? input : validateEvent(input);
      return { event, sequence: 1 };
    },
    async putFeature(input, bytes) {
      const featureId = randomUUID();
      features.set(featureId, { featureId, ...input, value: JSON.parse(bytes.toString("utf8")) });
      return { featureId };
    },
    async createFeatureSnapshot({ featureIds, profileId = null }) {
      const selected = featureIds.map((id) => features.get(id));
      for (const item of selected) {
        if (item.scope === "profile" && item.profileId !== profileId) {
          throw Object.assign(new Error("profile boundary"), { code: "profile_feature_boundary" });
        }
      }
      return { snapshotId: randomUUID(), featureIds, features: selected };
    },
  };
  const runtime = {
    registerCapability(capabilityId, { fallback }) { fallbacks.set(capabilityId, fallback); },
    status() { return { capability: { state: "installed" } }; },
    async infer() { throw new Error("fallback lifecycle must not invoke a model"); },
    async inferFallback(request, reason) {
      return {
        requestId: request.requestId, capabilityId: request.capabilityId,
        modelSetId: "deterministic-fallback", outputSchemaVersion: 1,
        result: await fallbacks.get(request.capabilityId)(request, { reason }),
        confidence: 1, uncertainty: 0, evidenceRefs: [],
        featureSnapshotId: request.featureSnapshotId, elapsedMs: 0,
        fallbackUsed: true, reason,
      };
    },
  };
  const governor = { snapshot: () => ({ foreground: { playbackActive: true } }) };
  const coordinator = new IntelligenceCoordinator({ store, runtime });
  registerShippingIntelligenceSpecialists(coordinator, { runtime, governor });
  return { coordinator, runtime, features };
}

const CASES = [
  ["semantic-search", { eventId: "search-route", type: "search.impression", source: "search", profileId: "adult-a",
    payload: { query: "quiet films api_key=do-not-store", contentType: "movie" } }],
  ["interface-protection", { eventId: "interface-route", type: "policy.changed", source: "experience", profileId: "adult-a",
    deviceId: "living-room", payload: { motion: "expressive", reducedMotion: true, atmosphere: true } }],
  ["predictive-preparation", { eventId: "preparation-route", type: "preparation.queued", source: "preparation",
    workId: "title-a", payload: { authorizedSource: true, directPlayable: false, remuxCompatible: true, deviceClass: "tv" } }],
  ["storage-optimization", { eventId: "storage-route", type: "storage.reserved", source: "storage",
    payload: { personalOriginal: true, pinned: false, managedBytes: 1024, freeBytes: 4096 } }],
  ["machine-protection", { eventId: "machine-route", type: "machine.pressure", source: "governor",
    deviceId: "reelos-host", payload: { pressure: "high", playbackActive: true, availableMemoryBytes: 1024 } }],
  ["release-ranking", { eventId: "recovery-route", type: "source.failed", source: "runtime", workId: "title-a",
    payload: { code: "network_timeout", component: "provider", attempt: 1 } }],
  ["scene-understanding", { eventId: "scene-route", type: "analysis.completed", source: "media-analysis",
    workId: "title-a", editionId: "edition-a", assetId: "asset-a", timelineId: "timeline-a",
    payload: { sampleCount: 12, timedTextAvailable: true } }],
  ["family-scene-guidance", { eventId: "family-route", type: "analysis.completed", source: "family-analysis",
    workId: "title-a", editionId: "edition-a", timelineId: "timeline-a",
    payload: { evidenceCount: 4, parentBoundaryId: "boundary-a" } }],
  ["dialogue-enhancement", { eventId: "dialogue-route", type: "analysis.completed", source: "audio-analysis",
    workId: "title-a", editionId: "edition-a", assetId: "asset-a",
    payload: { trackId: "english-main", channelCount: 6, sampleRate: 48000 } }],
  ["shared-taste-intelligence", { eventId: "shared-taste-route", type: "taste.export-candidate", source: "privacy-evaluator",
    payload: { cohortSize: 32, dimensions: 16, linkabilityScore: 0.08 } }],
  ["distributed-workload-scheduler", { eventId: "scheduler-route", type: "cluster.telemetry", source: "resource-safety",
    payload: { nodeId: "node-debian", cpuLoadPercent: 45, freeRamMb: 6144, isGamingActive: false, hasHardwareEncoder: false } }],
  ["in-flight-media-distillation", { eventId: "distillation-route", type: "analysis.completed", source: "media-analysis",
    workId: "title-a", editionId: "edition-a", payload: { keyframeIndex: 10, audioEnergyDb: -14.2, vocalDominancePercent: 82 } }],
  ["ambient-presence-governor", { eventId: "ambient-route", type: "playback.presence", source: "experience",
    profileId: "adult-a", deviceId: "living-room-tv", payload: { sessionId: "sess-1", idleDurationSeconds: 3000, isBackgroundMode: true } }],
  ["predictive-cache-oracle", { eventId: "cache-oracle-route", type: "preparation.queued", source: "media-preparation",
    workId: "series-a", payload: { seriesId: "series-a", predictedNextEpisodeId: "ep-2", confidence: 0.92 } }],
];

test("shipping fallback capabilities are registered with the shared coordinator", async () => {
  const { coordinator } = fixture();
  assert.deepEqual([...coordinator.specialists.keys()].sort(), [...SHIPPING_COORDINATOR_CAPABILITIES].sort());
  for (const [capabilityId, event] of CASES) {
    const trace = await coordinator.process(event, { capabilityId, stage: "fallback" });
    assert.equal(trace.inference.fallbackUsed, true, capabilityId);
    assert.equal(trace.status, "denied", capabilityId);
    assert.equal(trace.reason, "deterministic_guard_required", capabilityId);
  }
});

test("fallbacks preserve accessibility, originals, playback priority and non-destructive recovery", async () => {
  const { coordinator } = fixture();
  const results = new Map();
  for (const [capabilityId, event] of CASES) {
    results.set(capabilityId, (await coordinator.process({ ...event, eventId: `${event.eventId}-safety` }, {
      capabilityId, stage: "fallback",
    })).inference.result);
  }
  assert.equal(results.get("interface-protection").motion, "still");
  assert.equal(results.get("predictive-preparation").action, "remux");
  assert.equal(results.get("storage-optimization").recommendation, "retain");
  assert.equal(results.get("storage-optimization").protectedOriginal, true);
  assert.equal(results.get("machine-protection").recommendation, "yield_optional_work");
  assert.equal(results.get("machine-protection").playbackHasPriority, true);
  assert.equal(results.get("release-ranking").destructiveActionAllowed, false);
  assert.equal(results.get("release-ranking").updateAuthorizationGranted, false);
  assert.equal(results.get("scene-understanding").visualClaimsAllowed, false);
  assert.equal(results.get("family-scene-guidance").mayLowerParentRestriction, false);
  assert.equal(results.get("family-scene-guidance").treatmentAuthorized, false);
  assert.equal(results.get("dialogue-enhancement").rewriteAuthorized, false);
  assert.equal(results.get("shared-taste-intelligence").exportAllowed, false);
  assert.equal(results.get("shared-taste-intelligence").payload, null);
});

test("specialists redact secret-like search text and reject secret-shaped payload fields", async () => {
  const { coordinator } = fixture();
  const trace = await coordinator.process({
    eventId: "redacted-search", type: "search.impression", source: "search", profileId: "adult-a",
    payload: { query: "find noir https://example.test/?access_token=private-value and Bearer private-token" },
  }, { capabilityId: "semantic-search", stage: "fallback" });
  const encoded = JSON.stringify({ features: trace.snapshot.features, result: trace.inference.result });
  const persistedInput = JSON.stringify(trace.event);
  assert.equal(encoded.includes("private-value"), false);
  assert.equal(encoded.includes("private-token"), false);
  assert.equal(persistedInput.includes("private-value"), false);
  assert.equal(persistedInput.includes("private-token"), false);
  assert.equal(encoded.includes("[redacted]"), true);

  await assert.rejects(() => coordinator.process({
    eventId: "secret-search", type: "search.impression", source: "search", profileId: "adult-a",
    payload: { query: "noir", apiKey: "must-never-enter-the-spine" },
  }, { capabilityId: "semantic-search", stage: "fallback" }), /credentials or private locations/);
});

test("profile-scoped search and presentation features cannot cross residents", async () => {
  const { coordinator } = fixture();
  const search = await coordinator.process({
    eventId: "profile-search", type: "search.impression", source: "search", profileId: "adult-a",
    payload: { query: "quiet dramas" },
  }, { capabilityId: "semantic-search", stage: "fallback" });
  assert.equal(search.snapshot.features[0].scope, "profile");
  assert.equal(search.snapshot.features[0].profileId, "adult-a");
  await assert.rejects(
    () => coordinator.store.createFeatureSnapshot({ featureIds: search.snapshot.featureIds, profileId: "adult-b" }),
    { code: "profile_feature_boundary" },
  );
});
