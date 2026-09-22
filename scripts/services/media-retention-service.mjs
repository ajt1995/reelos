import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { isValidProfileId, safeWriteFileSync } from "./profile-service.mjs";
import { isSameOriginProfileMutation } from "./profile-session-service.mjs";
import {
  authorizePlaybackItem, playbackIdentity, playbackItemId, playbackStateDir,
  readPlaybackLibraryItems, verifiedPlaybackFile,
} from "./playback-access-service.mjs";

const ORIGINAL_SOURCES = new Set(["personal_import", "public_domain"]);
const MAX_LEDGER_BYTES = 8 * 1024 * 1024;
const validId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)
  && !["constructor", "prototype"].includes(value);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const unavailable = () => fail(503, "retention_unavailable", "Keeping this local original is not currently available.");
const requireIdentity = (req, options) => {
  const result = playbackIdentity(req, options);
  if (!result.ok) fail(result.status, result.code, result.error);
  return result;
};

export function resolveVerifiedLocalOriginal(req, id, options) {
  const matches = readPlaybackLibraryItems(options).filter((item) => item && (item.id === id || playbackItemId(item) === id));
  if (matches.length !== 1) unavailable();
  const item = matches[0];
  if (!validId(item.id)) unavailable();
  const sourceKind = item.sourceKind || item.source?.kind;
  if (!ORIGINAL_SOURCES.has(sourceKind) || (item.sourceKind && item.source?.kind && item.sourceKind !== item.source.kind)) unavailable();
  const kinds = [item.type, item.Type, item.kind].filter(Boolean).map((kind) => String(kind).toLowerCase());
  const episode = [item.type, item.Type].some((kind) => String(kind || "").toLowerCase() === "episode");
  if ((!episode && (kinds.some((kind) => !["movie", "video"].includes(kind)) || item.seasons !== undefined))
    || (episode && kinds.some((kind) => !["episode", "tv", "show", "series"].includes(kind)))) unavailable();
  const candidate = item.path || item.Path;
  if (typeof candidate !== "string" || !path.isAbsolute(candidate)
    || /^[/\\]{2}/.test(candidate)
    || /[/\\](?:debrid|symlinks|projections)[/\\]/i.test(candidate)) unavailable();
  const authorized = authorizePlaybackItem(req, item, options);
  if (!authorized.ok) fail(authorized.status, authorized.code, authorized.error);
  if (!verifiedPlaybackFile(item)) unavailable();
  try {
    // Reject both a symlinked leaf and symlink/junction ancestors. A link to a
    // regular original is still a projection, not ownership of original bytes.
    let cursor = path.resolve(candidate);
    while (true) {
      if (fs.lstatSync(cursor).isSymbolicLink()) unavailable();
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    const canonicalPath = fs.realpathSync(candidate);
    if (/^[/\\]{2}/.test(canonicalPath)) unavailable();
    const stat = fs.lstatSync(canonicalPath, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink()) unavailable();
    return {
      titleId: item.id, playbackId: playbackItemId(item), sourceKind,
      file: { path: canonicalPath, dev: String(stat.dev), ino: String(stat.ino), size: String(stat.size),
        mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) },
    };
  } catch (error) {
    if (error.status) throw error;
    unavailable();
  }
}

function validFileIdentity(value) {
  return exactKeys(value, ["path", "dev", "ino", "size", "mtimeNs", "ctimeNs"])
    && typeof value.path === "string" && path.isAbsolute(value.path)
    && ["dev", "ino", "size"].every((key) => typeof value[key] === "string" && /^\d+$/.test(value[key]))
    && ["mtimeNs", "ctimeNs"].every((key) => typeof value[key] === "string" && /^-?\d+$/.test(value[key]));
}

function readLedger(file) {
  let parsed;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_LEDGER_BYTES) unavailable();
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, entries: {} };
    unavailable();
  }
  if (!exactKeys(parsed, ["schemaVersion", "entries"]) || parsed.schemaVersion !== 1 || !object(parsed.entries)) unavailable();
  for (const [titleId, entry] of Object.entries(parsed.entries)) {
    if (!validId(titleId) || !exactKeys(entry, ["titleId", "playbackId", "sourceKind", "file", "pins"])
      || entry.titleId !== titleId || !validId(entry.playbackId) || !ORIGINAL_SOURCES.has(entry.sourceKind)
      || !validFileIdentity(entry.file) || !object(entry.pins)
      || Object.entries(entry.pins).some(([profileId, pin]) => !isValidProfileId(profileId)
        || !exactKeys(pin, ["keptAt"]) || !Number.isFinite(pin.keptAt) || pin.keptAt < 0)) unavailable();
  }
  return parsed;
}

function assertOriginalUnchanged(entry, original) {
  if (entry && !isDeepStrictEqual({ titleId: entry.titleId, playbackId: entry.playbackId, sourceKind: entry.sourceKind, file: entry.file }, original)) {
    fail(409, "retention_identity_changed", "This title's local original changed. Its previous keep record has not been transferred.");
  }
}

function acquireLock(file) {
  try {
    const handle = fs.openSync(file, "wx", 0o600);
    const owned = fs.fstatSync(handle, { bigint: true });
    return () => {
      fs.closeSync(handle);
      // Do not remove a different process's lock if an external actor replaced
      // this one. No age-based reclamation or ownership guess is permitted.
      try {
        const current = fs.lstatSync(file, { bigint: true });
        if (current.dev === owned.dev && current.ino === owned.ino && !current.isSymbolicLink()) fs.unlinkSync(file);
      } catch { /* A missing or replaced lock is not ours to remove. */ }
    };
  } catch (error) {
    if (error.code === "EEXIST") fail(409, "retention_busy", "Another keep update is in progress. Try again.");
    if (error.code === "ENOSPC") fail(507, "storage_full", "There is no space to save this keep preference.");
    fail(503, "retention_unavailable", "Keep preferences could not be locked for saving.");
  }
}

/** Pins an existing verified local original; never copies, deletes or relabels media. */
export async function processMediaRetentionRequest(req, readBodyFn, options = {}) {
  try {
    const url = new URL(req.originalUrl || req.url || "/api/library/keep", "http://localhost");
    const method = (req.method || "GET").toUpperCase();
    if (url.pathname !== "/api/library/keep") fail(404, "not_found", "Unknown retention route.");
    if (!["GET", "POST"].includes(method)) fail(405, "method_not_allowed", "Method not allowed.");
    if (!isSameOriginProfileMutation(req, url)) fail(403, "cross_origin_denied", "Use the ReelOS home connection.");
    const initial = requireIdentity(req, options);
    let payload;
    if (method === "GET") {
      if ([...url.searchParams].length !== 2 || [...url.searchParams.keys()].some((key) => !["id", "expectedProfileId"].includes(key))
        || url.searchParams.getAll("id").length !== 1 || url.searchParams.getAll("expectedProfileId").length !== 1) {
        fail(400, "invalid_payload", "Supply only id and expectedProfileId.");
      }
      payload = Object.fromEntries(url.searchParams);
    } else {
      if ([...url.searchParams].length) fail(400, "invalid_payload", "Keep updates accept a JSON body only.");
      try { payload = typeof readBodyFn === "function" ? await readBodyFn(req) : req.body; }
      catch (error) { fail(error?.status === 413 ? 413 : 400, "invalid_payload", "The keep request could not be read."); }
    }
    const identity = requireIdentity(req, options);
    if (identity.profile.id !== initial.profile.id) fail(403, "profile_changed", "The active profile changed.");
    if (!object(payload) || Object.keys(payload).some((key) => !["id", "expectedProfileId", ...(method === "POST" ? ["keep", "expectedFileVersion"] : [])].includes(key))
      || !validId(payload.id) || !isValidProfileId(payload.expectedProfileId)
      || (method === "POST" && (typeof payload.expectedFileVersion !== "string" || !/^[a-fA-F0-9]{64}$/.test(payload.expectedFileVersion)))
      || (Object.hasOwn(payload, "keep") && typeof payload.keep !== "boolean")) {
      fail(400, "invalid_payload", "Supply a valid id, expectedProfileId, expectedFileVersion for updates, and optional boolean keep.");
    }
    if (payload.expectedProfileId !== identity.profile.id) fail(403, "profile_changed", "The active profile changed.");
    if (method === "POST" && (identity.profile.isKids || identity.profile.role === "child")) fail(403, "adult_profile_required", "An adult profile must change keep preferences.");
    const original = resolveVerifiedLocalOriginal(req, payload.id, options);
    // Bind the displayed control to its exact original, even before the first
    // pin exists. This token is metadata-derived, not a hash of media contents.
    const fileVersion = createHash("sha256").update(JSON.stringify(original)).digest("hex");
    const ledgerFile = path.join(playbackStateDir(options), "media-retention.json");
    const response = (kept, persisted = false) => ({ status: 200, payload: {
      ok: true, ...(persisted ? { persisted: true } : {}), kept, id: payload.id,
      profileId: identity.profile.id, storage: "local-original", fileVersion,
    } });
    if (method === "GET") {
      const ledger = readLedger(ledgerFile);
      const entry = Object.hasOwn(ledger.entries, original.titleId) ? ledger.entries[original.titleId] : undefined;
      assertOriginalUnchanged(entry, original);
      return response(Boolean(entry && Object.hasOwn(entry.pins, identity.profile.id)));
    }
    const release = acquireLock(ledgerFile + ".lock");
    try {
      const ledger = readLedger(ledgerFile);
      const entry = Object.hasOwn(ledger.entries, original.titleId) ? ledger.entries[original.titleId] : undefined;
      if (payload.expectedFileVersion.toLowerCase() !== fileVersion) {
        fail(409, "retention_identity_changed", "This title's local original changed. Refresh its keep preference before saving.");
      }
      assertOriginalUnchanged(entry, original);
      // Re-read the catalog, source policy, path and inode under the write lock.
      // This rejects revocation/replacement between initial verification and save.
      const latest = resolveVerifiedLocalOriginal(req, payload.id, options);
      assertOriginalUnchanged(original, latest);
      const latestIdentity = requireIdentity(req, options);
      if (latestIdentity.profile.id !== identity.profile.id) fail(403, "profile_changed", "The active profile changed.");
      if (latestIdentity.profile.isKids || latestIdentity.profile.role === "child") fail(403, "adult_profile_required", "An adult profile must change keep preferences.");
      const kept = payload.keep ?? true;
      const pins = { ...(entry?.pins || {}) };
      if (kept) pins[identity.profile.id] = { keptAt: Date.now() };
      else delete pins[identity.profile.id];
      ledger.entries[original.titleId] = { ...original, pins };
      const serialized = JSON.stringify(ledger, null, 2);
      if (Buffer.byteLength(serialized, "utf8") > MAX_LEDGER_BYTES) {
        fail(507, "retention_capacity_exceeded", "Keep preferences reached the supported storage size. No changes were saved.");
      }
      let persisted;
      try { persisted = safeWriteFileSync(ledgerFile, serialized); }
      catch { fail(503, "retention_save_failed", "This keep preference could not be saved. Try again."); }
      if (!persisted) fail(507, "storage_full", "There is no space to save this keep preference.");
      return response(kept, true);
    } finally { release(); }
  } catch (error) {
    return { status: error.status || 503, payload: {
      ok: false, code: error.code || "retention_unavailable",
      error: error.status ? error.message : "Keep preferences are temporarily unavailable.",
    } };
  }
}
