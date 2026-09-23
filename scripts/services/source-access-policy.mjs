/**
 * One source-of-truth for whether ReelOS may contact a debrid provider.
 *
 * A stored key is deliberately insufficient. The owner must explicitly enable
 * the provider and ReelOS must have recorded a successful validation.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { atomicWriteJsonSync } from "../utils/fs-atomic.mjs";

export const DEFAULT_DEBRID_PROVIDER = "torbox";
export const SUPPORTED_DEBRID_PROVIDERS = new Set(["torbox", "real-debrid"]);
const VALIDATION_SCHEMA = 1;
const DIGEST = /^[a-f0-9]{64}$/;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function effectiveProviderKey(provider, answers = {}, env = {}) {
  const fromEnvironment = provider === "real-debrid"
    ? env.REAL_DEBRID_API_KEY || env.RD_API_KEY
    : provider === "torbox" ? env.TORBOX_API_KEY : "";
  return String(fromEnvironment || (answers.source === provider ? answers.apiKey : "") || "").trim();
}

export function createProviderValidation(provider, apiKey, accountId) {
  const key = String(apiKey || "").trim();
  const account = String(accountId || "").trim();
  if (!SUPPORTED_DEBRID_PROVIDERS.has(provider) || !key || !account) throw new Error("A verified provider account is required.");
  return {
    schemaVersion: VALIDATION_SCHEMA,
    provider,
    credentialFingerprint: digest(`${provider}\0${key}`),
    accountFingerprint: digest(`${provider}\0${account}`),
    validatedAt: new Date().toISOString(),
  };
}

export function readProviderValidation(stateDir) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(stateDir, "provider-validation.json"), "utf8"));
    if (record?.schemaVersion !== VALIDATION_SCHEMA || !SUPPORTED_DEBRID_PROVIDERS.has(record.provider)
        || !DIGEST.test(record.credentialFingerprint) || !DIGEST.test(record.accountFingerprint)) return null;
    return record;
  } catch { return null; }
}

export function writeProviderValidation(stateDir, record) {
  if (record?.schemaVersion !== VALIDATION_SCHEMA || !SUPPORTED_DEBRID_PROVIDERS.has(record.provider)
      || !DIGEST.test(record.credentialFingerprint) || !DIGEST.test(record.accountFingerprint)) {
    throw new Error("A verified provider account is required.");
  }
  atomicWriteJsonSync(path.join(stateDir, "provider-validation.json"), record, { mode: 0o600 });
}

export function sourcePolicyFromState({
  answers = {},
  uiSettings = {},
  env = {},
  validation = null,
} = {}) {
  const connection = uiSettings?.debridConnection || {};
  const enabled = typeof connection.enabled === "boolean" ? connection.enabled : uiSettings?.debridEnabled === true;
  const provider = String(
    connection.provider ||
      uiSettings?.debridProvider ||
      answers?.source ||
      DEFAULT_DEBRID_PROVIDER,
  ).toLowerCase();
  const savedStatus = String(
    connection.status || uiSettings?.debridStatus || "disabled",
  ).toLowerCase();
  const apiKey = effectiveProviderKey(provider, answers, env);
  const supported = SUPPORTED_DEBRID_PROVIDERS.has(provider);
  const validated = validation?.schemaVersion === VALIDATION_SCHEMA && validation.provider === provider
    && DIGEST.test(validation.credentialFingerprint) && DIGEST.test(validation.accountFingerprint)
    && validation.credentialFingerprint === digest(`${provider}\0${apiKey}`);
  const connected = enabled && supported && savedStatus === "connected" && apiKey.length > 0 && validated;
  const status = enabled && savedStatus === "connected" && !connected ? "validating" : savedStatus;

  return {
    mode: connected ? "debrid" : "public-personal",
    enabled,
    provider,
    status,
    supported,
    connected,
    apiKey,
    accountScope: connected ? digest(`${provider}\0${validation.credentialFingerprint}\0${validation.accountFingerprint}`) : null,
  };
}

export function canDispatchProviderRequest(policy) {
  return policy?.connected === true;
}

export function canUseProviderStream(policy) {
  return policy?.connected === true;
}

export function publicSourcePolicy(policy = {}) {
  return {
    mode: policy.mode === "debrid" ? "debrid" : "public-personal",
    enabled: policy.enabled === true,
    provider: policy.provider || DEFAULT_DEBRID_PROVIDER,
    status: policy.status || "disabled",
    connected: policy.connected === true,
  };
}

export function providerUnavailablePayload() {
  return {
    ok: false,
    code: "SOURCE_UNAVAILABLE",
    error:
      "Connect and validate a debrid provider before requesting this title.",
  };
}

export function libraryItemSourceKind(item = {}) {
  const declared = String(
    item.sourceKind || item.source?.kind || "",
  ).toLowerCase();
  if (declared === "provider_stream") return "debrid";
  if (declared === "prepared_rendition") return "retained_local";
  if (
    [
      "public_domain",
      "public_catalog",
      "personal_import",
      "retained_local",
      "debrid",
    ].includes(declared)
  ) {
    return declared;
  }
  const path = String(item.path || item.Path || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  if (!path) return "unknown";
  if (
    path.includes("/mnt/debrid/") ||
    path.includes("/mnt/symlinks/") ||
    path.includes("/symlinks/")
  ) {
    return "debrid";
  }
  if (path.includes("public-domain") || path.includes("sample-library"))
    return "public_domain";
  return "personal_import";
}

export function libraryItemIsAccessible(item, policy) {
  const kind = libraryItemSourceKind(item);
  if (kind === "debrid") return policy?.connected === true;
  return (
    kind === "public_domain" ||
    kind === "personal_import" ||
    kind === "retained_local"
  );
}

export function filterAccessibleLibraryItems(items = [], policy = {}) {
  return (items || []).filter((item) => libraryItemIsAccessible(item, policy));
}
