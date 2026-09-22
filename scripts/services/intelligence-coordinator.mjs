import { randomUUID } from "node:crypto";
import { assertCanonicalId, canonicalJson, sha256, validateEvent } from "./intelligence-contracts.mjs";

export const INTELLIGENCE_LIFECYCLE_STAGES = Object.freeze([
  "offline", "shadow", "assisted", "autonomous", "fallback",
]);

const STAGES = new Set(INTELLIGENCE_LIFECYCLE_STAGES);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const STAGE_AUTHORITY = Object.freeze({
  installed: "shadow", validating: "shadow", learning_locally: "shadow",
  ready: "assisted", active: "autonomous",
  paused: "fallback", needs_attention: "fallback", quarantined: "fallback", rolled_back: "fallback",
  unsupported: "offline", disabled: "offline",
});

function assertStageAuthority(runtime, capabilityId, requested) {
  if (["offline", "fallback"].includes(requested)) return;
  const capabilityState = runtime.status(capabilityId)?.capability?.state || "unsupported";
  const maximum = STAGE_AUTHORITY[capabilityState] || "offline";
  const rank = { offline: 0, shadow: 1, assisted: 2, autonomous: 3 };
  if (!(maximum in rank) || rank[requested] > rank[maximum]) {
    fail("capability_stage_not_authorized", `Capability state ${capabilityState} cannot enter ${requested}.`);
  }
}

function tracePayload({ capabilityId, stage, inference, resourceClass = null,
  status, reason = null, authorizationId = null, value = null }) {
  return {
    capabilityId, stage, status, reason,
    modelSetId: inference?.modelSetId || null,
    fallbackUsed: inference?.fallbackUsed ?? null,
    confidence: inference?.confidence ?? null,
    resourceCost: { workloadClass: resourceClass, elapsedMs: inference?.elapsedMs ?? null },
    authorizationId,
    ...(value === null ? {} : { valueHash: sha256(canonicalJson(value)) }),
  };
}

function eventContext(event, correlationId, causationId = event.eventId) {
  return {
    profileId: event.profileId, deviceId: event.deviceId, sessionId: event.sessionId,
    workId: event.workId, editionId: event.editionId, assetId: event.assetId,
    renditionId: event.renditionId, timelineId: event.timelineId, sourceId: event.sourceId,
    correlationId, causationId,
    privacyClass: event.profileId ? "local-sensitive" : "local-private",
  };
}

/**
 * Connects the existing event store, feature store and inference runtime. It
 * never grants authority itself: autonomous and fallback actions require an
 * injected deterministic guard to return an explicit authorization ID.
 */
export class IntelligenceCoordinator {
  constructor({ store, runtime, clock = () => Date.now() } = {}) {
    if (!store?.appendEvent || !store?.putFeature || !store?.createFeatureSnapshot) {
      fail("coordinator_configuration_invalid", "The local intelligence store is required.");
    }
    if (!runtime?.infer || !runtime?.inferFallback) {
      fail("coordinator_configuration_invalid", "The shared intelligence runtime is required.");
    }
    this.store = store;
    this.runtime = runtime;
    this.clock = clock;
    this.specialists = new Map();
  }

  registerSpecialist(capabilityId, { perceive, buildRequest, normalizeEvent = null } = {}) {
    assertCanonicalId(capabilityId, "capabilityId");
    if (typeof perceive !== "function" || typeof buildRequest !== "function"
      || (normalizeEvent !== null && typeof normalizeEvent !== "function")) {
      fail("invalid_specialist", "Specialists require perception and request adapters.");
    }
    this.specialists.set(capabilityId, Object.freeze({ perceive, buildRequest, normalizeEvent }));
  }

  async process(rawEvent, { capabilityId, stage, guard = null, execute = null } = {}) {
    assertCanonicalId(capabilityId, "capabilityId");
    if (!STAGES.has(stage)) fail("invalid_lifecycle_stage", "The intelligence lifecycle stage is invalid.");
    assertStageAuthority(this.runtime, capabilityId, stage);
    const specialist = this.specialists.get(capabilityId);
    if (!specialist) fail("specialist_not_registered", "The specialist is not registered with the coordinator.");

    const checkedInput = validateEvent(rawEvent);
    const normalizedInput = specialist.normalizeEvent
      ? await specialist.normalizeEvent(checkedInput)
      : checkedInput;
    const validatedInput = normalizedInput === checkedInput ? checkedInput : validateEvent(normalizedInput);
    const ingested = await this.store.appendEvent(validatedInput);
    const event = ingested.event;
    const correlationId = event.correlationId || randomUUID();
    const perceived = await specialist.perceive(event);
    if (!Array.isArray(perceived) || perceived.length === 0) {
      fail("perception_empty", "The specialist did not produce reusable features.");
    }

    const featureIds = [];
    for (const feature of perceived) {
      if (!feature || typeof feature !== "object" || Array.isArray(feature) || !("value" in feature)) {
        fail("invalid_perception", "Perception output must contain a structured value.");
      }
      const scope = feature.scope || (event.profileId ? "profile" : "media");
      const profileId = scope === "profile" ? event.profileId : null;
      if (scope === "profile" && !profileId) fail("profile_scope_required", "Profile perception requires an event profile.");
      if (feature.profileId && feature.profileId !== profileId) fail("profile_feature_boundary", "Perception cannot write another profile's features.");
      const stored = await this.store.putFeature({
        scope, entityId: feature.entityId || profileId || event.assetId || event.workId,
        featureSet: feature.featureSet, featureSchemaVersion: feature.featureSchemaVersion || 1,
        extractorVersion: feature.extractorVersion, sourceWatermark: ingested.sequence,
        profileId, workId: feature.workId || event.workId, editionId: feature.editionId || event.editionId,
        assetId: feature.assetId || event.assetId, timelineId: feature.timelineId || event.timelineId,
        sourceId: feature.sourceId || event.sourceId, confidence: feature.confidence,
        lineage: { eventId: event.eventId, ...(feature.lineage || {}) },
      }, Buffer.from(canonicalJson(feature.value)));
      featureIds.push(stored.featureId);
    }

    const snapshot = await this.store.createFeatureSnapshot({ featureIds, profileId: event.profileId });
    const built = await specialist.buildRequest({ event, snapshot, stage });
    const request = {
      ...built, requestId: built.requestId || randomUUID(), capabilityId,
      profileScope: event.profileId || built.profileScope,
      featureSnapshotId: snapshot.snapshotId,
    };
    const forcedFallback = stage === "offline" || stage === "fallback";
    const inference = forcedFallback
      ? await this.runtime.inferFallback(request, `lifecycle_${stage}`)
      : await this.runtime.infer(request);

    const proposed = await this.store.appendEvent({
      type: "decision.proposed", source: "intelligence-coordinator", occurredAt: this.clock(),
      ...eventContext(event, correlationId),
      payload: tracePayload({ capabilityId, stage, inference, resourceClass: request.resourceClass,
        status: "proposed", value: inference.result }),
    });

    let authorization = null;
    let status;
    let reason;
    let execution = null;
    if (stage === "offline") {
      status = "offline_only"; reason = "lifecycle_offline";
    } else if (stage === "shadow") {
      status = "observed_only"; reason = "lifecycle_shadow";
    } else if (stage === "assisted") {
      status = "awaiting_approval"; reason = "lifecycle_assisted";
    } else if (typeof guard?.authorize !== "function") {
      status = "denied"; reason = "deterministic_guard_required";
    } else {
      try {
        authorization = await guard.authorize({ event, snapshot, inference, stage });
      } catch (error) {
        authorization = { allowed: false, reason: error?.code || "guard_failed" };
      }
      if (authorization?.allowed !== true || !authorization.authorizationId) {
        status = "denied"; reason = authorization?.reason || "guard_denied";
      } else {
        assertCanonicalId(authorization.authorizationId, "authorizationId");
        if (typeof execute !== "function") {
          status = "authorized"; reason = "executor_not_requested";
        } else {
          try {
            execution = await execute({ event, snapshot, inference, authorization });
            status = "executed"; reason = null;
          } catch (error) {
            status = "failed"; reason = error?.code || "execution_failed";
          }
        }
      }
    }

    const coordinated = await this.store.appendEvent({
      type: "decision.coordinated", source: "intelligence-coordinator", occurredAt: this.clock(),
      ...eventContext(event, correlationId, proposed.event.eventId),
      payload: tracePayload({ capabilityId, stage, inference, resourceClass: request.resourceClass, status, reason,
        authorizationId: authorization?.authorizationId || null }),
    });
    const outcome = await this.store.appendEvent({
      type: "decision.outcome", source: "intelligence-coordinator", occurredAt: this.clock(),
      ...eventContext(event, correlationId, coordinated.event.eventId),
      payload: tracePayload({ capabilityId, stage, inference, resourceClass: request.resourceClass, status, reason,
        authorizationId: authorization?.authorizationId || null, value: execution }),
    });
    return Object.freeze({ correlationId, event, snapshot, inference, resourceClass: request.resourceClass, status, reason,
      authorization, execution, outcomeEventId: outcome.event.eventId });
  }

  async recordCorrection(trace, { reason, correction } = {}) {
    if (!trace?.event || !trace?.correlationId || !trace?.inference) fail("invalid_trace", "A coordinator trace is required.");
    if (typeof reason !== "string" || !reason.trim() || reason.length > 512) fail("invalid_correction", "A correction reason is required.");
    const result = await this.store.appendEvent({
      type: "decision.corrected", source: "intelligence-coordinator", occurredAt: this.clock(),
      ...eventContext(trace.event, trace.correlationId, trace.outcomeEventId),
      payload: tracePayload({ capabilityId: trace.inference.capabilityId, stage: "fallback",
        inference: trace.inference, resourceClass: trace.resourceClass, status: "corrected",
        reason: reason.trim(), value: correction }),
    });
    return { recorded: true, eventId: result.event.eventId };
  }
}
