import fs from "node:fs";
import path from "node:path";
import { getRequestProfileAuthorization } from "./profile-service.mjs";
import { readProviderValidation, sourcePolicyFromState } from "./source-access-policy.mjs";
import { loadOwnerIndexerPresets } from "./neural-indexer-repair.mjs";
import { searchAndScoreReleases } from "../reelflow/search.mjs";
import { NativeAcquisitionService, publicAcquisition } from "./native-acquisition-service.mjs";
import { NativeMediaRegistry } from "./native-media-registry.mjs";
import { TorBoxProviderAdapter } from "./torbox-provider-adapter.mjs";
import { getReelIntelligenceSystem } from "./reel-intelligence-system.mjs";
import { ensureBuiltinPublicCinema } from "./native-library-bootstrap.mjs";

const MAX_BODY = 64 * 1024;
const retiredPrefixes = ["/api/fleet", "/api/gossip", "/api/neural", "/api/lighthouse", "/api/provision"];
const systems = new Map();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
  res.end(JSON.stringify(body));
  return true;
}

async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > MAX_BODY) throw Object.assign(new Error("Request is too large."), { status: 413, code: "request_too_large" });
  }
  try { return JSON.parse(text || "{}"); }
  catch { throw Object.assign(new Error("Request must be valid JSON."), { status: 400, code: "invalid_json" }); }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}

async function context() {
  const stateDir = path.resolve(process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos"));
  let value = systems.get(stateDir);
  if (!value) {
    value = {
      stateDir,
      acquisitions: new NativeAcquisitionService({ stateDir }),
      registry: new NativeMediaRegistry({ stateDir }),
      intelligence: await getReelIntelligenceSystem({ stateDir }),
    };
    value.acquisitions.recoverInterrupted();
    ensureBuiltinPublicCinema(value.registry);
    systems.set(stateDir, value);
  }
  return value;
}

function auth(req, stateDir) {
  const profilesDir = process.env.REELOS_PROFILES_DIR || path.join(stateDir, "profiles");
  return getRequestProfileAuthorization(req, profilesDir);
}

function sourcePolicy(stateDir) {
  return sourcePolicyFromState({
    answers: readJson(path.join(stateDir, "answers.json")),
    uiSettings: readJson(path.join(stateDir, "ui-settings.json")),
    env: process.env,
    validation: readProviderValidation(stateDir),
  });
}

function sourceSettings(stateDir) {
  const settings = readJson(path.join(stateDir, "ui-settings.json"));
  return {
    enabledIndexerIds: Array.isArray(settings.enabledIndexerIds) ? settings.enabledIndexerIds.map(String) : [],
    qualityFloor: String(settings.qualityFloor || "1080p"),
    preferHdr: settings.preferHdr !== false,
    preferRemux: settings.preferRemux === true,
  };
}

function requireAuth(req, res, stateDir, { owner = false } = {}) {
  const identity = auth(req, stateDir);
  if (!identity.authenticated || !identity.deviceAuthorized) {
    send(res, 401, { ok: false, code: "PROFILE_REQUIRED", error: "Open an authorized profile first." });
    return null;
  }
  if (owner && identity.role !== "owner") {
    send(res, 403, { ok: false, code: "OWNER_REQUIRED", error: "Only the home owner can change this." });
    return null;
  }
  return identity;
}

function requestCapabilityValidation(ledger, record) {
  if (record.state === "validating") return record;
  let current = record;
  if (["active", "learning_locally"].includes(current.state)) {
    current = ledger.transition(current.id, "paused", { authority: "runtime", reason: "Paused for owner-requested validation." });
  }
  return ledger.transition(current.id, "validating", {
    authority: "runtime",
    reason: "Local validation requested by the home owner.",
  });
}

async function launchAcquisition(ctx, job) {
  const policy = sourcePolicy(ctx.stateDir);
  const settings = sourceSettings(ctx.stateDir);
  const roster = loadOwnerIndexerPresets();
  return ctx.acquisitions.run(job.id, {
    discover: (current, { signal }) => searchAndScoreReleases({
      title: current.title, year: current.year, season: current.season, episode: current.episode,
    }, {
      fetchImpl: (url, options = {}) => fetch(url, { ...options, signal: options.signal || signal }),
      provider: policy.provider, apiKey: policy.connected ? policy.apiKey : "", accountScope: policy.accountScope,
      enabledIndexerIds: settings.enabledIndexerIds, indexerRoster: roster,
      qualityFloor: settings.qualityFloor, preferHdr: settings.preferHdr,
      preferRemux: settings.preferRemux, providerSearch: false,
    }).then((rows) => rows.map((candidate) => ({ ...candidate, id: candidate.infoHash,
      hash: candidate.infoHash,
      magnet: candidate.magnet || `magnet:?xt=urn:btih:${candidate.infoHash}&dn=${encodeURIComponent(candidate.title || current.title)}` }))),
    rank: async (_current, candidates) => candidates[0] || null,
    resolveProvider: async () => {
      const current = sourcePolicy(ctx.stateDir);
      if (!current.connected || current.provider !== "torbox" || current.accountScope !== policy.accountScope) return null;
      return { id: "torbox", adapter: new TorBoxProviderAdapter({ apiKey: current.apiKey, accountScope: current.accountScope }) };
    },
    registry: ctx.registry,
  });
}

export async function handleNativeControlPlaneRoute(req, res, options = {}) {
  const url = new URL(req.url || "/", "http://reelos.local");
  const pathname = url.pathname;
  const relevant = pathname === "/api/request" || pathname.startsWith("/api/request/")
    || pathname === "/api/library" || pathname === "/api/capabilities"
    || pathname.startsWith("/api/capabilities/") || pathname === "/api/resources"
    || retiredPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!relevant) return false;
  if (retiredPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return send(res, 410, { ok: false, code: "LEGACY_INTELLIGENCE_RETIRED",
      error: "This prototype endpoint was retired. ReelOS now uses its private capability system." });
  }
  try {
    const ctx = options.context || await context();
    const method = (req.method || "GET").toUpperCase();
    const identity = requireAuth(req, res, ctx.stateDir, {
      owner: method !== "GET" && (pathname.startsWith("/api/capabilities/") || pathname === "/api/resources"),
    });
    if (!identity) return true;

    if (pathname === "/api/capabilities" && method === "GET") {
      return send(res, 200, { ok: true, capabilities: ctx.intelligence.capabilityLedger.list(),
        resources: ctx.intelligence.governor.snapshot() });
    }
    const capabilityMatch = pathname.match(/^\/api\/capabilities\/([^/]+)\/(disable|revalidate)$/);
    if (capabilityMatch && method === "POST") {
      const id = decodeURIComponent(capabilityMatch[1]);
      const record = ctx.intelligence.capabilityLedger.get(id);
      if (!record) return send(res, 404, { ok: false, code: "CAPABILITY_NOT_FOUND", error: "That capability is not installed." });
      const disabling = capabilityMatch[2] === "disable";
      const changed = disabling
        ? (record.state === "disabled" ? record : ctx.intelligence.capabilityLedger.transition(id, "disabled", { authority: "user", reason: "Disabled by the home owner." }))
        : requestCapabilityValidation(ctx.intelligence.capabilityLedger, record);
      return send(res, 200, { ok: true, capability: changed });
    }
    if (pathname === "/api/resources" && method === "GET") {
      return send(res, 200, { ok: true, resources: ctx.intelligence.governor.snapshot(), storage: ctx.intelligence.storage.snapshot() });
    }
    if (pathname === "/api/library" && method === "GET") {
      const policy = sourcePolicy(ctx.stateDir);
      const titles = ctx.registry.list().map((item) => ctx.registry.publicProjection(item, {
        canAccessProvider: (provider) => policy.connected && provider === policy.provider,
      })).filter((item) => item?.ready);
      return send(res, 200, { ok: true, engine: "native", titles });
    }
    if (pathname === "/api/request" && method === "GET") {
      const requested = url.searchParams.get("id");
      const jobs = ctx.acquisitions.list({ profileId: identity.profileId });
      if (requested) {
        const job = jobs.find((entry) => entry.id === requested || entry.workId === requested);
        return job ? send(res, 200, { ok: true, engine: "native", ...publicAcquisition(job), request: publicAcquisition(job) })
          : send(res, 404, { ok: false, code: "REQUEST_NOT_FOUND", error: "No request exists for this title." });
      }
      return send(res, 200, { ok: true, engine: "native", requests: jobs.map(publicAcquisition) });
    }
    if (pathname === "/api/request" && method === "POST") {
      const input = await body(req);
      const policy = sourcePolicy(ctx.stateDir);
      if (!policy.connected || policy.provider !== "torbox") {
        return send(res, 409, { ok: false, code: "SOURCE_UNAVAILABLE", error: "Connect and validate TorBox before requesting this title." });
      }
      const created = ctx.acquisitions.create({
        profileId: identity.profileId, workId: input.id || input.titleId,
        title: input.title, year: input.year, mediaType: input.mediaType,
        season: input.season, episode: input.episode, provider: "torbox",
      });
      if (created.job.status === "queued") void launchAcquisition(ctx, created.job);
      return send(res, created.created ? 202 : 200, { ok: true, engine: "native", ...publicAcquisition(created.job), request: publicAcquisition(created.job) });
    }
    if (pathname === "/api/request" && method === "DELETE") {
      const input = await body(req);
      const jobs = ctx.acquisitions.list({ profileId: identity.profileId });
      const job = jobs.find((entry) => entry.id === input.id || entry.workId === input.titleId);
      if (!job) return send(res, 404, { ok: false, code: "REQUEST_NOT_FOUND", error: "That request was not found." });
      if (!["queued", "discovering", "ranking", "resolving", "acquiring", "verifying", "preparing"].includes(job.status)) {
        return send(res, 409, { ok: false, code: "REQUEST_NOT_CANCELLABLE", error: "That request can no longer be cancelled." });
      }
      const changed = ctx.acquisitions.cancel(job.id);
      return send(res, 200, { ok: true, engine: "native", ...publicAcquisition(changed), request: publicAcquisition(changed) });
    }
    const requestMatch = pathname.match(/^\/api\/request\/([^/]+)\/(retry|cancel)$/);
    if (requestMatch && method === "POST") {
      const job = ctx.acquisitions.get(decodeURIComponent(requestMatch[1]));
      if (!job || job.profileId !== identity.profileId) return send(res, 404, { ok: false, code: "REQUEST_NOT_FOUND", error: "That request was not found." });
      const changed = requestMatch[2] === "retry" ? ctx.acquisitions.retry(job.id) : ctx.acquisitions.cancel(job.id);
      if (changed.status === "queued") void launchAcquisition(ctx, changed);
      return send(res, 200, { ok: true, engine: "native", ...publicAcquisition(changed), request: publicAcquisition(changed) });
    }
    return send(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "That action is not supported." });
  } catch (error) {
    return send(res, Number(error.status) || 500, { ok: false, code: String(error.code || "NATIVE_CONTROL_PLANE_ERROR"),
      error: Number(error.status) && Number(error.status) < 500 ? error.message : "ReelOS could not safely complete that action." });
  }
}
