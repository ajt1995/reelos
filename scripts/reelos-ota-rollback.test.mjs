import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bootstrapReleaseTrust, manifestPayload, releaseKeyFingerprint } from "./release-trust.mjs";
import { applySignedUpdate, probeReleaseHealth } from "./signed-update.mjs";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "reelos-update-")); const stateDir = join(root, "state"); const installDir = join(root, "install");
  mkdirSync(stateDir); mkdirSync(installDir); mkdirSync(join(installDir, "old")); writeFileSync(join(installDir, "old", "package.json"), "{}");
  writeFileSync(join(installDir, "current.json"), JSON.stringify({ version: "2.5.0", path: join(installDir, "old") }));
  const artifactPath = join(root, "release.tar"); writeFileSync(artifactPath, "payload");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519"); const pem = publicKey.export({ type: "spki", format: "pem" }); const key = join(root, "release.pub"); writeFileSync(key, pem);
  const fingerprint = releaseKeyFingerprint(pem); bootstrapReleaseTrust({ publicKeyPath: key, trustStorePath: join(stateDir, "release-trust.json"), expectedFingerprint: fingerprint, confirmed: true });
  const manifest = { schema: "reelos-update-manifest/v1", release: { version: "2.5.1", sequence: 1, publishedAt: new Date().toISOString() }, artifact: { platform: "win32", architecture: "x64", bytes: 7, sha256: createHash("sha256").update("payload").digest("hex") } };
  manifest.signature = { algorithm: "Ed25519", keyFingerprint: fingerprint, value: sign(null, manifestPayload(manifest), privateKey).toString("base64") };
  const unpack = (_archive, destination) => { mkdirSync(destination); writeFileSync(join(destination, "package.json"), "{}"); };
  return { root, stateDir, installDir, artifactPath, manifest, unpack };
}

test("verified release is staged and becomes active only after version-matched health", async () => {
  const f = setup(); let restarts = 0;
  try {
    const result = await applySignedUpdate({ ...f, platform: "win32", architecture: "x64", serviceController: { restart: () => { restarts += 1; } }, healthCheck: async ({ version }) => version === "2.5.1" });
    assert.equal(result.state, "active"); assert.equal(restarts, 1); assert.equal(JSON.parse(readFileSync(join(f.installDir, "current.json"))).version, "2.5.1"); assert.equal(JSON.parse(readFileSync(join(f.installDir, "previous.json"))).version, "2.5.0");
    const trust = JSON.parse(readFileSync(join(f.stateDir, "release-trust.json"), "utf8"));
    assert.equal(trust.lastAcceptedSequence, 1); assert.equal(trust.lastAcceptedVersion, "2.5.1");
    await assert.rejects(applySignedUpdate({ ...f, platform: "win32", architecture: "x64", serviceController: { restart() {} }, healthCheck: async () => true }), { code: "manifest_replay" });
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("failed health gate restores and verifies the previous release", async () => {
  const f = setup(); const probed = [];
  try {
    await assert.rejects(applySignedUpdate({ ...f, platform: "win32", architecture: "x64", serviceController: { restart() {} }, healthCheck: async ({ version }) => { probed.push(version); return version === "2.5.0"; } }), { code: "update_rolled_back" });
    assert.deepEqual(probed, ["2.5.1", "2.5.0"]); assert.equal(JSON.parse(readFileSync(join(f.installDir, "current.json"))).version, "2.5.0"); assert.equal(JSON.parse(readFileSync(join(f.stateDir, "update-status.json"))).state, "rolled-back");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("artifact tampering is rejected before unpack or activation", async () => {
  const f = setup(); let touched = false;
  try {
    writeFileSync(f.artifactPath, "changed");
    await assert.rejects(applySignedUpdate({ ...f, platform: "win32", architecture: "x64", unpack: () => { touched = true; }, serviceController: { restart() {} }, healthCheck: async () => true }), { code: "artifact_digest" });
    assert.equal(touched, false); assert.equal(JSON.parse(readFileSync(join(f.installDir, "current.json"))).version, "2.5.0");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("health gate requires the running service to report the exact release version", async () => {
  const response = (body) => async () => ({ status: 200, json: async () => body });
  assert.equal(await probeReleaseHealth({ version: "2.5.1", attempts: 1, fetchImpl: response({ provisioned: true, update: { local: "2.5.1" } }) }), true);
  assert.equal(await probeReleaseHealth({ version: "2.5.1", attempts: 1, fetchImpl: response({ provisioned: true, update: { local: "2.5.0" } }) }), false);
  assert.equal(await probeReleaseHealth({ version: "2.5.1", attempts: 1, fetchImpl: response({ update: { local: "2.5.1" } }) }), false);
});
