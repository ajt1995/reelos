import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  canDispatchProviderRequest,
  canUseProviderStream,
  createProviderValidation,
  filterAccessibleLibraryItems,
  libraryItemSourceKind,
  publicSourcePolicy,
  readProviderValidation,
  sourcePolicyFromState,
  writeProviderValidation,
} from "./source-access-policy.mjs";

test("a stored provider key does not silently enable debrid", () => {
  const policy = sourcePolicyFromState({ answers: { source: "torbox", apiKey: "stored-secret" } });
  assert.equal(policy.mode, "public-personal");
  assert.equal(canDispatchProviderRequest(policy), false);
  assert.equal(canUseProviderStream(policy), false);
});

test("enabled but unvalidated provider remains unavailable", () => {
  const policy = sourcePolicyFromState({
    answers: { source: "torbox", apiKey: "stored-secret" },
    uiSettings: { debridEnabled: true, debridStatus: "validating" },
  });
  assert.equal(policy.connected, false);
});

test("only an enabled, connected, supported provider with a key is usable", () => {
  const policy = sourcePolicyFromState({
    answers: { source: "torbox", apiKey: "stored-secret" },
    uiSettings: { debridEnabled: true, debridProvider: "torbox", debridStatus: "connected" },
    validation: createProviderValidation("torbox", "stored-secret", "account-one"),
  });
  assert.equal(policy.mode, "debrid");
  assert.equal(canDispatchProviderRequest(policy), true);
  assert.deepEqual(publicSourcePolicy(policy), {
    mode: "debrid",
    enabled: true,
    provider: "torbox",
    status: "connected",
    connected: true,
  });
});

test("Real-Debrid uses the same explicit connected policy", () => {
  const policy = sourcePolicyFromState({
    answers: { source: "real-debrid", apiKey: "stored-secret" },
    uiSettings: { debridEnabled: true, debridProvider: "real-debrid", debridStatus: "connected" },
    validation: createProviderValidation("real-debrid", "stored-secret", "account-one"),
  });
  assert.equal(policy.provider, "real-debrid");
  assert.equal(policy.connected, true);
  assert.equal(canDispatchProviderRequest(policy), true);
});

test("legacy connected, changed key, provider, and environment override require fresh validation", () => {
  const answers = { source: "torbox", apiKey: "old-secret" };
  const uiSettings = { debridEnabled: true, debridProvider: "torbox", debridStatus: "connected" };
  const validation = createProviderValidation("torbox", "old-secret", "account-one");
  const policy = (overrides = {}) => sourcePolicyFromState({ answers, uiSettings, validation, ...overrides });
  assert.equal(policy({ validation: null }).connected, false);
  assert.equal(policy({ answers: { source: "torbox", apiKey: "new-secret" } }).connected, false);
  assert.equal(policy({ env: { TORBOX_API_KEY: "new-secret" } }).connected, false);
  assert.equal(policy({ uiSettings: { ...uiSettings, debridProvider: "real-debrid" } }).connected, false);
  assert.equal(policy({ uiSettings: { ...uiSettings, debridEnabled: false } }).connected, false);
  assert.equal(policy({ uiSettings: { ...uiSettings, debridConnection: { enabled: false, status: "connected", provider: "torbox" } } }).connected, false);
  assert.equal(policy({ uiSettings: { ...uiSettings, debridEnabled: false,
    debridConnection: { enabled: true, status: "connected", provider: "torbox" } } }).connected, false);
  assert.equal(policy({ uiSettings: { ...uiSettings,
    debridConnection: { enabled: true, status: "failed", provider: "torbox" } } }).connected, false);
  assert.equal(policy({ env: { TORBOX_API_KEY: "old-secret" } }).connected, true);
  const publicView = JSON.stringify(publicSourcePolicy(policy()));
  assert.doesNotMatch(publicView, /secret|accountFingerprint|credentialFingerprint|accountScope/);
  assert.notEqual(policy().accountScope,
    policy({ validation: createProviderValidation("torbox", "old-secret", "account-two") }).accountScope);
});

test("private validation record persists only fingerprints and missing records fail closed", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-provider-validation-"));
  try {
    assert.equal(readProviderValidation(stateDir), null);
    const record = createProviderValidation("torbox", "synthetic-key", "account-private");
    writeProviderValidation(stateDir, record);
    const saved = fs.readFileSync(path.join(stateDir, "provider-validation.json"), "utf8");
    assert.doesNotMatch(saved, /synthetic-key|account-private/);
    assert.deepEqual(readProviderValidation(stateDir), record);
    const policy = sourcePolicyFromState({
      answers: { source: "torbox", apiKey: "synthetic-key" },
      uiSettings: { debridEnabled: true, debridProvider: "torbox", debridStatus: "connected" },
      validation: readProviderValidation(stateDir),
    });
    assert.equal(policy.connected, true);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test("unsupported provider cannot become connected", () => {
  const policy = sourcePolicyFromState({
    answers: { apiKey: "stored-secret" },
    uiSettings: { debridEnabled: true, debridProvider: "unknown", debridStatus: "connected" },
  });
  assert.equal(policy.connected, false);
});

test("library projections hide debrid symlinks when the provider is off", () => {
  const items = [
    { id: "personal", path: "/media/family/home-video.mp4" },
    { id: "public", path: "/var/lib/reelos/sample-library/charade.mp4" },
    { id: "provider", path: "/mnt/symlinks/radarr/Batman/movie.mkv",
      source: { provider: "torbox", accountScope: "f".repeat(64) } },
    { id: "legacy", path: "/mnt/symlinks/radarr/Old/movie.mkv" },
    { id: "unknown", path: "" },
  ];
  assert.equal(libraryItemSourceKind(items[2]), "debrid");
  assert.deepEqual(
    filterAccessibleLibraryItems(items, { connected: false }).map((item) => item.id),
    ["personal", "public"],
  );
  assert.deepEqual(
    filterAccessibleLibraryItems(items, { connected: true, provider: "torbox", accountScope: "f".repeat(64) }).map((item) => item.id),
    ["personal", "public", "provider"],
  );
  assert.deepEqual(
    filterAccessibleLibraryItems(items, { connected: true, provider: "torbox", accountScope: "e".repeat(64) }).map((item) => item.id),
    ["personal", "public"],
  );
});
