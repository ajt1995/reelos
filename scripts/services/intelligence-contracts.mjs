import { createHash, randomUUID } from "node:crypto";

export const INTELLIGENCE_SCHEMA_VERSION = 1;

export const EVENT_TYPES = Object.freeze(new Set([
  "taste.set", "taste.reset", "taste.export-candidate",
  "recommendation.impression", "recommendation.selected",
  "search.impression", "search.selected",
  "library.saved", "library.removed",
  "playback.started", "playback.progress", "playback.paused",
  "playback.stopped", "playback.completed", "playback.rewatched",
  "playback.failed", "source.failed",
  "preparation.queued", "preparation.started", "preparation.yielded",
  "preparation.completed", "preparation.failed", "preparation.cancelled",
  "analysis.completed", "analysis.invalidated",
  "machine.pressure", "machine.yielded", "machine.resumed",
  "storage.reserved", "storage.evicted",
  "model.inference", "model.candidate", "model.evaluated", "model.activated", "model.rolled-back",
  "decision.proposed", "decision.coordinated", "decision.outcome", "decision.corrected",
  "policy.changed", "profile.deleted", "media.deleted", "source.revoked",
]));

export const PRIVACY_CLASSES = Object.freeze(new Set([
  "local-private", "local-sensitive", "export-candidate",
]));

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const HASH = /^[a-f0-9]{64}$/;
const FORBIDDEN_LOCAL_KEYS = /(?:password|passwd|secret|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|magnet|infohash|(?:url|uri|path))$/i;
const EXPORT_FIELDS = new Set(["schemaVersion", "dimensions", "cohortSize", "noise", "expiresAt"]);
const PROFILE_EVENT = /^(?:recommendation|search|library|playback)\./;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function finiteInteger(value, name, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) throw new TypeError(`${name} must be a safe integer >= ${min}`);
  return value;
}

function normalizeText(value, name, max = 512) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function assertCanonicalId(value, name = "id") {
  if (typeof value !== "string" || !ID.test(value) || ["constructor", "prototype", "__proto__"].includes(value)) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot contain non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (plainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON accepts only JSON values");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function identity(prefix, fields) {
  return `${prefix}:v1:${sha256(canonicalJson(fields))}`;
}

export function createWorkId({ kind, namespace, externalId }) {
  return identity("work", {
    kind: normalizeText(kind, "kind", 32).toLowerCase(),
    namespace: normalizeText(namespace, "namespace", 64).toLowerCase(),
    externalId: normalizeText(externalId, "externalId", 256),
  });
}

export function createEditionId({ workId, cut, runtimeTicks, provenance, releaseTag = "unknown" }) {
  assertCanonicalId(workId, "workId");
  return identity("edition", {
    workId,
    cut: normalizeText(cut || "unknown", "cut", 128).toLowerCase(),
    runtimeTicks: finiteInteger(runtimeTicks, "runtimeTicks", { min: 1 }),
    provenance: normalizeText(provenance, "provenance", 256),
    releaseTag: normalizeText(releaseTag, "releaseTag", 128),
  });
}

export function createAssetId({ contentHash, byteLength }) {
  const hash = normalizeText(contentHash, "contentHash", 128).toLowerCase();
  if (!/^[a-z0-9]+:[a-f0-9]{32,128}$/.test(hash)) throw new TypeError("contentHash must include an algorithm and hexadecimal digest");
  return identity("asset", { contentHash: hash, byteLength: finiteInteger(byteLength, "byteLength", { min: 1 }) });
}

export function createTrackId({ assetId, kind, index, codec, language = "und", fingerprint }) {
  assertCanonicalId(assetId, "assetId");
  return identity("track", {
    assetId,
    kind: normalizeText(kind, "kind", 16).toLowerCase(),
    index: finiteInteger(index, "index"),
    codec: normalizeText(codec, "codec", 64).toLowerCase(),
    language: normalizeText(language, "language", 32).toLowerCase(),
    fingerprint: normalizeText(fingerprint, "fingerprint", 256),
  });
}

export function createTimelineIdentity({ editionId, assetId, videoTrackId, audioTrackId = null,
  timebaseNumerator, timebaseDenominator, ptsOrigin = 0, durationTicks, discontinuityMapHash = null }) {
  for (const [name, value] of Object.entries({ editionId, assetId, videoTrackId })) assertCanonicalId(value, name);
  if (audioTrackId !== null) assertCanonicalId(audioTrackId, "audioTrackId");
  if (discontinuityMapHash !== null && (typeof discontinuityMapHash !== "string" || !HASH.test(discontinuityMapHash))) {
    throw new TypeError("discontinuityMapHash must be a SHA-256 digest");
  }
  const value = {
    editionId, assetId, videoTrackId, audioTrackId,
    timebaseNumerator: finiteInteger(timebaseNumerator, "timebaseNumerator", { min: 1 }),
    timebaseDenominator: finiteInteger(timebaseDenominator, "timebaseDenominator", { min: 1 }),
    ptsOrigin: finiteInteger(ptsOrigin, "ptsOrigin"),
    durationTicks: finiteInteger(durationTicks, "durationTicks", { min: 1 }),
    discontinuityMapHash,
  };
  return { id: identity("timeline", value), ...value };
}

function inspectPrivacy(value, mode, path = "payload", depth = 0) {
  if (depth > 10) throw new TypeError(`${path} is too deeply nested`);
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && value.length > 8192) throw new TypeError(`${path} is too large`);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2048) throw new TypeError(`${path} has too many entries`);
    value.forEach((entry, index) => inspectPrivacy(entry, mode, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!plainObject(value)) throw new TypeError(`${path} must contain JSON values only`);
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_LOCAL_KEYS.test(key)) throw new TypeError(`${path}.${key} may contain credentials or private locations`);
    if (mode === "export" && !EXPORT_FIELDS.has(key)) throw new TypeError(`${path}.${key} is not in the export allowlist`);
    inspectPrivacy(entry, mode, `${path}.${key}`, depth + 1);
  }
}

export function validateEvent(input) {
  if (!plainObject(input)) throw new TypeError("event must be an object");
  if (!EVENT_TYPES.has(input.type)) throw new TypeError("event type is not registered");
  const privacyClass = input.privacyClass || "local-private";
  if (!PRIVACY_CLASSES.has(privacyClass)) throw new TypeError("privacyClass is invalid");
  if (privacyClass === "export-candidate" && input.type !== "taste.export-candidate") {
    throw new TypeError("only anonymous taste summaries may be export candidates");
  }
  const payload = input.payload ?? {};
  inspectPrivacy(payload, privacyClass === "export-candidate" ? "export" : "local");
  const occurredAt = input.occurredAt ?? Date.now();
  finiteInteger(occurredAt, "occurredAt", { min: 1 });
  const event = {
    eventId: input.eventId || randomUUID(), schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    type: input.type, occurredAt, recordedAt: input.recordedAt ?? Date.now(),
    privacyClass, source: normalizeText(input.source || "unknown", "source", 128),
    profileId: input.profileId ?? null, deviceId: input.deviceId ?? null,
    sessionId: input.sessionId ?? null, workId: input.workId ?? null,
    editionId: input.editionId ?? null, assetId: input.assetId ?? null,
    renditionId: input.renditionId ?? null, timelineId: input.timelineId ?? null,
    sourceId: input.sourceId ?? null, causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? null, policySnapshotId: input.policySnapshotId ?? null,
    payload,
  };
  if ((PROFILE_EVENT.test(event.type) || event.type === "taste.set" || event.type === "taste.reset") && !event.profileId) {
    throw new TypeError(`${event.type} requires profileId`);
  }
  assertCanonicalId(event.eventId, "eventId");
  for (const field of ["profileId", "deviceId", "sessionId", "workId", "editionId", "assetId", "renditionId", "timelineId", "sourceId", "causationId", "correlationId", "policySnapshotId"]) {
    if (event[field] !== null) assertCanonicalId(event[field], field);
  }
  finiteInteger(event.recordedAt, "recordedAt", { min: 1 });
  event.payloadJson = canonicalJson(payload);
  event.payloadHash = sha256(event.payloadJson);
  return Object.freeze(event);
}

export function profileTombstoneHash(profileId, storeSalt) {
  assertCanonicalId(profileId, "profileId");
  if (typeof storeSalt !== "string" || storeSalt.length < 16) throw new TypeError("storeSalt must be at least 16 characters");
  return sha256(`profile\0${storeSalt}\0${profileId}`);
}
