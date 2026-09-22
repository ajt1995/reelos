import { performance } from "node:perf_hooks";
import { validateInferenceRequest, validateInferenceResult } from "./inference-contracts.mjs";

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

export class ReelIntelligenceRuntime {
  constructor({ registry, ledger, governor = null, executor = null, eventSink = null,
    onAuditFailure = null, clock = () => performance.now() } = {}) {
    if (!registry || !ledger) fail("runtime_configuration_invalid", "Intelligence runtime requires registry and capability ledger.");
    this.registry = registry;
    this.ledger = ledger;
    this.executor = executor;
    this.governor = governor;
    this.eventSink = eventSink;
    this.onAuditFailure = onAuditFailure;
    this.clock = clock;
    this.capabilities = new Map();
  }

  registerCapability(capabilityId, { fallback, outputSchemaVersion = 1 } = {}) {
    if (typeof fallback !== "function") fail("fallback_required", "Every intelligence capability requires a deterministic fallback.");
    if (!Number.isSafeInteger(outputSchemaVersion) || outputSchemaVersion < 1) fail("invalid_output_schema", "Output schema version is invalid.");
    this.capabilities.set(capabilityId, { fallback, outputSchemaVersion });
  }

  async infer(rawRequest) {
    const request = validateInferenceRequest(rawRequest);
    const handler = this.capabilities.get(request.capabilityId);
    if (!handler) fail("capability_not_registered", "Intelligence capability is not registered.");
    const started = this.clock();
    const capability = this.ledger.get(request.capabilityId);
    const active = this.registry.getActive(request.capabilityId);
    let candidate;
    let fallbackReason = null;
    let lease = null;
    if (capability?.state === "active" && active && typeof this.executor === "function") {
      try {
        if (typeof this.executor.eligibility === "function") {
          const eligibility = this.executor.eligibility(request.capabilityId, active);
          if (eligibility?.eligible !== true) {
            throw Object.assign(new Error("The local specialist is not eligible."), {
              code: eligibility?.reasons?.[0] || "model_executor_ineligible",
            });
          }
        }
        if (this.governor) {
          const workloadClass = {
            playback: "safety_playback", interactive: "user_interaction", recovery: "playback_recovery",
            requested_prepare: "requested_work", predictive_prepare: "predictive_preparation",
            analysis: "media_analysis", training: "maintenance", maintenance: "maintenance",
          }[request.resourceClass];
          const artifacts = active.artifactIds.map((id) => this.registry.getArtifact(id)).filter(Boolean);
          const memoryBytes = artifacts.reduce((total, record) => total + Number(record.manifest?.resourceProfile?.ramBytes || 0), 0);
          const admitted = this.governor.admit({ workloadId: `inference:${request.requestId}`, workloadClass,
            memoryBytes, preemption: "yield", hardwareSensitive: true,
            metadata: { capabilityId: request.capabilityId } });
          if (!admitted.ok) throw Object.assign(new Error(admitted.reason), { code: admitted.code });
          lease = admitted.lease;
        }
        candidate = await this.executor({ request, modelSet: active, lease });
        candidate = { ...candidate, requestId: request.requestId, capabilityId: request.capabilityId,
          modelSetId: active.modelSetId, outputSchemaVersion: handler.outputSchemaVersion,
          featureSnapshotId: request.featureSnapshotId, fallbackUsed: false,
          elapsedMs: Math.max(0, this.clock() - started) };
        const validated = validateInferenceResult(candidate, request);
        await this.recordOutcome(request, validated);
        return validated;
      } catch (error) {
        fallbackReason = error?.code || "model_execution_failed";
      } finally {
        lease?.release();
      }
    } else {
      fallbackReason = !capability ? "capability_not_installed"
        : capability.state !== "active" ? `capability_${capability.state}`
          : !active ? "model_set_unavailable" : "executor_unavailable";
    }
    return this.runFallback(request, handler, fallbackReason, started);
  }

  async inferFallback(rawRequest, reason = "coordinator_fallback") {
    const request = validateInferenceRequest(rawRequest);
    const handler = this.capabilities.get(request.capabilityId);
    if (!handler) fail("capability_not_registered", "Intelligence capability is not registered.");
    return this.runFallback(request, handler, reason, this.clock());
  }

  async runFallback(request, handler, reason, started) {
    const result = await handler.fallback(request, { reason });
    const validated = validateInferenceResult({ requestId: request.requestId, capabilityId: request.capabilityId,
      modelSetId: "deterministic-fallback", outputSchemaVersion: handler.outputSchemaVersion,
      result, confidence: 1, uncertainty: 0, evidenceRefs: [], featureSnapshotId: request.featureSnapshotId,
      elapsedMs: Math.max(0, this.clock() - started), fallbackUsed: true, reason }, request);
    await this.recordOutcome(request, validated);
    return validated;
  }

  async recordOutcome(request, result) {
    if (typeof this.eventSink !== "function") return;
    try {
      await this.eventSink({ request, result });
    } catch (error) {
      this.onAuditFailure?.(error, { requestId: request.requestId, capabilityId: request.capabilityId });
    }
  }

  status(capabilityId) {
    return { capability: this.ledger.get(capabilityId), model: this.registry.status(capabilityId),
      registered: this.capabilities.has(capabilityId),
      execution: typeof this.executor?.status === "function" ? this.executor.status(capabilityId) : {
        eligible: false, capabilityId, specialist: null, runtimeId: null,
        reasons: ["model_executor_unavailable"],
      } };
  }
}
