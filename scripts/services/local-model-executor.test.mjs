import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_SPECIALISTS, createLocalModelExecutor,
  createJsonLineProcessAdapter } from "./local-model-executor.mjs";
import { REEL_INTELLIGENCE_CAPABILITIES } from "./reel-intelligence-system.mjs";

function fixture({ capabilityId = "taste-ranking", runtime = "onnxruntime", adapter = true } = {}) {
  const manifest = { artifactId: `${capabilityId}-artifact`, capabilityId, runtime,
    inputSchema: `${capabilityId}-input-v1`, outputSchema: `${capabilityId}-output-v1`,
    resourceProfile: { ramBytes: 1024 } };
  const record = { status: "verified", artifactPath: "C:\\verified-model.bin", manifest };
  const active = { capabilityId, modelSetId: `${capabilityId}-set`, artifactIds: [manifest.artifactId] };
  const registry = {
    getActive: (id) => id === capabilityId ? active : null,
    getArtifact: (id) => id === manifest.artifactId ? record : null,
  };
  const calls = [];
  const runtimeAdapter = {
    runtimeId: runtime, localOnly: true, networkIsolation: "os-enforced",
    eligible: () => ({ eligible: true }),
    execute: async (context) => {
      calls.push(context);
      return { result: ["two", "one"], confidence: 0.8, uncertainty: 0.2, evidenceRefs: ["feature-1"] };
    },
  };
  return { registry, active, record, calls, runtimeAdapter,
    executor: createLocalModelExecutor({ registry, adapters: adapter ? [runtimeAdapter] : [] }) };
}

function request(overrides = {}) {
  return { requestId: "request-1", capabilityId: "taste-ranking", profileScope: "private-profile-id",
    featureSnapshotId: "snapshot-1", deadlineMs: 250, qualityFloor: "baseline",
    resourceClass: "interactive", privacyClass: "profile_private", shadowAllowed: true,
    input: { candidates: ["one", "two"] }, ...overrides };
}

test("all registered intelligence capabilities have explicit specialist routes", () => {
  assert.equal(Object.keys(CAPABILITY_SPECIALISTS).length, 11);
  assert.deepEqual(Object.keys(CAPABILITY_SPECIALISTS).sort(),
    REEL_INTELLIGENCE_CAPABILITIES.map(([id]) => id).sort());
  for (const route of Object.values(CAPABILITY_SPECIALISTS)) {
    assert.match(route.specialist, /^[a-z0-9-]+$/);
    assert.ok(route.runtimes.length > 0);
    assert.ok(route.privacy.length > 0);
  }
});

test("eligibility is honest when artifacts, runtimes, or isolation are absent", () => {
  const absent = fixture({ adapter: false });
  assert.deepEqual(absent.executor.eligibility("taste-ranking").reasons, ["model_runtime_unavailable"]);
  assert.equal(absent.executor.status("taste-ranking").eligible, false);
  assert.deepEqual(absent.executor.eligibility("semantic-search").reasons, ["model_set_unavailable"]);

  const unsafeAdapter = { ...absent.runtimeAdapter, networkIsolation: "unverified" };
  const unsafe = createLocalModelExecutor({ registry: absent.registry, adapters: [unsafeAdapter] });
  assert.deepEqual(unsafe.eligibility("taste-ranking").reasons, ["model_runtime_untrusted"]);
});

test("executor loads only registered verified artifacts and sends minimized local context", async () => {
  const fx = fixture();
  const result = await fx.executor({ request: request(), modelSet: fx.active });
  assert.deepEqual(result.result, ["two", "one"]);
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.calls[0].artifacts[0], fx.record);
  assert.equal(fx.calls[0].request.profileScope, undefined);
  assert.equal(fx.calls[0].request.shadowAllowed, undefined);
  assert.deepEqual(fx.calls[0].request.input, { candidates: ["one", "two"] });

  fx.record.status = "missing";
  await assert.rejects(() => fx.executor({ request: request(), modelSet: fx.active }), { code: "model_set_unverified" });
});

test("privacy boundary rejects credentials and disallowed specialist scopes", async () => {
  const fx = fixture();
  await assert.rejects(() => fx.executor({ request: request({ input: { apiKey: "never" } }), modelSet: fx.active }),
    { code: "inference_privacy_boundary" });

  const family = fixture({ capabilityId: "family-scene-guidance" });
  await assert.rejects(() => family.executor({ request: request({ capabilityId: "family-scene-guidance" }), modelSet: family.active }),
    { code: "inference_privacy_boundary" });
});

test("executor rejects export candidates before any adapter call while Home requests retain model gates", async () => {
  const fx = fixture({ capabilityId: "shared-taste-intelligence" });
  assert.deepEqual(CAPABILITY_SPECIALISTS["shared-taste-intelligence"].privacy, ["household_private"]);
  let probes = 0;
  fx.runtimeAdapter.eligible = () => { probes++; return { eligible: true }; };
  const sharedRequest = request({ capabilityId: "shared-taste-intelligence", privacyClass: "export_candidate" });
  await assert.rejects(() => fx.executor({ request: sharedRequest, modelSet: fx.active }),
    { code: "inference_privacy_boundary" });
  assert.equal(probes, 0);
  assert.equal(fx.calls.length, 0);

  const other = fixture();
  let otherProbes = 0;
  other.runtimeAdapter.eligible = () => { otherProbes++; return { eligible: true }; };
  await assert.rejects(() => other.executor({ request: request({ privacyClass: "export_candidate" }), modelSet: other.active }),
    { code: "inference_privacy_boundary" });
  assert.equal(otherProbes, 0);
  assert.equal(other.calls.length, 0);

  const withinHome = await fx.executor({ request: { ...sharedRequest, privacyClass: "household_private" }, modelSet: fx.active });
  assert.deepEqual(withinHome.result, ["two", "one"]);
  assert.equal(probes, 1);
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.calls[0].request.privacyClass, "household_private");

  const inactive = createLocalModelExecutor({ registry: { getActive: () => null, getArtifact: () => null },
    adapters: [fx.runtimeAdapter] });
  assert.deepEqual(inactive.eligibility("shared-taste-intelligence").reasons, ["model_set_unavailable"]);
  await assert.rejects(() => inactive({ request: { ...sharedRequest, privacyClass: "household_private" } }),
    { code: "model_set_unavailable" });
  assert.equal(probes, 1);
});

test("deadline and resource yield abort model work instead of publishing late output", async () => {
  const timeoutFx = fixture();
  timeoutFx.runtimeAdapter.execute = () => new Promise(() => {});
  await assert.rejects(() => timeoutFx.executor({ request: request({ deadlineMs: 25 }), modelSet: timeoutFx.active }),
    { code: "model_execution_timeout" });

  const yieldFx = fixture();
  yieldFx.runtimeAdapter.execute = () => new Promise(() => {});
  let listener;
  const lease = { signal: new AbortController().signal, heartbeat: () => ({ ok: true }),
    subscribe: (value) => { listener = value; return () => { listener = null; }; } };
  const pending = yieldFx.executor({ request: request(), modelSet: yieldFx.active, lease });
  listener({ type: "yield", reason: "playback_active" });
  await assert.rejects(() => pending, { code: "resource_yielded" });
});

test("process adapter is fail-closed without OS-enforced network isolation", () => {
  const adapter = createJsonLineProcessAdapter({ runtimeId: "onnxruntime",
    executable: process.execPath, args: [], cwd: process.cwd(), networkIsolation: "unverified" });
  assert.deepEqual(adapter.eligible(), { eligible: false, reason: "runtime_network_isolation_unverified" });
});
