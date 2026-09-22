import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bootstrapReleaseTrust, manifestPayload, releaseKeyFingerprint, verifyReleaseManifest } from "./release-trust.mjs";

function fixture(root) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const key = join(root, "release.pub"); const trust = join(root, "trust.json"); writeFileSync(key, pem);
  const fingerprint = releaseKeyFingerprint(pem);
  const manifest = { schema: "reelos-update-manifest/v1", release: { version: "2.5.1", sequence: 1, publishedAt: "2026-09-21T12:00:00.000Z" }, artifact: { platform: "linux", architecture: "x64", bytes: 7, sha256: "a".repeat(64) } };
  manifest.signature = { algorithm: "Ed25519", keyFingerprint: fingerprint, value: sign(null, manifestPayload(manifest), privateKey).toString("base64") };
  return { key, trust, fingerprint, manifest };
}

test("Day-0 trust bootstrap requires confirmation and the displayed fingerprint", () => {
  const root = mkdtempSync(join(tmpdir(), "reelos-trust-"));
  try {
    const f = fixture(root);
    assert.throws(() => bootstrapReleaseTrust({ publicKeyPath: f.key, trustStorePath: f.trust, expectedFingerprint: f.fingerprint }), { code: "trust_confirmation_required" });
    assert.throws(() => bootstrapReleaseTrust({ publicKeyPath: f.key, trustStorePath: f.trust, expectedFingerprint: "0".repeat(64), confirmed: true }), { code: "fingerprint_mismatch" });
    const result = bootstrapReleaseTrust({ publicKeyPath: f.key, trustStorePath: f.trust, expectedFingerprint: f.fingerprint, confirmed: true });
    assert.equal(result.created, true); assert.equal(JSON.parse(readFileSync(f.trust, "utf8")).fingerprint, f.fingerprint);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("signed manifests fail closed on tampering, target mismatch, and missing trust", () => {
  const root = mkdtempSync(join(tmpdir(), "reelos-manifest-"));
  try {
    const f = fixture(root); const options = { trustStorePath: f.trust, platform: "linux", architecture: "x64", now: Date.parse("2026-09-21T12:01:00Z") };
    assert.throws(() => verifyReleaseManifest(f.manifest, options), { code: "release_trust_unavailable" });
    bootstrapReleaseTrust({ publicKeyPath: f.key, trustStorePath: f.trust, expectedFingerprint: f.fingerprint, confirmed: true });
    assert.equal(verifyReleaseManifest(f.manifest, options).trustFingerprint, f.fingerprint);
    assert.throws(() => verifyReleaseManifest({ ...f.manifest, release: { ...f.manifest.release, version: "9.9.9" } }, options), { code: "manifest_signature" });
    assert.throws(() => verifyReleaseManifest(f.manifest, { ...options, platform: "win32" }), { code: "manifest_target" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
