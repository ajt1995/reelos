import fs from "node:fs";
import path from "node:path";
import { createHash, verify as verifySignature } from "node:crypto";

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function unsignedManifest(manifest) {
  const { signature, ...unsigned } = manifest;
  return unsigned;
}

function validateManifest(manifest) {
  if (!object(manifest) || manifest.schemaVersion !== 1) fail("artifact_manifest_invalid", "Unsupported artifact manifest.");
  for (const field of ["artifactId", "capabilityId", "modelFamily", "version", "sha256", "keyId", "signature", "runtime", "inputSchema", "outputSchema", "fallbackId"]) {
    if (typeof manifest[field] !== "string" || !manifest[field]) fail("artifact_manifest_invalid", `Artifact manifest requires ${field}.`);
  }
  for (const field of ["artifactId", "capabilityId", "modelFamily", "keyId", "fallbackId"]) {
    if (!ID.test(manifest[field])) fail("artifact_manifest_invalid", `Artifact ${field} is invalid.`);
  }
  if (!SHA256.test(manifest.sha256) || !Number.isSafeInteger(manifest.byteSize) || manifest.byteSize < 1) fail("artifact_manifest_invalid", "Artifact size or digest is invalid.");
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0 || manifest.platforms.some((entry) => typeof entry !== "string" || !entry)) fail("artifact_manifest_invalid", "Artifact platforms are invalid.");
  if (!object(manifest.license) || typeof manifest.license.id !== "string" || !manifest.license.id
    || manifest.license.redistributionAllowed !== true || !SHA256.test(manifest.license.noticeSha256)) {
    fail("artifact_license_invalid", "Artifact license does not prove redistribution permission.");
  }
  if (!object(manifest.resourceProfile) || !Number.isSafeInteger(manifest.resourceProfile.ramBytes) || manifest.resourceProfile.ramBytes < 0) fail("artifact_manifest_invalid", "Artifact resource profile is invalid.");
  return manifest;
}

function regularFile(file, maxBytes = Number.MAX_SAFE_INTEGER) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > maxBytes) fail("artifact_file_invalid", "Artifact must be a bounded regular file.");
  return stat;
}

function hashFile(file) {
  const hash = createHash("sha256");
  const handle = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally { fs.closeSync(handle); }
  return hash.digest("hex");
}

export class ModelArtifactRegistry {
  constructor({ stateDir, trustedKeys = {}, platform = process.platform } = {}) {
    if (typeof stateDir !== "string" || !path.isAbsolute(stateDir)) fail("invalid_state_dir", "Artifact registry requires an absolute local directory.");
    this.stateDir = stateDir;
    this.platform = platform;
    this.trustedKeys = new Map(Object.entries(trustedKeys));
    this.file = path.join(stateDir, "intelligence", "artifact-registry.json");
    this.artifacts = new Map();
    this.active = new Map();
    this.load();
  }

  verify({ manifestPath, artifactPath }) {
    regularFile(manifestPath, 1024 * 1024);
    let manifest;
    try { manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8"))); }
    catch (error) { if (error.code) throw error; fail("artifact_manifest_invalid", "Artifact manifest could not be read."); }
    const stat = regularFile(artifactPath, 16 * 1024 ** 3);
    if (stat.size !== manifest.byteSize) fail("artifact_size_mismatch", "Artifact size does not match its signed manifest.");
    const digest = hashFile(artifactPath);
    if (digest !== manifest.sha256) fail("artifact_hash_mismatch", "Artifact digest does not match its signed manifest.");
    const publicKey = this.trustedKeys.get(manifest.keyId);
    if (!publicKey) fail("artifact_key_untrusted", "Artifact signing key is not trusted.");
    let signature;
    try { signature = Buffer.from(manifest.signature, "base64"); } catch { fail("artifact_signature_invalid", "Artifact signature is invalid."); }
    const signed = Buffer.from(canonicalJson(unsignedManifest(manifest)));
    if (!verifySignature(null, signed, publicKey, signature)) fail("artifact_signature_invalid", "Artifact signature verification failed.");
    if (!manifest.platforms.includes(this.platform) && !manifest.platforms.includes("any")) fail("artifact_unsupported", "Artifact is not compatible with this platform.");
    return Object.freeze({ manifest: Object.freeze({ ...manifest }), manifestPath: path.resolve(manifestPath),
      artifactPath: path.resolve(artifactPath), verifiedAt: Date.now(), status: "verified" });
  }

  verifyAndRegister(files) {
    const record = this.verify(files);
    const manifest = record.manifest;
    this.artifacts.set(manifest.artifactId, record);
    this.persist();
    return record;
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    const stat = regularFile(this.file, 1024 * 1024);
    let data;
    try { data = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { fail("artifact_registry_invalid", "Artifact registry state needs recovery."); }
    if (data?.schemaVersion !== 1 || !Array.isArray(data.artifacts) || !Array.isArray(data.active)) fail("artifact_registry_invalid", "Artifact registry state needs recovery.");
    for (const stored of data.artifacts) {
      try {
        const record = this.verify(stored);
        this.artifacts.set(record.manifest.artifactId, record);
      } catch { /* A missing or changed artifact remains honestly unavailable. */ }
    }
    for (const stored of data.active) {
      if (!object(stored) || typeof stored.capabilityId !== "string" || !Array.isArray(stored.artifactIds)) continue;
      const valid = stored.artifactIds.length > 0 && stored.artifactIds.every((id) => {
        const record = this.artifacts.get(id);
        return record?.manifest.capabilityId === stored.capabilityId;
      });
      if (valid) this.active.set(stored.capabilityId, Object.freeze({ ...stored, artifactIds: Object.freeze([...stored.artifactIds]) }));
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const value = { schemaVersion: 1,
      artifacts: [...this.artifacts.values()].map(({ manifestPath, artifactPath }) => ({ manifestPath, artifactPath })),
      active: [...this.active.values()].map((record) => ({ ...record, artifactIds: [...record.artifactIds] })) };
    const temp = `${this.file}.tmp.${process.pid}.${Date.now()}`;
    try {
      fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
      fs.renameSync(temp, this.file);
    } catch (error) {
      try { fs.unlinkSync(temp); } catch {}
      fail("artifact_registry_save_failed", "Artifact registry state could not be saved.");
    }
  }

  activate(capabilityId, artifactIds, { evaluated = false } = {}) {
    if (!evaluated) fail("artifact_evaluation_required", "Only an evaluated model set can be activated.");
    if (!Array.isArray(artifactIds) || artifactIds.length === 0) fail("artifact_set_invalid", "Model set requires verified artifacts.");
    const records = artifactIds.map((id) => this.artifacts.get(id));
    if (records.some((record) => !record || record.status !== "verified" || record.manifest.capabilityId !== capabilityId)) {
      fail("artifact_set_invalid", "Model set contains an absent, unverified, or mismatched artifact.");
    }
    const modelSetId = createHash("sha256").update(artifactIds.slice().sort().join("\n")).digest("hex").slice(0, 32);
    const active = Object.freeze({ capabilityId, modelSetId, artifactIds: Object.freeze([...artifactIds]), activatedAt: Date.now() });
    this.active.set(capabilityId, active);
    this.persist();
    return active;
  }

  getActive(capabilityId) { return this.active.get(capabilityId) || null; }
  getArtifact(id) { return this.artifacts.get(id) || null; }
  status(capabilityId) {
    const active = this.getActive(capabilityId);
    return active ? { available: true, ...active } : { available: false, capabilityId, reason: "No verified, evaluated model set is active." };
  }
}
