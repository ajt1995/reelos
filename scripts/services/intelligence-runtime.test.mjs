import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { CapabilityLedger } from "./capability-ledger.mjs";
import { ModelArtifactRegistry, canonicalJson, unsignedManifest } from "./model-artifact-registry.mjs";
import { ReelIntelligenceRuntime } from "./reel-intelligence-runtime.mjs";
import { validateInferenceRequest, validateInferenceResult } from "./inference-contracts.mjs";

function fixture(t) {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-intelligence-test-"));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const artifactPath = path.join(stateDir, "taste.onnx");
  const body = Buffer.from("not-a-real-model-binary");
  fs.writeFileSync(artifactPath, body);
  const manifest = {
    schemaVersion: 1,
    artifactId: "taste-ranker-v1",
    capabilityId: "taste-ranking",
    modelFamily: "ranker",
    version: "1.0.0",
    sha256: createHash("sha256").update(body).digest("hex"),
    byteSize: body.length,
    keyId: "release-key-1",
    signature: "pending",
    license: { id: "test-only", redistributionAllowed: true,
      noticeSha256: createHash("sha256").update("test license").digest("hex") },
    runtime: "onnxruntime",
    inputSchema: "taste-ranking-input-v1",
    outputSchema: "taste-ranking-output-v1",
    fallbackId: "taste-deterministic-v1",
    platforms: [process.platform],
    resourceProfile: { ramBytes: 1024 },
  };
  manifest.signature = sign(null, Buffer.from(canonicalJson(unsignedManifest(manifest))), privateKey).toString("base64");
  const manifestPath = path.join(stateDir, "taste.manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { stateDir, publicKey, artifactPath, manifestPath };
}

function request(overrides = {}) {
  return {
    requestId: "request-1",
    capabilityId: "taste-ranking",
    profileScope: "profile-1",
    featureSnapshotId: "snapshot-1",
    deadlineMs: 500,
    qualityFloor: "deterministic",
    resourceClass: "interactive",
    privacyClass: "profile_private",
    shadowAllowed: true,
    input: { candidates: ["one", "two"] },
    ...overrides,
  };
}

test("inference contracts reject secret inputs and mismatched results", () => {
  assert.throws(() => validateInferenceRequest(request({ privacyClass: "secret_forbidden" })), { code: "privacy_boundary" });
  const valid = validateInferenceRequest(request());
  assert.throws(() => validateInferenceResult({
    requestId: "other", capabilityId: valid.capabilityId, modelSetId: "fallback", outputSchemaVersion: 1,
    result: [], confidence: 1, uncertainty: 0, evidenceRefs: [], featureSnapshotId: valid.featureSnapshotId,
    elapsedMs: 1, fallbackUsed: true,
  }, valid), { code: "inference_result_mismatch" });
});

test("artifact registry verifies hash, signature, platform, and evaluation before activation", (t) => {
  const files = fixture(t);
  const registry = new ModelArtifactRegistry({ stateDir: files.stateDir, trustedKeys: { "release-key-1": files.publicKey } });
  const record = registry.verifyAndRegister(files);
  assert.equal(record.status, "verified");
  assert.throws(() => registry.activate("taste-ranking", ["taste-ranker-v1"]), { code: "artifact_evaluation_required" });
  const active = registry.activate("taste-ranking", ["taste-ranker-v1"], { evaluated: true });
  assert.equal(registry.getActive("taste-ranking").modelSetId, active.modelSetId);
  const restarted = new ModelArtifactRegistry({ stateDir: files.stateDir, trustedKeys: { "release-key-1": files.publicKey } });
  assert.equal(restarted.getActive("taste-ranking").modelSetId, active.modelSetId);

  fs.writeFileSync(files.artifactPath, "tampered");
  const fresh = new ModelArtifactRegistry({ stateDir: files.stateDir, trustedKeys: { "release-key-1": files.publicKey } });
  assert.equal(fresh.getActive("taste-ranking"), null);
  assert.throws(() => fresh.verifyAndRegister(files), { code: "artifact_size_mismatch" });
});

test("capability ledger enforces validation authority and persists lifecycle state", (t) => {
  const { stateDir } = fixture(t);
  const ledger = new CapabilityLedger({ stateDir });
  ledger.install("taste-ranking");
  ledger.transition("taste-ranking", "validating", { reason: "Frozen evaluation is running." });
  assert.throws(() => ledger.transition("taste-ranking", "ready"), { code: "capability_gate_required" });
  ledger.transition("taste-ranking", "ready", { authority: "evaluator", evidenceSummary: "baseline passed" });
  ledger.transition("taste-ranking", "active", { authority: "evaluator", modelSetId: "set-1" });
  assert.equal(new CapabilityLedger({ stateDir }).get("taste-ranking").state, "active");
});

test("runtime uses honest fallback while models are absent or inactive", async (t) => {
  const { stateDir } = fixture(t);
  const ledger = new CapabilityLedger({ stateDir });
  ledger.install("taste-ranking");
  const registry = new ModelArtifactRegistry({ stateDir });
  const runtime = new ReelIntelligenceRuntime({ registry, ledger });
  runtime.registerCapability("taste-ranking", { fallback: ({ input }) => [...input.candidates].sort() });
  const result = await runtime.infer(request());
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.reason, "capability_installed");
  assert.deepEqual(result.result, ["one", "two"]);
  assert.equal(runtime.status("taste-ranking").model.available, false);
});

test("runtime serves a validated active model result and falls back on invalid output", async (t) => {
  const files = fixture(t);
  const registry = new ModelArtifactRegistry({ stateDir: files.stateDir, trustedKeys: { "release-key-1": files.publicKey } });
  registry.verifyAndRegister(files);
  registry.activate("taste-ranking", ["taste-ranker-v1"], { evaluated: true });
  const ledger = new CapabilityLedger({ stateDir: files.stateDir });
  ledger.install("taste-ranking");
  ledger.transition("taste-ranking", "validating");
  ledger.transition("taste-ranking", "ready", { authority: "evaluator" });
  ledger.transition("taste-ranking", "active", { authority: "evaluator" });

  const runtime = new ReelIntelligenceRuntime({ registry, ledger, executor: async () => ({
    result: ["two", "one"], confidence: 0.8, uncertainty: 0.2, evidenceRefs: ["feature-1"],
  }) });
  runtime.registerCapability("taste-ranking", { fallback: () => ["one", "two"] });
  const modeled = await runtime.infer(request());
  assert.equal(modeled.fallbackUsed, false);
  assert.deepEqual(modeled.result, ["two", "one"]);

  runtime.executor = async () => ({ result: [], confidence: 2, uncertainty: 0, evidenceRefs: [] });
  const fallback = await runtime.infer(request({ requestId: "request-2" }));
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.reason, "invalid_inference_result");
});
