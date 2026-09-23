import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MIN_TIMEOUT_MS = 25;
const SECRET_KEY = /(?:^|_)(?:api[_-]?key|authorization|bearer|cookie|credential|magnet|password|private[_-]?key|secret|session|token)(?:$|_)/i;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

export const CAPABILITY_SPECIALISTS = Object.freeze({
  "taste-ranking": Object.freeze({ specialist: "personal-taste-ranker", task: "ranking", runtimes: Object.freeze(["onnxruntime", "llama.cpp"]), privacy: Object.freeze(["profile_private", "household_private"]) }),
  "semantic-search": Object.freeze({ specialist: "semantic-catalog-retriever", task: "embedding-and-reranking", runtimes: Object.freeze(["onnxruntime", "llama.cpp"]), privacy: Object.freeze(["profile_private", "household_private"]) }),
  "scene-understanding": Object.freeze({ specialist: "scene-context-analyzer", task: "multimodal-analysis", runtimes: Object.freeze(["onnxruntime", "llama.cpp"]), privacy: Object.freeze(["profile_private", "household_private"]) }),
  "family-scene-guidance": Object.freeze({ specialist: "family-guidance-candidate", task: "advisory-classification", runtimes: Object.freeze(["onnxruntime", "llama.cpp"]), privacy: Object.freeze(["household_private"]) }),
  "dialogue-enhancement": Object.freeze({ specialist: "dialogue-separation-planner", task: "audio-analysis", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "predictive-preparation": Object.freeze({ specialist: "household-preparation-predictor", task: "forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "storage-optimization": Object.freeze({ specialist: "storage-value-forecaster", task: "forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "machine-protection": Object.freeze({ specialist: "machine-pressure-predictor", task: "telemetry-forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "interface-protection": Object.freeze({ specialist: "interaction-health-monitor", task: "latency-forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "shared-taste-intelligence": Object.freeze({ specialist: "anonymous-taste-sketch", task: "privacy-preserving-aggregation", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private", "export_candidate"]) }),
  "release-ranking": Object.freeze({ specialist: "source-release-ranker", task: "ranking", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "distributed-workload-scheduler": Object.freeze({ specialist: "cluster-rhythm-predictor", task: "scheduling-forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "in-flight-media-distillation": Object.freeze({ specialist: "frame-feature-distiller", task: "multimodal-analysis", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "ambient-presence-governor": Object.freeze({ specialist: "viewing-engagement-classifier", task: "advisory-classification", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
  "predictive-cache-oracle": Object.freeze({ specialist: "cache-horizon-ranker", task: "forecasting", runtimes: Object.freeze(["onnxruntime"]), privacy: Object.freeze(["household_private"]) }),
});

function boundedJson(value, maximum, code) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { fail(code, "Local inference data must be JSON serializable."); }
  if (encoded === undefined || Buffer.byteLength(encoded) > maximum) fail(code, "Local inference data exceeds its boundary.");
  return encoded;
}

function rejectSecrets(value, depth = 0) {
  if (depth > 24) fail("inference_privacy_boundary", "Local inference input is too deeply nested.");
  if (Array.isArray(value)) {
    for (const entry of value) rejectSecrets(entry, depth + 1);
    return;
  }
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) fail("inference_privacy_boundary", "Credentials and source secrets cannot enter a model.");
    rejectSecrets(entry, depth + 1);
  }
}

function assertAdapter(adapter, runtimeId) {
  if (!object(adapter) || adapter.runtimeId !== runtimeId || adapter.localOnly !== true
    || adapter.networkIsolation !== "os-enforced" || typeof adapter.eligible !== "function"
    || typeof adapter.execute !== "function") {
    fail("model_runtime_untrusted", "The model runtime has not proved local execution and network isolation.");
  }
}

function frozenStatus(status) {
  return Object.freeze({ ...status, reasons: Object.freeze([...(status.reasons || [])]) });
}

export class LocalModelExecutor {
  constructor({ registry, adapters = [], now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    if (!registry || typeof registry.getArtifact !== "function" || typeof registry.getActive !== "function") {
      fail("model_executor_configuration_invalid", "A verified artifact registry is required.");
    }
    this.registry = registry;
    this.adapters = new Map();
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    for (const adapter of adapters) {
      if (!object(adapter) || typeof adapter.runtimeId !== "string" || !ID.test(adapter.runtimeId)) {
        fail("model_executor_configuration_invalid", "A runtime adapter ID is invalid.");
      }
      if (this.adapters.has(adapter.runtimeId)) fail("model_executor_configuration_invalid", "Runtime adapter IDs must be unique.");
      this.adapters.set(adapter.runtimeId, adapter);
    }
    const callable = this.execute.bind(this);
    callable.eligibility = this.eligibility.bind(this);
    callable.status = this.status.bind(this);
    callable.executor = this;
    return callable;
  }

  loadModelSet(capabilityId, modelSet = this.registry.getActive(capabilityId)) {
    if (!CAPABILITY_SPECIALISTS[capabilityId]) fail("model_capability_unknown", "No specialist route exists for this capability.");
    if (!modelSet || modelSet.capabilityId !== capabilityId || !Array.isArray(modelSet.artifactIds) || modelSet.artifactIds.length === 0) {
      fail("model_set_unavailable", "No verified, evaluated model set is active.");
    }
    const artifacts = modelSet.artifactIds.map((id) => this.registry.getArtifact(id));
    if (artifacts.some((record) => !record || record.status !== "verified" || record.manifest?.capabilityId !== capabilityId)) {
      fail("model_set_unverified", "The active model set is no longer fully verified.");
    }
    const runtimeIds = new Set(artifacts.map((record) => record.manifest.runtime));
    if (runtimeIds.size !== 1) fail("model_runtime_mixed", "A specialist model set must use one local runtime.");
    const runtimeId = [...runtimeIds][0];
    const route = CAPABILITY_SPECIALISTS[capabilityId];
    if (!route.runtimes.includes(runtimeId)) fail("model_runtime_unsupported", "This runtime is not approved for the specialist.");
    return Object.freeze({ capabilityId, modelSetId: modelSet.modelSetId, runtimeId,
      route, artifacts: Object.freeze([...artifacts]) });
  }

  eligibility(capabilityId, modelSet = this.registry.getActive(capabilityId)) {
    const route = CAPABILITY_SPECIALISTS[capabilityId];
    if (!route) return frozenStatus({ eligible: false, capabilityId, specialist: null, runtimeId: null, reasons: ["specialist_route_missing"] });
    let loaded;
    try { loaded = this.loadModelSet(capabilityId, modelSet); }
    catch (error) {
      return frozenStatus({ eligible: false, capabilityId, specialist: route.specialist, runtimeId: null,
        reasons: [error.code || "model_set_unavailable"] });
    }
    const adapter = this.adapters.get(loaded.runtimeId);
    if (!adapter) return frozenStatus({ eligible: false, capabilityId, specialist: route.specialist,
      runtimeId: loaded.runtimeId, modelSetId: loaded.modelSetId, reasons: ["model_runtime_unavailable"] });
    try { assertAdapter(adapter, loaded.runtimeId); }
    catch (error) { return frozenStatus({ eligible: false, capabilityId, specialist: route.specialist,
      runtimeId: loaded.runtimeId, modelSetId: loaded.modelSetId, reasons: [error.code] }); }
    let adapterStatus;
    try { adapterStatus = adapter.eligible({ capabilityId, artifacts: loaded.artifacts, route }); }
    catch { adapterStatus = { eligible: false, reason: "model_runtime_probe_failed" }; }
    if (adapterStatus?.eligible !== true) return frozenStatus({ eligible: false, capabilityId,
      specialist: route.specialist, runtimeId: loaded.runtimeId, modelSetId: loaded.modelSetId,
      reasons: [adapterStatus?.reason || "model_runtime_ineligible"] });
    return frozenStatus({ eligible: true, capabilityId, specialist: route.specialist,
      runtimeId: loaded.runtimeId, modelSetId: loaded.modelSetId, reasons: [] });
  }

  status(capabilityId) {
    const eligibility = this.eligibility(capabilityId);
    return Object.freeze({ ...eligibility, route: CAPABILITY_SPECIALISTS[capabilityId] || null,
      checkedAt: this.now() });
  }

  async execute({ request, modelSet, lease = null } = {}) {
    if (!object(request) || typeof request.capabilityId !== "string") fail("model_request_invalid", "A validated inference request is required.");
    const loaded = this.loadModelSet(request.capabilityId, modelSet);
    const status = this.eligibility(request.capabilityId, modelSet);
    if (!status.eligible) fail(status.reasons[0], "The local specialist is not eligible on this machine.");
    if (!loaded.route.privacy.includes(request.privacyClass)) fail("inference_privacy_boundary", "This specialist cannot receive that privacy class.");
    rejectSecrets(request.input);
    const adapter = this.adapters.get(loaded.runtimeId);
    const safeRequest = Object.freeze({
      requestId: request.requestId, capabilityId: request.capabilityId,
      featureSnapshotId: request.featureSnapshotId, qualityFloor: request.qualityFloor,
      privacyClass: request.privacyClass, input: structuredClone(request.input),
      ...(request.media ? { media: Object.freeze({ ...request.media }) } : {}),
    });
    boundedJson(safeRequest, MAX_INPUT_BYTES, "model_input_too_large");

    const controller = new AbortController();
    let abortCode = "model_execution_cancelled";
    const abort = (reason) => {
      if (controller.signal.aborted) return;
      abortCode = reason;
      controller.abort(Object.assign(new Error("Local model execution was stopped."), { code: reason }));
    };
    const leaseAbort = () => abort(lease?.signal?.reason?.code || "resource_lease_cancelled");
    lease?.signal?.addEventListener?.("abort", leaseAbort, { once: true });
    const unsubscribe = lease?.subscribe?.((event) => {
      if (event.type === "yield" || event.type === "cancel") abort(event.type === "yield" ? "resource_yielded" : "resource_lease_cancelled");
    });
    const timeoutMs = Math.max(MIN_TIMEOUT_MS, request.deadlineMs);
    const timer = this.setTimer(() => abort("model_execution_timeout"), timeoutMs);
    timer?.unref?.();
    let heartbeat = null;
    const heartbeatEveryMs = Math.max(10, Math.min(10_000, Math.floor(timeoutMs / 2)));
    const scheduleHeartbeat = () => {
      if (!lease?.heartbeat || controller.signal.aborted) return;
      heartbeat = this.setTimer(() => {
        const renewed = lease.heartbeat();
        if (renewed?.ok === false) abort(renewed.code || "resource_lease_expired");
        else scheduleHeartbeat();
      }, heartbeatEveryMs);
      heartbeat?.unref?.();
    };
    scheduleHeartbeat();
    try {
      const result = await Promise.race([
        adapter.execute({ request: safeRequest, artifacts: loaded.artifacts, route: loaded.route,
          signal: controller.signal, maxOutputBytes: MAX_OUTPUT_BYTES }),
        new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true })),
      ]);
      if (controller.signal.aborted) fail(abortCode, "Local model execution exceeded its boundary.");
      boundedJson(result, MAX_OUTPUT_BYTES, "model_output_too_large");
      if (!object(result)) fail("model_output_invalid", "The local runtime returned an invalid result.");
      return result;
    } catch (error) {
      if (controller.signal.aborted) fail(abortCode, "Local model execution exceeded its boundary.");
      throw error;
    } finally {
      this.clearTimer(timer);
      if (heartbeat) this.clearTimer(heartbeat);
      unsubscribe?.();
      lease?.signal?.removeEventListener?.("abort", leaseAbort);
    }
  }
}

export function createLocalModelExecutor(options) {
  return new LocalModelExecutor(options);
}

export function createJsonLineProcessAdapter({ runtimeId, executable, args = [], cwd,
  networkIsolation = "unverified", environment = {} } = {}) {
  if (typeof runtimeId !== "string" || !ID.test(runtimeId) || typeof executable !== "string" || !path.isAbsolute(executable)
    || !Array.isArray(args) || args.length > 64 || args.some((arg) => typeof arg !== "string" || arg.length > 4096)
    || typeof cwd !== "string" || !path.isAbsolute(cwd) || !object(environment)
    || Object.entries(environment).some(([key, value]) => !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
      || typeof value !== "string" || value.length > 8192 || SECRET_KEY.test(key))) {
    fail("model_runtime_configuration_invalid", "The process runtime configuration is invalid.");
  }
  const probe = () => {
    try {
      const stat = fs.lstatSync(executable);
      const work = fs.lstatSync(cwd);
      return stat.isFile() && !stat.isSymbolicLink() && work.isDirectory() && !work.isSymbolicLink();
    } catch { return false; }
  };
  return Object.freeze({
    runtimeId, localOnly: true, networkIsolation,
    eligible: () => ({ eligible: networkIsolation === "os-enforced" && probe(),
      reason: networkIsolation !== "os-enforced" ? "runtime_network_isolation_unverified" : "runtime_executable_unavailable" }),
    execute: ({ request, artifacts, signal, maxOutputBytes }) => new Promise((resolve, reject) => {
      if (!probe()) return reject(Object.assign(new Error("The local runtime is unavailable."), { code: "model_runtime_unavailable" }));
      const payload = boundedJson({ schemaVersion: 1, request,
        artifacts: artifacts.map(({ artifactPath, manifest }) => ({ artifactPath, artifactId: manifest.artifactId,
          inputSchema: manifest.inputSchema, outputSchema: manifest.outputSchema })) }, MAX_INPUT_BYTES, "model_input_too_large");
      const child = spawn(executable, args, { cwd, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
        env: { ...(process.platform === "win32" && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...environment } });
      let stdout = Buffer.alloc(0);
      let stderrBytes = 0;
      let settled = false;
      const finish = (callback, value) => { if (!settled) { settled = true; callback(value); } };
      const stop = () => child.kill("SIGKILL");
      signal.addEventListener("abort", stop, { once: true });
      child.stdout.on("data", (chunk) => {
        stdout = Buffer.concat([stdout, chunk]);
        if (stdout.length > maxOutputBytes) { stop(); finish(reject, Object.assign(new Error("Model output exceeded its boundary."), { code: "model_output_too_large" })); }
      });
      child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; if (stderrBytes > 64 * 1024) stop(); });
      child.on("error", (error) => finish(reject, Object.assign(new Error("The local runtime could not start."), { code: "model_runtime_start_failed", cause: error })));
      child.on("close", (code) => {
        signal.removeEventListener("abort", stop);
        if (settled) return;
        if (signal.aborted) return finish(reject, signal.reason);
        if (code !== 0 || stderrBytes > 64 * 1024) return finish(reject, Object.assign(new Error("The local runtime failed."), { code: "model_runtime_failed" }));
        try { finish(resolve, JSON.parse(stdout.toString("utf8"))); }
        catch (error) { finish(reject, Object.assign(new Error("The local runtime returned invalid JSON."), { code: "model_output_invalid", cause: error })); }
      });
      child.stdin.end(`${payload}\n`);
    }),
  });
}
