const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;

export const INFERENCE_PRIVACY_CLASSES = Object.freeze(["profile_private", "household_private", "export_candidate"]);
export const INFERENCE_WORKLOAD_CLASSES = Object.freeze(["playback", "interactive", "recovery", "requested_prepare",
  "predictive_prepare", "analysis", "training", "maintenance"]);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

function json(value, name, limit) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { fail("invalid_inference_payload", `${name} must be JSON serializable.`); }
  if (encoded === undefined || Buffer.byteLength(encoded) > limit) fail("invalid_inference_payload", `${name} exceeds its local inference limit.`);
}
function shape(value, allowed, required, name) {
  if (!object(value)) fail("invalid_inference_contract", `${name} must be an object.`);
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail("invalid_inference_contract", `${name} contains unsupported fields.`);
  if (required.some((key) => !Object.hasOwn(value, key))) fail("invalid_inference_contract", `${name} is incomplete.`);
}
function id(value, name) { if (typeof value !== "string" || !ID.test(value)) fail("invalid_inference_contract", `${name} is invalid.`); }

export function validateInferenceRequest(value) {
  const allowed = ["requestId", "capabilityId", "profileScope", "media", "featureSnapshotId", "deadlineMs",
    "qualityFloor", "resourceClass", "privacyClass", "shadowAllowed", "input"];
  shape(value, allowed, ["requestId", "capabilityId", "featureSnapshotId", "deadlineMs", "qualityFloor", "resourceClass",
    "privacyClass", "shadowAllowed", "input"], "Inference request");
  for (const key of ["requestId", "capabilityId", "featureSnapshotId", "qualityFloor"]) id(value[key], key);
  if (value.profileScope !== undefined) id(value.profileScope, "profileScope");
  if (!Number.isSafeInteger(value.deadlineMs) || value.deadlineMs < 1 || value.deadlineMs > 300000) fail("invalid_inference_contract", "deadlineMs is invalid.");
  if (!INFERENCE_WORKLOAD_CLASSES.includes(value.resourceClass)) fail("invalid_inference_contract", "Unknown resourceClass.");
  if (value.privacyClass === "secret_forbidden" || !INFERENCE_PRIVACY_CLASSES.includes(value.privacyClass)) fail("privacy_boundary", "This privacy class cannot enter inference.");
  if (typeof value.shadowAllowed !== "boolean") fail("invalid_inference_contract", "shadowAllowed must be boolean.");
  if (value.media !== undefined) {
    shape(value.media, ["canonicalId", "editionId", "sourceFingerprint", "audioTrackId", "timebaseId"],
      ["canonicalId", "editionId", "sourceFingerprint"], "Inference media identity");
    id(value.media.canonicalId, "canonicalId"); id(value.media.editionId, "editionId");
    if (typeof value.media.sourceFingerprint !== "string" || !HASH.test(value.media.sourceFingerprint)) fail("invalid_inference_contract", "sourceFingerprint is invalid.");
    if (value.media.audioTrackId !== undefined) id(value.media.audioTrackId, "audioTrackId");
    if (value.media.timebaseId !== undefined) id(value.media.timebaseId, "timebaseId");
  }
  json(value.input, "input", 256 * 1024);
  return Object.freeze({ ...value, ...(value.media ? { media: Object.freeze({ ...value.media }) } : {}) });
}
export function validateInferenceResult(value, request = null) {
  const allowed = ["requestId", "capabilityId", "modelSetId", "outputSchemaVersion", "result", "confidence", "uncertainty",
    "evidenceRefs", "featureSnapshotId", "elapsedMs", "fallbackUsed", "reason"];
  shape(value, allowed, ["requestId", "capabilityId", "modelSetId", "outputSchemaVersion", "result", "confidence", "uncertainty",
    "evidenceRefs", "featureSnapshotId", "elapsedMs", "fallbackUsed"], "Inference result");
  for (const key of ["requestId", "capabilityId", "modelSetId", "featureSnapshotId"]) id(value[key], key);
  if (!Number.isSafeInteger(value.outputSchemaVersion) || value.outputSchemaVersion < 1) fail("invalid_inference_result", "Invalid output schema version.");
  for (const key of ["confidence", "uncertainty"]) if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) fail("invalid_inference_result", `${key} is invalid.`);
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length > 256 || value.evidenceRefs.some((entry) => typeof entry !== "string" || !ID.test(entry))) fail("invalid_inference_result", "Evidence references are invalid.");
  if (!Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 || typeof value.fallbackUsed !== "boolean") fail("invalid_inference_result", "Inference timing or fallback state is invalid.");
  if (value.reason !== undefined && (typeof value.reason !== "string" || value.reason.length > 512)) fail("invalid_inference_result", "Invalid result reason.");
  json(value.result, "result", 1024 * 1024);
  if (request && (value.requestId !== request.requestId || value.capabilityId !== request.capabilityId || value.featureSnapshotId !== request.featureSnapshotId)) fail("inference_result_mismatch", "Inference result does not match its request.");
  return Object.freeze({ ...value, evidenceRefs: Object.freeze([...value.evidenceRefs]) });
}
