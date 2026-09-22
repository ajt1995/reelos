import { canonicalJson, sha256 } from "./intelligence-contracts.mjs";

export const NODE_CONTRACT_VERSION = 1;
export const NODE_PLATFORMS = Object.freeze(["windows", "linux", "android", "android-tv"]);
export const CAPABILITY_STAGES = Object.freeze(["unavailable", "validating", "assisting", "active"]);
export const NODE_WORKLOADS = Object.freeze([
  "playback", "storage", "preparation", "transcode", "analysis", "model-inference",
]);
export const HOUSEHOLD_ENTITY_SCOPES = Object.freeze([
  "profile", "taste", "catalog", "library", "progress", "book", "device", "preference", "presence",
]);

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const HASH = /^[a-f0-9]{64}$/;
const SECRET = /(?:password|secret|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|magnet|private[_-]?key)$/i;
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new TypeError(message), { code }); };

function id(value, name) {
  if (typeof value !== "string" || !ID.test(value) || ["constructor", "prototype", "__proto__"].includes(value)) {
    fail("node_contract_invalid", `${name} is invalid.`);
  }
  return value;
}

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail("node_contract_invalid", `${name} is invalid.`);
  return value;
}

function inspect(value, path = "payload", depth = 0) {
  if (depth > 12) fail("node_contract_too_deep", `${path} is too deeply nested.`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("node_contract_invalid", `${path} is not finite.`);
    return;
  }
  if (typeof value === "string") {
    if (value.length > 16_384) fail("node_contract_too_large", `${path} is too large.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2_048) fail("node_contract_too_large", `${path} has too many entries.`);
    value.forEach((entry, index) => inspect(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!plain(value)) fail("node_contract_invalid", `${path} must contain JSON values.`);
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET.test(key)) fail("node_contract_secret", `${path}.${key} may contain a secret.`);
    inspect(entry, `${path}.${key}`, depth + 1);
  }
}

export function validateNodeCapabilityManifest(input) {
  if (!plain(input) || input.schemaVersion !== NODE_CONTRACT_VERSION) fail("node_contract_invalid", "Unsupported node contract.");
  const platform = String(input.platform || "");
  if (!NODE_PLATFORMS.includes(platform)) fail("node_contract_invalid", "Node platform is unsupported.");
  if (!Array.isArray(input.workloads) || input.workloads.some((entry) => !NODE_WORKLOADS.includes(entry))) {
    fail("node_contract_invalid", "Node workloads are invalid.");
  }
  if (!plain(input.capabilities)) fail("node_contract_invalid", "Node capabilities are required.");
  const capabilities = {};
  for (const [capabilityId, value] of Object.entries(input.capabilities)) {
    id(capabilityId, "capabilityId");
    if (!plain(value) || !CAPABILITY_STAGES.includes(value.stage)) fail("node_contract_invalid", "Capability stage is invalid.");
    capabilities[capabilityId] = Object.freeze({
      stage: value.stage,
      measured: value.measured === true,
      reason: typeof value.reason === "string" ? value.reason.slice(0, 512) : null,
    });
  }
  const limits = input.resourceLimits;
  if (!plain(limits)) fail("node_contract_invalid", "Resource limits are required.");
  const value = {
    schemaVersion: NODE_CONTRACT_VERSION,
    nodeId: id(input.nodeId, "nodeId"), householdId: input.householdId == null ? null : id(input.householdId, "householdId"),
    platform, version: String(input.version || "").slice(0, 64),
    workloads: Object.freeze([...new Set(input.workloads)]), capabilities: Object.freeze(capabilities),
    resourceLimits: Object.freeze({
      memoryBytes: integer(limits.memoryBytes, "memoryBytes"),
      storageBytes: integer(limits.storageBytes, "storageBytes"),
      concurrency: integer(limits.concurrency, "concurrency"),
      playbackPriority: limits.playbackPriority === true,
    }),
    generatedAt: integer(input.generatedAt, "generatedAt", 1),
  };
  if (!value.version) fail("node_contract_invalid", "Node version is required.");
  return Object.freeze({ ...value, manifestHash: sha256(canonicalJson(value)) });
}

export function validateHouseholdDelta(input) {
  if (!plain(input) || input.schemaVersion !== NODE_CONTRACT_VERSION) fail("household_delta_invalid", "Unsupported household delta.");
  if (!HOUSEHOLD_ENTITY_SCOPES.includes(input.scope)) fail("household_delta_invalid", "Household delta scope is invalid.");
  if (!['upsert', 'delete'].includes(input.operation)) fail("household_delta_invalid", "Household delta operation is invalid.");
  const payload = input.operation === "delete" ? null : input.payload;
  if (input.operation === "upsert" && !plain(payload)) fail("household_delta_invalid", "Upsert delta payload is required.");
  inspect(payload);
  const value = {
    schemaVersion: NODE_CONTRACT_VERSION,
    deltaId: id(input.deltaId, "deltaId"), householdId: id(input.householdId, "householdId"),
    originNodeId: id(input.originNodeId, "originNodeId"), scope: input.scope,
    entityId: id(input.entityId, "entityId"), ownerProfileId: input.ownerProfileId == null ? null : id(input.ownerProfileId, "ownerProfileId"),
    operation: input.operation, revision: integer(input.revision, "revision", 1),
    occurredAt: integer(input.occurredAt, "occurredAt", 1), payload,
    previousHash: input.previousHash == null ? null : String(input.previousHash),
  };
  if (value.previousHash !== null && !HASH.test(value.previousHash)) fail("household_delta_invalid", "Delta previousHash is invalid.");
  if (["profile", "taste", "progress", "book", "preference"].includes(value.scope) && !value.ownerProfileId) {
    fail("household_delta_owner_required", "Profile-private state requires an owner.");
  }
  return Object.freeze({ ...value, deltaHash: sha256(canonicalJson(value)) });
}

export function resolveHouseholdDelta(current, incoming) {
  const next = validateHouseholdDelta(incoming);
  if (!current) return next;
  const prior = validateHouseholdDelta(current);
  if (prior.householdId !== next.householdId || prior.scope !== next.scope || prior.entityId !== next.entityId
    || prior.ownerProfileId !== next.ownerProfileId) fail("household_delta_mismatch", "Household deltas do not describe the same entity.");
  if (next.revision < prior.revision) return prior;
  if (next.revision > prior.revision) return next;
  if (next.deltaHash === prior.deltaHash) return prior;
  if (next.scope === "progress" && next.operation === "upsert" && prior.operation === "upsert") {
    const nextPosition = Number(next.payload?.positionTicks || 0);
    const priorPosition = Number(prior.payload?.positionTicks || 0);
    return nextPosition > priorPosition ? next : prior;
  }
  fail("household_delta_conflict", "Equal-revision household state requires an explicit user decision.");
}
