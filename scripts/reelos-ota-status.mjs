import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export const OTA_LOCK = "/var/lib/reelos/ota.lock";
export const LIBRARY_PROGRESS = "/var/lib/reelos/library-progress.json";

/** Leftover ota.lock on disk is normal. Only a held flock means Apply is running. Never delete the file. */
export function lockIsHeld(lockPath = OTA_LOCK, run = spawnSync) {
  const r = run("flock", ["-n", lockPath, "-c", "true"], { encoding: "utf8" });
  if (r.error) return false;
  return r.status !== 0;
}

export function unitIsActive(run = spawnSync) {
  const st = String(run("systemctl", ["is-active", "reelos-ota"], { encoding: "utf8" }).stdout || "").trim();
  return st === "active" || st === "activating";
}

export function applyIsRunning({
  env = process.env,
  lockPath = OTA_LOCK,
  run = spawnSync,
} = {}) {
  if (env.REELOS_OTA === "1") return true;
  if (unitIsActive(run)) return true;
  return lockIsHeld(lockPath, run);
}

export function applyTargetFromLog(text) {
  const raw = String(text || "");
  const arrows = [...raw.matchAll(/ReelOS\s+\S+\s+→\s+(\S+)/g)];
  if (arrows.length) return arrows[arrows.length - 1][1];
  const channels = [...raw.matchAll(/^channel\s+(\S+)/gm)];
  if (channels.length) return channels[channels.length - 1][1];
  return null;
}

/** True once ota.log printed `ReelOS <target> applied.` for the latest arrow. */
export function productSwapDone(text) {
  const raw = String(text || "");
  const target = applyTargetFromLog(raw);
  if (!target) return false;
  const escaped = String(target).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`ReelOS\\s+${escaped}\\s+applied\\.`).test(raw);
}

/**
 * Phone Applying clock. Lock/unit still refuse a second Apply via applyIsRunning.
 * After stamp, compose pull / library worker must not look like a stuck Apply.
 */
export function applyProductRunning({
  env = process.env,
  lockPath = OTA_LOCK,
  run = spawnSync,
  logText = "",
} = {}) {
  if (!applyIsRunning({ env, lockPath, run })) return false;
  if (logText && productSwapDone(logText)) return false;
  return true;
}

export const LIBRARY_CATCHUP_LOCK = "/var/lib/reelos/library-catchup.lock";
export const CATCHUP_UNIT = "reelos-library-catchup.service";

const SETTLED_CATCHUP = new Set(["done", "idle", "stopped", "stop", "backoff"]);

export function catchupUnitIsActive(run = spawnSync) {
  const st = String(run("systemctl", ["is-active", CATCHUP_UNIT], { encoding: "utf8" }).stdout || "").trim();
  return st === "active" || st === "activating";
}

/** True only while the catch-up oneshot or its flock is actually live. Leftover lock files do not count. */
export function catchupIsActuallyRunning({
  run = spawnSync,
  lockPath = LIBRARY_CATCHUP_LOCK,
} = {}) {
  if (catchupUnitIsActive(run)) return true;
  return lockIsHeld(lockPath, run);
}

export function idleLibraryProgress() {
  return {
    status: "idle",
    message: "",
    folder: 0,
    total: 0,
    skipped: 0,
    timeouts: 0,
    needsImport: false,
    splashLock: false,
  };
}

export function shouldSplashLock(doc, { actuallyRunning } = {}) {
  const status = String(doc?.status || "idle").toLowerCase();
  if (SETTLED_CATCHUP.has(status)) return false;
  if (status !== "running") return false;
  if (!Boolean(doc?.needsImport)) return false;
  if (actuallyRunning === false) return false;
  return true;
}

export function honestCatchupMessage(doc, splashLock) {
  const status = String(doc?.status || "idle").toLowerCase();
  const raw = String(doc?.message || "");
  const catching = /^library catching up/i.test(raw) || /backing off/i.test(raw);
  if (splashLock) return raw || "Library catching up";
  const skipped = Number(doc?.skipped || 0) || 0;
  const timeouts = Number(doc?.timeouts || 0) || 0;
  if (catching || !raw) {
    if (
      status === "done" ||
      status === "stopped" ||
      (status === "running" && !doc?.needsImport && skipped)
    ) {
      if (skipped || timeouts) return `Library catch-up done — ${skipped} skipped, ${timeouts} timeouts`;
      return status === "done" || status === "stopped" ? "Library catch-up done" : "";
    }
    if (status === "idle" || status === "backoff") return "";
    return catching ? "" : raw;
  }
  return raw;
}

export function parseLibraryProgress(raw, opts = {}) {
  const idle = idleLibraryProgress();
  try {
    const doc = JSON.parse(String(raw || "{}"));
    if (!doc || typeof doc !== "object") return idle;
    let status = String(doc.status || "idle");
    if (status === "backoff") status = "idle";
    let needsImport = Boolean(doc.needsImport);
    const skipped = Number(doc.skipped || 0) || 0;
    const timeouts = Number(doc.timeouts || 0) || 0;
    const folder = Number(doc.folder || 0) || 0;
    const total = Number(doc.total || 0) || 0;
    const actuallyRunning = opts.actuallyRunning;
    if (actuallyRunning === false && String(status).toLowerCase() === "running") {
      status = "done";
      needsImport = false;
    }
    const splashLock = shouldSplashLock({ status, needsImport }, { actuallyRunning });
    return {
      status,
      message: honestCatchupMessage(
        { status, message: String(doc.message || ""), skipped, timeouts, needsImport },
        splashLock,
      ),
      folder,
      total,
      skipped,
      timeouts,
      needsImport,
      splashLock,
    };
  } catch {
    return idle;
  }
}

export function readLibraryProgress(filePath = LIBRARY_PROGRESS, opts = {}) {
  try {
    if (!existsSync(filePath)) return idleLibraryProgress();
    let actuallyRunning = opts.actuallyRunning;
    if (actuallyRunning === undefined) {
      try {
        actuallyRunning = catchupIsActuallyRunning({ run: opts.run, lockPath: opts.lockPath });
      } catch {
        actuallyRunning = undefined;
      }
    }
    return parseLibraryProgress(readFileSync(filePath, "utf8"), { actuallyRunning });
  } catch {
    return idleLibraryProgress();
  }
}
