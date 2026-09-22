import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const UPDATE_MANIFEST_SCHEMA = "reelos-update-manifest/v1";
export const TRUST_SCHEMA = "reelos-release-trust/v1";

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function releaseKeyFingerprint(publicKeyPem) {
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { fail("release_key_invalid", "The release public key is invalid."); }
  if (key.asymmetricKeyType !== "ed25519") fail("release_key_type", "The release key must be Ed25519.");
  return createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
}

function atomicJson(file, value, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
  renameSync(temporary, file);
}

export function bootstrapReleaseTrust({ publicKeyPath, trustStorePath, expectedFingerprint, confirmed = false, now = new Date() }) {
  if (!confirmed) fail("trust_confirmation_required", "Manual Day-0 trust bootstrap requires explicit confirmation.");
  if (!publicKeyPath || !existsSync(publicKeyPath) || lstatSync(publicKeyPath).isSymbolicLink()) {
    fail("release_key_missing", "A regular release public-key file is required.");
  }
  if (!/^[a-f0-9]{64}$/.test(String(expectedFingerprint || ""))) {
    fail("fingerprint_required", "Enter the full 64-character release-key fingerprint.");
  }
  const publicKey = readFileSync(publicKeyPath, "utf8");
  const fingerprint = releaseKeyFingerprint(publicKey);
  if (fingerprint !== expectedFingerprint) fail("fingerprint_mismatch", "The release-key fingerprint does not match.");
  if (existsSync(trustStorePath)) {
    const current = readTrustStore(trustStorePath);
    if (current.fingerprint !== fingerprint) fail("trust_already_bootstrapped", "Release trust is already pinned to another key.");
    return { created: false, ...current };
  }
  const trust = { schema: TRUST_SCHEMA, algorithm: "Ed25519", fingerprint, publicKey, bootstrappedAt: now.toISOString(), lastAcceptedSequence: 0, lastAcceptedVersion: null };
  atomicJson(trustStorePath, trust);
  return { created: true, ...trust };
}

export function readTrustStore(trustStorePath) {
  if (!trustStorePath || !existsSync(trustStorePath)) fail("release_trust_unavailable", "Release trust has not been bootstrapped.");
  let trust;
  try { trust = JSON.parse(readFileSync(trustStorePath, "utf8")); } catch { fail("release_trust_invalid", "The release trust store is invalid."); }
  if (trust?.schema !== TRUST_SCHEMA || trust.algorithm !== "Ed25519" || !Number.isSafeInteger(trust.lastAcceptedSequence) || trust.lastAcceptedSequence < 0 || releaseKeyFingerprint(trust.publicKey) !== trust.fingerprint) {
    fail("release_trust_invalid", "The release trust store failed validation.");
  }
  return trust;
}

export function manifestPayload(manifest) {
  const { signature: _signature, ...payload } = manifest || {};
  return Buffer.from(canonicalJson(payload));
}

export function verifyReleaseManifest(manifest, { trustStorePath, platform, architecture, now = Date.now() } = {}) {
  const trust = readTrustStore(trustStorePath);
  if (!manifest || manifest.schema !== UPDATE_MANIFEST_SCHEMA) fail("manifest_schema", "The update manifest schema is unsupported.");
  if (!manifest.release || typeof manifest.release.version !== "string" || !manifest.release.version.trim()) fail("manifest_release", "The manifest release is invalid.");
  if (!Number.isSafeInteger(manifest.release.sequence) || manifest.release.sequence <= trust.lastAcceptedSequence) fail("manifest_replay", "The update sequence is not newer than the active trust record.");
  if (!manifest.artifact || !/^[a-f0-9]{64}$/.test(manifest.artifact.sha256 || "") || !Number.isSafeInteger(manifest.artifact.bytes) || manifest.artifact.bytes < 1) {
    fail("manifest_artifact", "The manifest artifact receipt is invalid.");
  }
  if (manifest.artifact.platform !== platform || manifest.artifact.architecture !== architecture) fail("manifest_target", "The update is not for this platform and architecture.");
  if (!manifest.signature || manifest.signature.algorithm !== "Ed25519" || manifest.signature.keyFingerprint !== trust.fingerprint) fail("manifest_signature", "The manifest signature metadata is invalid.");
  const publishedAt = Date.parse(manifest.release.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > now + 5 * 60_000) fail("manifest_time", "The manifest publication time is invalid.");
  let signature;
  try { signature = Buffer.from(manifest.signature.value, "base64"); } catch { fail("manifest_signature", "The manifest signature is malformed."); }
  if (!signature.length || !verifySignature(null, manifestPayload(manifest), trust.publicKey, signature)) fail("manifest_signature", "The update manifest signature is not valid.");
  return { manifest, trustFingerprint: trust.fingerprint };
}

export function recordAcceptedRelease(trustStorePath, manifest) {
  const trust = readTrustStore(trustStorePath);
  if (!Number.isSafeInteger(manifest?.release?.sequence) || manifest.release.sequence <= trust.lastAcceptedSequence) fail("manifest_replay", "The accepted release sequence is not newer.");
  const updated = { ...trust, lastAcceptedSequence: manifest.release.sequence, lastAcceptedVersion: manifest.release.version, acceptedAt: new Date().toISOString() };
  atomicJson(trustStorePath, updated);
  return updated;
}

export function defaultTrustStore(stateDir) {
  return resolve(stateDir, "release-trust.json");
}
