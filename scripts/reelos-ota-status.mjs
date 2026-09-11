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

export function catchupWorkerLive(run = spawnSync) {
  const st = String(run("systemctl", ["is-active", "reelos-library-catchup"], { encoding: "utf8" }).stdout || "").trim();
  return st === "active" || st === "activating";
}

export function parseLibraryProgress(raw, { workerLive = true } = {}) {
  const idle = idleLibraryProgress();
  try {
    const doc = JSON.parse(String(raw || "{}"));
    if (!doc || typeof doc !== "object") return idle;
    if (doc.stopped) return idle;
    const status = String(doc.status || "idle");
    if ((status === "backoff" || status === "running") && workerLive === false) return idle;
    const needsImport = Boolean(doc.needsImport);
    const splashLock = status === "running" && needsImport;
    return {
      status,
      message: String(doc.message || ""),
      folder: Number(doc.folder || 0) || 0,
      total: Number(doc.total || 0) || 0,
      skipped: Number(doc.skipped || 0) || 0,
      timeouts: Number(doc.timeouts || 0) || 0,
      needsImport,
      splashLock: Boolean(doc.splashLock) || splashLock,
    };
  } catch {
    return idle;
  }
}

export function readLibraryProgress(filePath = LIBRARY_PROGRESS, run = spawnSync) {
  try {
    if (!existsSync(filePath)) return idleLibraryProgress();
    return parseLibraryProgress(readFileSync(filePath, "utf8"), {
      workerLive: catchupWorkerLive(run),
    });
  } catch {
    return idleLibraryProgress();
  }
}
