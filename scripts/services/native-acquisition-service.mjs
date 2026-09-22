import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { atomicWriteJsonSync } from "../utils/fs-atomic.mjs";

export const ACQUISITION_SCHEMA = 1;
export const ACQUISITION_ACTIVE = new Set(["queued", "discovering", "ranking", "resolving", "acquiring", "verifying", "preparing"]);
export const ACQUISITION_TERMINAL = new Set(["ready", "unavailable", "failed", "cancelled", "interrupted"]);

const transitions = Object.freeze({
  queued: new Set(["discovering", "cancelled"]),
  discovering: new Set(["ranking", "unavailable", "failed", "cancelled", "interrupted"]),
  ranking: new Set(["resolving", "unavailable", "failed", "cancelled", "interrupted"]),
  resolving: new Set(["acquiring", "unavailable", "failed", "cancelled", "interrupted"]),
  acquiring: new Set(["verifying", "unavailable", "failed", "cancelled", "interrupted"]),
  verifying: new Set(["preparing", "ready", "failed", "cancelled", "interrupted"]),
  preparing: new Set(["ready", "failed", "cancelled", "interrupted"]),
  interrupted: new Set(["queued", "cancelled"]),
  unavailable: new Set(["queued", "cancelled"]),
  failed: new Set(["queued", "cancelled"]),
  ready: new Set(),
  cancelled: new Set(),
});

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

function fail(message, code = "invalid_acquisition") {
  throw Object.assign(new Error(message), { code });
}

function cleanId(value, label) {
  const id = String(value || "").trim();
  if (!ID.test(id)) fail(`A valid ${label} is required.`);
  return id;
}

function initialState() {
  return { schemaVersion: ACQUISITION_SCHEMA, revision: 0, jobs: {} };
}

function requestKey(input) {
  return [input.profileId, input.workId, input.mediaType, input.season ?? "", input.episode ?? ""].join(":");
}

function boundedError(error) {
  const code = String(error?.code || "acquisition_failed").replace(/[^a-z0-9_:-]/gi, "_").slice(0, 80);
  const message = String(error?.publicMessage || error?.message || "This title could not be prepared.").slice(0, 300);
  return { code, message };
}

export function publicAcquisition(job) {
  const status = job.status === "ready" ? "available"
    : ["acquiring", "verifying", "preparing"].includes(job.status) ? "downloading"
      : ["failed", "unavailable", "interrupted"].includes(job.status) ? "failed"
        : job.status === "cancelled" ? "cancelled" : "waiting";
  return {
    id: job.id,
    workId: job.workId,
    titleId: job.workId,
    title: job.title,
    mediaType: job.mediaType,
    season: job.season,
    episode: job.episode,
    status,
    stage: job.status,
    progress: job.progress,
    percent: job.progress,
    attempts: job.attempts,
    canCancel: ACQUISITION_ACTIVE.has(job.status),
    canRetry: ["failed", "unavailable", "interrupted"].includes(job.status),
    error: job.error,
    reason: job.error?.message || null,
    libraryItemId: job.libraryItemId || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export class NativeAcquisitionService {
  constructor({ stateDir = process.env.REELOS_STATE || path.join(process.cwd(), ".reelos-state"), maxAttempts = 3 } = {}) {
    this.stateDir = path.resolve(stateDir);
    this.file = path.join(this.stateDir, "native-acquisitions.json");
    this.maxAttempts = maxAttempts;
    this.runners = new Map();
  }

  read() {
    if (!fs.existsSync(this.file)) return initialState();
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      fail("Acquisition history needs recovery.", "acquisition_ledger_corrupt");
    }
    if (parsed?.schemaVersion !== ACQUISITION_SCHEMA || !parsed.jobs || typeof parsed.jobs !== "object") {
      fail("Acquisition history uses an unsupported schema.", "acquisition_schema_mismatch");
    }
    return parsed;
  }

  write(state) {
    state.revision += 1;
    atomicWriteJsonSync(this.file, state, { mode: 0o600 });
  }

  create(input) {
    const profileId = cleanId(input?.profileId, "profile id");
    const workId = cleanId(input?.workId || input?.titleId, "work id");
    const mediaType = ["movie", "tv", "episode"].includes(input?.mediaType) ? input.mediaType : "movie";
    const season = input?.season == null ? null : Number(input.season);
    const episode = input?.episode == null ? null : Number(input.episode);
    if (season != null && (!Number.isInteger(season) || season < 0)) fail("The season number is invalid.");
    if (episode != null && (!Number.isInteger(episode) || episode < 0)) fail("The episode number is invalid.");
    const candidate = { profileId, workId, mediaType, season, episode };
    const key = requestKey(candidate);
    const state = this.read();
    const existing = Object.values(state.jobs).find((job) => job.requestKey === key && !["cancelled", "failed", "unavailable"].includes(job.status));
    if (existing) return { job: existing, created: false };
    const now = Date.now();
    const job = {
      id: randomUUID(), requestKey: key, profileId, workId, mediaType, season, episode,
      title: String(input?.title || "Untitled").trim().slice(0, 300),
      year: Number.isInteger(input?.year) ? input.year : null,
      status: "queued", progress: null, attempts: 0, error: null,
      provider: input?.provider ? String(input.provider).trim().toLowerCase() : null,
      createdAt: now, updatedAt: now,
    };
    state.jobs[job.id] = job;
    this.write(state);
    return { job, created: true };
  }

  get(id) {
    return this.read().jobs[cleanId(id, "acquisition id")] || null;
  }

  list({ profileId } = {}) {
    const jobs = Object.values(this.read().jobs);
    return jobs.filter((job) => !profileId || job.profileId === profileId).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  transition(id, next, patch = {}) {
    const state = this.read();
    const job = state.jobs[cleanId(id, "acquisition id")];
    if (!job) fail("The acquisition was not found.", "acquisition_not_found");
    if (!transitions[job.status]?.has(next)) fail(`Cannot move an acquisition from ${job.status} to ${next}.`, "invalid_acquisition_transition");
    Object.assign(job, patch, { status: next, updatedAt: Date.now() });
    if (next === "queued") {
      job.attempts += 1;
      job.error = null;
      job.progress = null;
      if (job.attempts > this.maxAttempts) fail("This acquisition has reached its retry limit.", "acquisition_retry_limit");
    }
    this.write(state);
    return job;
  }

  recoverInterrupted() {
    const state = this.read();
    let count = 0;
    for (const job of Object.values(state.jobs)) {
      if (!ACQUISITION_ACTIVE.has(job.status) || job.status === "queued") continue;
      job.status = "interrupted";
      job.error = { code: "service_restarted", message: "Preparation paused when ReelOS restarted. It can be retried safely." };
      job.updatedAt = Date.now();
      count += 1;
    }
    if (count) this.write(state);
    return count;
  }

  cancel(id) {
    const job = this.get(id);
    if (!job) fail("The acquisition was not found.", "acquisition_not_found");
    if (!ACQUISITION_ACTIVE.has(job.status)) fail("That acquisition can no longer be cancelled.", "acquisition_not_cancellable");
    this.runners.get(job.id)?.abort({ code: "cancelled" });
    return this.transition(job.id, "cancelled", { error: null });
  }

  retry(id) {
    const job = this.get(id);
    if (!job) fail("The acquisition was not found.", "acquisition_not_found");
    if (!["failed", "unavailable", "interrupted"].includes(job.status)) fail("That acquisition is not retryable.", "acquisition_not_retryable");
    return this.transition(job.id, "queued");
  }

  async run(id, adapters) {
    const current = this.get(id);
    if (!current) fail("The acquisition was not found.", "acquisition_not_found");
    if (current.status !== "queued") fail("Only a queued acquisition can start.", "acquisition_not_queued");
    if (this.runners.has(id)) return this.runners.get(id).promise;
    const controller = new AbortController();
    const runner = { abort: (reason) => controller.abort(reason), promise: null };
    runner.promise = this.#execute(id, adapters, controller.signal).finally(() => this.runners.delete(id));
    this.runners.set(id, runner);
    return runner.promise;
  }

  async #execute(id, adapters, signal) {
    const stop = () => { if (signal.aborted) throw Object.assign(new Error("The acquisition was cancelled."), { code: signal.reason?.code || "cancelled" }); };
    try {
      let job = this.transition(id, "discovering", { progress: null });
      stop();
      const candidates = await adapters.discover(job, { signal });
      if (!Array.isArray(candidates) || candidates.length === 0) return this.transition(id, "unavailable", { error: { code: "no_source", message: "No usable source is available yet." } });
      job = this.transition(id, "ranking", { progress: null });
      stop();
      const selected = await adapters.rank(job, candidates, { signal });
      if (!selected) return this.transition(id, "unavailable", { error: { code: "no_eligible_source", message: "No source passed ReelOS safety and compatibility checks." } });
      job = this.transition(id, "resolving", { selectedCandidateId: cleanId(selected.id, "candidate id") });
      stop();
      const provider = await adapters.resolveProvider(job, selected, { signal });
      if (!provider?.adapter || typeof provider.adapter.acquire !== "function") fail("No validated provider can acquire this source.", "provider_unavailable");
      job = this.transition(id, "acquiring", { provider: String(provider.id || "").slice(0, 64), progress: 0 });
      const acquired = await provider.adapter.acquire(selected, { signal, onProgress: (progress) => {
        if (!Number.isFinite(progress)) return;
        const state = this.read();
        if (state.jobs[id]?.status !== "acquiring") return;
        state.jobs[id].progress = Math.max(0, Math.min(100, Math.round(progress)));
        state.jobs[id].updatedAt = Date.now();
        this.write(state);
      } });
      stop();
      job = this.transition(id, "verifying", { progress: null, providerReceipt: acquired?.receipt || null });
      const verify = typeof provider.adapter.waitUntilReady === "function"
        ? provider.adapter.waitUntilReady.bind(provider.adapter)
        : provider.adapter.verify.bind(provider.adapter);
      const verified = await verify(acquired, { signal, onProgress: (progress) => {
        if (!Number.isFinite(progress)) return;
        const state = this.read();
        if (state.jobs[id]?.status !== "verifying") return;
        state.jobs[id].progress = Math.max(0, Math.min(99, Math.round(progress)));
        state.jobs[id].updatedAt = Date.now();
        this.write(state);
      } });
      if (!verified?.source || verified.source.verified !== true) fail("The provider source could not be verified.", "source_unverified");
      let source = verified.source;
      if (typeof adapters.prepare === "function") {
        job = this.transition(id, "preparing");
        source = await adapters.prepare(job, verified.source, { signal });
        if (!source?.verified) fail("The prepared source did not pass validation.", "prepared_source_unverified");
      }
      const item = adapters.registry.register({
        workId: job.workId, editionId: verified.editionId, title: job.title, year: job.year,
        mediaType: job.mediaType, aliases: verified.aliases || [], source,
      });
      return this.transition(id, "ready", { progress: 100, error: null, libraryItemId: item.itemId });
    } catch (error) {
      const latest = this.get(id);
      if (!latest || ACQUISITION_TERMINAL.has(latest.status)) return latest;
      if (signal.aborted || error?.code === "cancelled") return this.transition(id, "cancelled", { error: null });
      return this.transition(id, "failed", { error: boundedError(error), progress: null });
    }
  }
}
