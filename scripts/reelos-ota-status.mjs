import { spawnSync } from "node:child_process";

export const OTA_LOCK = "/var/lib/reelos/ota.lock";

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
