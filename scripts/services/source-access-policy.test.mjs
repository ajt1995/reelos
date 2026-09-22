import assert from "node:assert/strict";
import test from "node:test";
import {
  canDispatchProviderRequest,
  canUseProviderStream,
  filterAccessibleLibraryItems,
  libraryItemSourceKind,
  publicSourcePolicy,
  sourcePolicyFromState,
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
  });
  assert.equal(policy.provider, "real-debrid");
  assert.equal(policy.connected, true);
  assert.equal(canDispatchProviderRequest(policy), true);
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
    { id: "provider", path: "/mnt/symlinks/radarr/Batman/movie.mkv" },
    { id: "unknown", path: "" },
  ];
  assert.equal(libraryItemSourceKind(items[2]), "debrid");
  assert.deepEqual(
    filterAccessibleLibraryItems(items, { connected: false }).map((item) => item.id),
    ["personal", "public"],
  );
  assert.deepEqual(
    filterAccessibleLibraryItems(items, { connected: true }).map((item) => item.id),
    ["personal", "public", "provider"],
  );
});
