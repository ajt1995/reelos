import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

/**
 * ReelOS Mac AppKit & NSWorkspace Pro-App Controller Bridge
 *
 * Runs natively on Darwin arm64 (Apple Silicon) with zero hypervisors.
 * Provides VideoToolbox and Metal acceleration flags and monitors creative pro apps
 * (Final Cut Pro, Logic Pro, DaVinci Resolve, Blender, Xcode, Premiere Pro).
 */

export const PRO_APPS = [
  "Final Cut Pro",
  "Logic Pro",
  "DaVinci Resolve",
  "Blender",
  "Xcode",
  "Adobe Premiere Pro",
];

export function isAppleSilicon() {
  return process.platform === "darwin" && process.arch === "arm64";
}

export function detectProApps(psOutput = null) {
  let output = psOutput;
  if (!output && process.platform === "darwin") {
    try {
      const res = spawnSync("ps", ["-eo", "comm"], { encoding: "utf8", timeout: 2000 });
      output = res.stdout || "";
    } catch {
      output = "";
    }
  }

  if (!output) return { yielding: false, activeProApps: [] };

  const active = [];
  for (const app of PRO_APPS) {
    if (output.includes(app)) {
      active.push(app);
    }
  }

  return {
    yielding: active.length > 0,
    activeProApps: active,
  };
}

export function getMacHwAccelConfig() {
  return {
    platform: "darwin",
    arch: "arm64",
    hwaccel: "videotoolbox",
    gfxBackend: "metal",
    zeroVm: true,
    ffmpegFlags: ["-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld"],
    electronFlags: ["--use-metal", "--enable-features=Metal,VaapiVideoDecoder"],
  };
}

export function updateMacYieldState(stateDir, proAppsStatus) {
  try {
    mkdirSync(stateDir, { recursive: true });
    const flagPath = join(stateDir, "mac-pro-app-yield.json");
    const payload = {
      yielding: proAppsStatus.yielding,
      activeProApps: proAppsStatus.activeProApps,
      updatedAt: Date.now(),
      hwaccel: "videotoolbox",
      gfxBackend: "metal",
    };
    writeFileSync(flagPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    return { ok: true, state: payload };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
