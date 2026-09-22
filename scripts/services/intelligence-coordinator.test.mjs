import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createReelIntelligenceSystem } from "./reel-intelligence-system.mjs";
import { INTELLIGENCE_LIFECYCLE_STAGES } from "./intelligence-coordinator.mjs";

const dirs = [];
test.after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

async function fixture() {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-coordinator-test-"));
  dirs.push(stateDir);
  const system = await createReelIntelligenceSystem({ stateDir, storageRoot: stateDir, db: new PGlite() });
  system.coordinator.registerSpecialist("taste-ranking", {
    perceive: async (event) => [{
      scope: "profile", entityId: event.profileId, featureSet: "title-response-v1",
      extractorVersion: "title-response-extractor-v1", confidence: 1,
      value: { completion: event.payload.completion, titleSignal: "completed" },
    }],
    buildRequest: async ({ event, snapshot }) => ({
      deadlineMs: 500, qualityFloor: "deterministic", resourceClass: "interactive",
      privacyClass: "profile_private", shadowAllowed: true,
      input: { workId: event.workId, features: snapshot.features.map((feature) => feature.value) },
    }),
  });
  return system;
}

function promote(system, target) {
  const ledger = system.capabilityLedger;
  if (ledger.get("taste-ranking").state === "installed") ledger.transition("taste-ranking", "validating");
  if (["ready", "active"].includes(target) && ledger.get("taste-ranking").state === "validating") {
    ledger.transition("taste-ranking", "ready", { authority: "evaluator", evidenceSummary: "test evidence" });
  }
  if (target === "active" && ledger.get("taste-ranking").state === "ready") {
    ledger.transition("taste-ranking", "active", { authority: "evaluator" });
  }
}

test("one title flows from perception through guarded coordination to outcome and correction", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  promote(system, "active");
  let executed = 0;
  const trace = await system.coordinator.process({
    eventId: "playback-title-a", type: "playback.completed", source: "player",
    profileId: "adult-a", workId: "title-a", payload: { completion: 1 },
  }, {
    capabilityId: "taste-ranking", stage: "autonomous",
    guard: { authorize: async ({ event }) => ({ allowed: event.profileId === "adult-a", authorizationId: "policy-adult-a" }) },
    execute: async ({ inference, authorization }) => {
      executed++;
      return { applied: true, fallbackUsed: inference.fallbackUsed, authorizationId: authorization.authorizationId };
    },
  });
  assert.equal(executed, 1);
  assert.equal(trace.status, "executed");
  assert.equal(trace.inference.fallbackUsed, true);
  assert.equal(trace.snapshot.features[0].value.titleSignal, "completed");
  const correction = await system.coordinator.recordCorrection(trace, {
    reason: "resident changed the title reaction", correction: { reaction: "less_like_this" },
  });
  assert.equal(correction.recorded, true);

  const events = await system.store.readEvents({ partitionKey: "profile:adult-a" });
  assert.deepEqual(events.map((event) => event.event_type), [
    "playback.completed", "model.inference", "decision.proposed",
    "decision.coordinated", "decision.outcome", "decision.corrected",
  ]);
  assert.equal(new Set(events.map((event) => event.correlation_id).filter(Boolean)).size, 1);
  assert.equal(events.find((event) => event.event_type === "decision.outcome").payload.status, "executed");
});

test("profile features cannot be read into another resident's inference snapshot", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  const stored = await system.store.putFeature({
    scope: "profile", entityId: "adult-a", featureSet: "taste-v1", featureSchemaVersion: 1,
    extractorVersion: "taste-extractor-v1", sourceWatermark: 1, profileId: "adult-a",
  }, Buffer.from(JSON.stringify({ privateTaste: "quiet dramas" })));
  await assert.rejects(
    () => system.store.createFeatureSnapshot({ featureIds: [stored.featureId], profileId: "adult-b" }),
    { code: "profile_feature_boundary" },
  );
});

test("shadow cannot execute and autonomous decisions fail closed without a deterministic guard", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  let executions = 0;
  const event = (id) => ({ eventId: id, type: "playback.completed", source: "player",
    profileId: "adult-a", workId: "title-a", payload: { completion: 1 } });
  const shadow = await system.coordinator.process(event("shadow-event"), {
    capabilityId: "taste-ranking", stage: "shadow", execute: async () => { executions++; },
  });
  promote(system, "active");
  const denied = await system.coordinator.process(event("unguarded-event"), {
    capabilityId: "taste-ranking", stage: "autonomous", execute: async () => { executions++; },
  });
  assert.equal(shadow.status, "observed_only");
  assert.equal(denied.status, "denied");
  assert.equal(denied.reason, "deterministic_guard_required");
  assert.equal(executions, 0);
});

test("offline and assisted lifecycle stages cannot silently execute", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  assert.deepEqual(INTELLIGENCE_LIFECYCLE_STAGES, ["offline", "shadow", "assisted", "autonomous", "fallback"]);
  let executions = 0;
  const event = (id) => ({ eventId: id, type: "playback.completed", source: "player",
    profileId: "adult-a", workId: "title-a", payload: { completion: 1 } });
  const offline = await system.coordinator.process(event("offline-event"), {
    capabilityId: "taste-ranking", stage: "offline",
    guard: { authorize: async () => ({ allowed: true, authorizationId: "unused" }) },
    execute: async () => { executions++; },
  });
  promote(system, "ready");
  const assisted = await system.coordinator.process(event("assisted-event"), {
    capabilityId: "taste-ranking", stage: "assisted",
    guard: { authorize: async () => ({ allowed: true, authorizationId: "unused" }) },
    execute: async () => { executions++; },
  });
  assert.equal(offline.status, "offline_only");
  assert.equal(offline.inference.fallbackUsed, true);
  assert.equal(assisted.status, "awaiting_approval");
  assert.equal(executions, 0);
});

test("callers cannot promote an unevaluated specialist into assisted or autonomous control", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  const event = { eventId: "stage-escalation", type: "playback.completed", source: "player",
    profileId: "adult-a", workId: "title-a", payload: { completion: 1 } };
  await assert.rejects(
    () => system.coordinator.process(event, { capabilityId: "taste-ranking", stage: "autonomous" }),
    { code: "capability_stage_not_authorized" },
  );
  assert.equal((await system.store.readEvents({ partitionKey: "profile:adult-a" })).length, 0);
});

test("fallback lifecycle bypasses model execution and still requires guard authority", async (t) => {
  const system = await fixture();
  t.after(() => system.close());
  let modeled = 0;
  system.runtime.executor = async () => { modeled++; throw new Error("must not run"); };
  const trace = await system.coordinator.process({
    eventId: "fallback-event", type: "playback.completed", source: "player",
    profileId: "adult-a", workId: "title-a", payload: { completion: 1 },
  }, {
    capabilityId: "taste-ranking", stage: "fallback",
    guard: { authorize: async () => ({ allowed: true, authorizationId: "safe-baseline-policy" }) },
    execute: async ({ inference }) => ({ applied: inference.fallbackUsed }),
  });
  assert.equal(modeled, 0);
  assert.equal(trace.inference.fallbackUsed, true);
  assert.equal(trace.inference.reason, "lifecycle_fallback");
  assert.equal(trace.status, "executed");
});
