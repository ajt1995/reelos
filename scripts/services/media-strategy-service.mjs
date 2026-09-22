import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { listStorageDevices, checkStorageHeadroom } from "./storage-service.mjs";
import { safeWriteFileSync } from "./profile-service.mjs";
import { playbackIdentity } from "./playback-access-service.mjs";
import { isSameOriginProfileMutation } from "./profile-session-service.mjs";
import { getPreparationBudget, withPreparationBudgetLock } from "./preparation-budget-service.mjs";

const DEFAULT_STATE_DIR = process.env.REELOS_STATE || (process.platform === "win32" ? path.join(process.cwd(), ".reelos-state") : "/var/lib/reelos");

export const STRATEGY_MODES = [
  {
    id: "smart_hybrid",
    name: "Smart Hybrid Mode",
    recommended: true,
    tagline: "Prefer streaming for new discoveries and retained copies for selected favorites and travel, subject to source, network, and storage availability.",
    diskImpact: "Dynamic Cache (Auto-balances free space)",
    offlineReady: "Favorite series & travel vaults available offline",
    speed: "Playback time depends on the verified source and network",
  },
  {
    id: "cloud_stream",
    name: "Instant Cloud Stream",
    recommended: false,
    tagline: "Prefer provider streaming without retaining the full title locally. Availability and startup time depend on the connected provider.",
    diskImpact: "Temporary buffering still uses memory and may use system caches",
    offlineReady: "Requires active internet connection",
    speed: "Provider-dependent",
  },
  {
    id: "offline_download",
    name: "Full Offline Download",
    recommended: false,
    tagline: "Retain a verified source on an approved drive for offline playback after the copy is complete and validated.",
    diskImpact: "High Disk Usage (Full video files preserved on drive)",
    offlineReady: "Offline after the retained copy is verified on this device",
    speed: "Initial download required before playback",
  },
];

export const DEFAULT_STRATEGY = {
  mode: "smart_hybrid",
  storageAllocation: "dynamic_20", // 'dynamic_20' | 'fixed'
  allocatedGb: 50,
  dedicatedUsbMount: null,
  autoDownloadFavorites: true,
  autoDownloadWatchlist: true,
  autoDownloadCabinVault: true,
  updatedAt: 1000,
};

/**
 * Resolves free disk space in GB on the primary storage volume.
 */
export function inspectStorageSpace(targetPath = "/") {
  const measured = checkStorageHeadroom(targetPath, { allowSimulation: false });
  if (!measured.ok || measured.simulatedByChaosMonkey) return {
    ok: false, available: false, totalBytes: null, freeBytes: null, totalGb: 0, freeGb: 0, dynamic20Gb: 0,
  };
  const { totalBytes, freeBytes } = measured;
  const protectedFreeBytes = Math.max(2 * 1024 ** 3, Math.ceil(totalBytes * 0.1));
  return { ok: true, available: true, totalBytes, freeBytes,
    totalGb: totalBytes / 1024 ** 3, freeGb: freeBytes / 1024 ** 3,
    dynamic20Gb: Math.floor(Math.max(0, freeBytes - protectedFreeBytes) * 0.2) / 1024 ** 3 };
}

const strategyError = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const strategyRevision = (strategy) => createHash("sha256").update(JSON.stringify(strategy)).digest("hex");
function validateStrategy(value, { patch = false } = {}) {
  if (!isObject(value) || Object.keys(value).some((key) => !Object.hasOwn(DEFAULT_STRATEGY, key))) throw strategyError("invalid_strategy", "Use the available storage choices.");
  for (const [key, item] of Object.entries(value)) {
    const valid = key === "mode" ? STRATEGY_MODES.some((mode) => mode.id === item)
      : key === "storageAllocation" ? ["dynamic_20", "fixed"].includes(item)
      : key === "allocatedGb" ? Number.isFinite(item) && item >= 0 && Number.isSafeInteger(item * 1024 ** 3)
      : key === "dedicatedUsbMount" ? item === null || (!patch && typeof item === "string" && path.isAbsolute(item))
      : key === "updatedAt" ? Number.isFinite(item) && item >= 0
      : typeof item === "boolean";
    if (!valid) throw strategyError("invalid_strategy", "Use a valid storage amount and the available storage choices.");
  }
}

/**
 * Loads current media strategy.
 */
export function getMediaStrategy(stateDir = DEFAULT_STATE_DIR) {
  const filePath = path.join(stateDir, "media-strategy.json");
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error("Invalid strategy file");
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    validateStrategy(data);
    return { ...DEFAULT_STRATEGY, ...data };
  } catch (error) {
    if (error.code === "ENOENT") return { ...DEFAULT_STRATEGY };
    throw strategyError("strategy_unavailable", "Storage preferences could not be read. No changes were made.", 503);
  }
}

/**
 * Saves media strategy updates.
 */
export function saveMediaStrategy(patch = {}, stateDir = DEFAULT_STATE_DIR, { expectedRevision, authorize } = {}) {
  try {
    validateStrategy(patch, { patch: true });
    fs.mkdirSync(stateDir, { recursive: true });
    return withPreparationBudgetLock(stateDir, () => {
      authorize?.();
      const current = getMediaStrategy(stateDir);
      if (expectedRevision !== undefined && expectedRevision !== strategyRevision(current)) throw strategyError("strategy_changed", "Storage preferences changed. Check them again before saving.", 409);
      const updated = { ...current, ...patch, updatedAt: Date.now() };
      const storage = inspectStorageSpace(stateDir);
      const budget = getPreparationBudget(stateDir, { strategy: updated });
      if (!storage.available || !budget.available) throw strategyError("storage_unavailable", "Storage space and reservations must be verified before saving.", 503);
      const maxBytes = Math.max(0, storage.totalBytes - budget.protectedFreeBytes);
      if (updated.storageAllocation === "fixed" && updated.allocatedGb * 1024 ** 3 > maxBytes) throw strategyError("budget_too_large", "That amount would use space reserved for this computer.");
      if (budget.limitBytes < budget.usedBytes + budget.reservedBytes) throw strategyError("budget_in_use", "Prepared files or work in progress need more space than this limit. Nothing was deleted.", 409);
      authorize?.();
      if (!safeWriteFileSync(path.join(stateDir, "media-strategy.json"), JSON.stringify(updated, null, 2) + "\n")) throw strategyError("storage_full", "Storage preferences could not be saved.", 507);
      return { ok: true, persisted: true, strategy: updated, revision: strategyRevision(updated) };
    });
  } catch (err) {
    return { ok: false, code: err.code || "strategy_save_failed", status: err.status || 503,
      error: err.status ? err.message : "Storage preferences could not be saved. Try again." };
  }
}

/**
 * Resolves whether a title should be cloud-streamed or downloaded offline.
 */
export function resolveAcquisitionStrategy(title = {}, profile = {}, strategy = DEFAULT_STRATEGY) {
  const mode = strategy.mode || "smart_hybrid";

  if (mode === "cloud_stream") {
    return {
      action: "stream",
      method: "symlink",
      reason: "Provider streaming is preferred; availability and buffering are verified at playback time",
      badge: "Instant Cloud",
    };
  }

  if (mode === "offline_download") {
    return {
      action: "download",
      method: "download",
      reason: "Full Offline Download enabled (permanent storage)",
      badge: "Offline Copy",
    };
  }

  // Smart Hybrid Mode logic
  const isCabinVault = Boolean(title.cabinVault || title.isVault);
  if (isCabinVault && strategy.autoDownloadCabinVault !== false) {
    return {
      action: "download",
      method: "download",
      reason: "Road Trip / Cabin vault title is preferred for an offline copy",
      badge: "Travel Vault",
    };
  }

  const isWatchlist = Boolean(title.onWatchlist || (profile.watchlist || []).includes(title.id));
  if (isWatchlist && strategy.autoDownloadWatchlist !== false) {
    return {
      action: "download",
      method: "download",
      reason: "Watchlist favorite is preferred for an offline copy",
      badge: "Watchlist Cache",
    };
  }

  const isComfortVibe = profile.tasteVibe === "comfort";
  const isTvSeries = title.type === "tv" || title.type === "show";
  const genres = Array.isArray(title.genres) ? title.genres : [];
  const isComfortGenre = genres.includes("comedy") || genres.includes("sitcom") || genres.includes("animation");

  if (strategy.autoDownloadFavorites !== false && ((isComfortVibe && isTvSeries) || isComfortGenre)) {
    return {
      action: "download",
      method: "download",
      reason: "Comfort series is preferred for a retained local copy",
      badge: "Comfort Cache",
    };
  }

  // Default discovery playback
  return {
    action: "stream",
    method: "symlink",
    reason: "New discovery prefers provider streaming when a verified source is available",
    badge: "Instant Stream",
  };
}

/**
 * HTTP Router for /api/strategy
 */
export async function handleMediaStrategyRoute(req, res, parsedUrl, readBodyFn, stateDir = DEFAULT_STATE_DIR) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = parsedUrl.pathname;
  if (!["/api/strategy", "/api/strategy/resolve", "/api/disks/hotplug-status", "/api/disks/hotplug-detect", "/api/disks/hotplug-dismiss"].includes(pathname)) return false;
  const send = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
    res.end(JSON.stringify(payload));
    return true;
  };
  const identify = () => {
    const identity = playbackIdentity(req, { stateDir, profilesDir: path.join(stateDir, "profiles") });
    if (!identity.ok) throw strategyError(identity.code, "Open an authorized profile to view storage settings.", identity.status);
    if (identity.profile.isKids || identity.profile.role === "child") throw strategyError("adult_required", "An adult profile manages storage.", 403);
    return identity;
  };
  try {
    if (!["GET", "POST"].includes(method)) throw strategyError("method_not_allowed", "Method not allowed.", 405);
    if (!isSameOriginProfileMutation(req, parsedUrl)) throw strategyError("cross_origin_denied", "Use this home's connection.", 403);
    const initial = identify();
    const snapshot = () => {
      const current = identify();
      if (current.profile.id !== initial.profile.id) throw strategyError("profile_changed", "The active profile changed.", 403);
      const strategy = getMediaStrategy(stateDir);
      const { dedicatedUsbMount, ...publicStrategy } = strategy;
      const storage = inspectStorageSpace(stateDir);
      const budget = getPreparationBudget(stateDir);
      if (storage.available && budget.available) storage.dynamic20Gb = Math.floor((Math.max(0, storage.freeBytes - budget.protectedFreeBytes) + budget.usedBytes) * 0.2) / 1024 ** 3;
      return { ok: true, profileId: current.profile.id, revision: strategyRevision(strategy), canEdit: current.profile.role === "owner",
        strategy: publicStrategy, storage, budget, modes: STRATEGY_MODES,
        preparation: { available: false, reason: "Automatic preparation is not connected yet." } };
    };
    if (pathname === "/api/strategy" && method === "GET") return send(200, snapshot());
    const owner = () => {
      const current = identify();
      if (current.profile.id !== initial.profile.id) throw strategyError("profile_changed", "The active profile changed.", 403);
      if (current.profile.role !== "owner") throw strategyError("owner_required", "Only the owner can change storage for this home.", 403);
      return current;
    };
    if ((pathname === "/api/disks/hotplug-status" || pathname === "/api/disks/hotplug-detect") && method === "GET") {
      owner();
      const status = detectHotpluggedDrives({ stateDir });
      return send(200, { ...status, detected: Boolean(status.hasNewDrive), drives: status.drive ? [status.drive] : [] });
    }
    if (method !== "POST") throw strategyError("method_not_allowed", "Method not allowed.", 405);
    owner();
    let body;
    try { body = typeof readBodyFn === "function" ? await readBodyFn(req) : req.body; }
    catch (error) { throw strategyError("invalid_payload", "The storage request could not be read.", error.status === 413 ? 413 : 400); }
    const current = owner();
    if (!isObject(body) || body.expectedProfileId !== current.profile.id) throw strategyError("profile_changed", "Check storage settings in the current owner's profile before saving.", 403);
    if (pathname === "/api/strategy") {
      const { expectedProfileId, expectedRevision, ...patch } = body;
      if (typeof expectedRevision !== "string" || !/^[a-f0-9]{64}$/.test(expectedRevision)) throw strategyError("revision_required", "Check current storage settings before saving.", 409);
      if (Object.hasOwn(patch, "updatedAt")) throw strategyError("invalid_strategy", "The save time is managed by this home.");
      const result = saveMediaStrategy(patch, stateDir, { expectedRevision, authorize: owner });
      if (!result.ok) return send(result.status || 503, result);
      return send(200, { ...snapshot(), persisted: true });
    }
    if (pathname === "/api/strategy/resolve") {
      // This is a preference hint, never a source grant or download receipt.
      if (Object.keys(body).some((key) => !["expectedProfileId", "id"].includes(key)) || typeof body.id !== "string") throw strategyError("invalid_payload", "Supply one library title.");
      const { readPlaybackLibraryItems, authorizePlaybackItem } = await import("./playback-access-service.mjs");
      owner();
      const matches = readPlaybackLibraryItems({ stateDir }).filter((item) => item.id === body.id);
      if (matches.length !== 1) throw strategyError("source_unavailable", "No unique available library title was found.", 404);
      const access = authorizePlaybackItem(req, matches[0], { stateDir, profilesDir: path.join(stateDir, "profiles") });
      if (!access.ok) throw strategyError(access.code, access.error, access.status);
      return send(200, { ok: true, preferenceOnly: true, decision: resolveAcquisitionStrategy(matches[0], current.profile, getMediaStrategy(stateDir)) });
    }
    if (pathname === "/api/disks/hotplug-dismiss") {
      if (Object.keys(body).some((key) => !["expectedProfileId", "driveId"].includes(key)) || typeof body.driveId !== "string" || body.driveId.length > 1024) throw strategyError("invalid_payload", "Choose a detected drive.");
      return send(200, dismissHotplugDrive(body.driveId));
    }
    throw strategyError("method_not_allowed", "Method not allowed.", 405);
  } catch (error) {
    return send(error.status || 503, { ok: false, code: error.code || "strategy_unavailable", error: error.status ? error.message : "Storage settings are unavailable. Try again." });
  }
}

let dismissedHotplugIds = new Set();

/**
 * Detects newly plugged-in USB drives suitable for media storage cache expansion.
 */
export function detectHotpluggedDrives({ stateDir = DEFAULT_STATE_DIR, scanFn = null } = {}) {
  if (typeof scanFn === "function") {
    return scanFn();
  }

  // Check stateDir for mock/test hotplug override or scan mounted drives
  const mockFile = path.join(stateDir, "mock-hotplug.json");
  if (fs.existsSync(mockFile)) {
    try {
      const mock = JSON.parse(fs.readFileSync(mockFile, "utf8"));
      if (mock && mock.id && !dismissedHotplugIds.has(mock.id)) {
        return { ok: true, hasNewDrive: true, drive: mock };
      }
    } catch {}
  }

  // Check /media or /mnt for plugged-in USB storage
  try {
    const usbMounts = ["/mnt/usb", "/media/reelos", "/mnt/external"];
    for (const m of usbMounts) {
      if (fs.existsSync(m) && !dismissedHotplugIds.has(m)) {
        return {
          ok: true,
          hasNewDrive: true,
          drive: {
            id: m,
            name: path.basename(m) || "External USB Drive",
            sizeGb: null,
            mountPoint: m,
          },
        };
      }
    }
  } catch {}

  return { ok: true, hasNewDrive: false, drive: null };
}

export function dismissHotplugDrive(driveId) {
  if (driveId) dismissedHotplugIds.add(String(driveId));
  return { ok: true, dismissed: driveId };
}

export function getRollingNextUpBuffer(seriesId, currentSeason, currentEpisode, count = 2, options = {}) {
  const episodes = [];
  for (let i = 1; i <= count; i++) {
    episodes.push({
      seriesId,
      season: currentSeason,
      episode: currentEpisode + i,
      action: "pre_download",
      reason: "Rolling Next-Up buffer for instant uninterrupted watching",
    });
  }

  const evicted = [];
  const watchedHistory = options.watchedEpisodes || options.watched || [];
  const capacityPct = options.capacityPct !== undefined ? options.capacityPct : 0;
  if (capacityPct >= 95 || options.forceEvict) {
    for (const w of watchedHistory) {
      if (w.seriesId === seriesId && (w.season < currentSeason || (w.season === currentSeason && w.episode <= currentEpisode))) {
        evicted.push({
          seriesId,
          season: w.season,
          episode: w.episode,
          action: "evict",
          reason: `Storage capacity at ${capacityPct}% - evicting watched episode to preserve 2-episode forward window`,
        });
      }
    }
  }

  episodes.evicted = evicted;
  episodes.maintainedForwardWindow = episodes.length === count;
  return episodes;
}
