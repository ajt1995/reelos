import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { atomicWriteJsonSync } from "../utils/fs-atomic.mjs";

export const NATIVE_REGISTRY_SCHEMA = 1;
export const NATIVE_SOURCE_KINDS = new Set([
  "public_domain",
  "personal_import",
  "provider_stream",
  "retained_local",
  "prepared_rendition",
]);

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const PROVIDER = /^[a-z][a-z0-9-]{0,63}$/;

function fail(message, code = "invalid_registry_record") {
  throw Object.assign(new Error(message), { code });
}

function cleanId(value, label) {
  const id = String(value || "").trim();
  if (!ID.test(id)) fail(`A valid ${label} is required.`);
  return id;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function defaultState() {
  return { schemaVersion: NATIVE_REGISTRY_SCHEMA, revision: 0, items: {} };
}

function validateSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) fail("A verified source is required.");
  if (!NATIVE_SOURCE_KINDS.has(source.kind)) fail("The source kind is not supported.");
  if (source.verified !== true) fail("Unverified sources cannot enter the native registry.", "source_unverified");
  const id = cleanId(source.id || randomUUID(), "source id");
  const provider = source.provider == null ? null : String(source.provider).trim().toLowerCase();
  if (provider != null && !PROVIDER.test(provider)) fail("The provider identity is invalid.");
  if (source.kind === "provider_stream" && !provider) fail("Provider streams require a provider identity.");
  if (["personal_import", "retained_local", "prepared_rendition"].includes(source.kind)) {
    if (!source.fileReceipt || typeof source.fileReceipt !== "object") fail("Local sources require a file receipt.");
    if (!Number.isSafeInteger(source.fileReceipt.sizeBytes) || source.fileReceipt.sizeBytes < 0) fail("The file receipt size is invalid.");
    if (!/^[a-f0-9]{64}$/.test(String(source.fileReceipt.fingerprint || ""))) fail("The file receipt fingerprint is invalid.");
  }
  return {
    ...source,
    id,
    provider,
    accessState: source.accessState === "revoked" ? "revoked" : "active",
    verifiedAt: Number.isFinite(source.verifiedAt) ? source.verifiedAt : Date.now(),
  };
}

export class NativeMediaRegistry {
  constructor({ stateDir = process.env.REELOS_STATE || path.join(process.cwd(), ".reelos-state") } = {}) {
    this.stateDir = path.resolve(stateDir);
    this.file = path.join(this.stateDir, "native-media-registry.json");
  }

  read() {
    if (!fs.existsSync(this.file)) return defaultState();
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      fail("The native media registry needs recovery.", "registry_corrupt");
    }
    if (parsed?.schemaVersion !== NATIVE_REGISTRY_SCHEMA || !parsed.items || typeof parsed.items !== "object") {
      fail("The native media registry schema is unsupported.", "registry_schema_mismatch");
    }
    return parsed;
  }

  write(state) {
    atomicWriteJsonSync(this.file, state, { mode: 0o600 });
    return state;
  }

  register(input) {
    const workId = cleanId(input?.workId, "work id");
    const editionId = cleanId(input?.editionId, "edition id");
    const itemId = cleanId(input?.itemId || `media-${sha256(`${workId}:${editionId}`).slice(0, 24)}`, "item id");
    const source = validateSource(input?.source);
    const state = this.read();
    const existing = state.items[itemId];
    if (existing && (existing.workId !== workId || existing.editionId !== editionId)) {
      fail("That media id already belongs to another edition.", "registry_identity_conflict");
    }
    const aliases = [...new Set([workId, ...(Array.isArray(input.aliases) ? input.aliases : [])].map((v) => cleanId(v, "alias")))];
    const sources = [...(existing?.sources || []).filter((entry) => entry.id !== source.id), source];
    state.items[itemId] = {
      itemId,
      workId,
      editionId,
      aliases,
      mediaType: ["movie", "tv", "episode", "book"].includes(input.mediaType) ? input.mediaType : "movie",
      title: String(input.title || existing?.title || "Untitled").trim().slice(0, 300),
      year: Number.isInteger(input.year) ? input.year : existing?.year ?? null,
      sources,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    state.revision += 1;
    this.write(state);
    return state.items[itemId];
  }

  get(itemOrAlias) {
    const id = cleanId(itemOrAlias, "media id");
    const state = this.read();
    const matches = Object.values(state.items).filter((item) => item.itemId === id || item.workId === id || item.aliases.includes(id));
    if (matches.length !== 1) return null;
    return matches[0];
  }

  list({ includeRevoked = false } = {}) {
    return Object.values(this.read().items).map((item) => ({
      ...item,
      sources: item.sources.filter((source) => includeRevoked || source.accessState === "active"),
    }));
  }

  revokeProvider(provider) {
    const clean = String(provider || "").trim().toLowerCase();
    if (!PROVIDER.test(clean)) fail("The provider identity is invalid.");
    const state = this.read();
    let changed = 0;
    for (const item of Object.values(state.items)) {
      item.sources = item.sources.map((source) => {
        if (source.provider !== clean || source.accessState === "revoked") return source;
        changed += 1;
        return { ...source, accessState: "revoked", revokedAt: Date.now() };
      });
      if (changed) item.updatedAt = Date.now();
    }
    if (changed) {
      state.revision += 1;
      this.write(state);
    }
    return changed;
  }

  publicProjection(item, { canAccessProvider = () => false } = {}) {
    if (!item) return null;
    const playableSources = item.sources.filter((source) => source.accessState === "active" && (
      source.kind !== "provider_stream" || canAccessProvider(source.provider)
    ));
    const primarySource = playableSources.find((source) => source.kind !== "provider_stream") || playableSources[0] || null;
    return {
      id: item.itemId,
      workId: item.workId,
      editionId: item.editionId,
      title: item.title,
      year: item.year,
      mediaType: item.mediaType,
      kind: item.mediaType === "tv" || item.mediaType === "episode" ? "tv" : item.mediaType,
      aliases: item.aliases,
      ready: playableSources.length > 0,
      sourceKinds: [...new Set(playableSources.map((source) => source.kind))],
      sourceKind: primarySource?.kind || null,
      sourceVerified: playableSources.length > 0,
      updatedAt: item.updatedAt,
    };
  }
}
