import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import {
  detectProApps,
  getMacHwAccelConfig,
  updateMacYieldState,
  PRO_APPS,
} from "../install/mac/ReelOS-Mac.app/Contents/Resources/reelos-mac-controller.mjs";

test("macOS Zero-VM: Bundle structure and Info.plist are valid", () => {
  const plistPath = join(process.cwd(), "install/mac/ReelOS-Mac.app/Contents/Info.plist");
  assert.ok(existsSync(plistPath), "Info.plist must exist");

  const plist = readFileSync(plistPath, "utf8");
  assert.match(plist, /<string>com\.reelos\.cinema\.mac<\/string>/);
  assert.match(plist, /<string>arm64<\/string>/);
  assert.match(plist, /<key>LSUIElement<\/key>\s*<true\/>/);
  assert.match(plist, /Zero-VM/);
});

test("macOS Zero-VM: Darwin arm64 runner configures VideoToolbox and Metal", () => {
  const runnerPath = join(process.cwd(), "install/mac/ReelOS-Mac.app/Contents/MacOS/ReelOS-Mac");
  assert.ok(existsSync(runnerPath), "ReelOS-Mac executable runner must exist");

  const runner = readFileSync(runnerPath, "utf8");
  assert.match(runner, /ARCH=\$\(uname -m\)/);
  assert.match(runner, /arm64/);
  assert.match(runner, /REELOS_HWACCEL="videotoolbox"/);
  assert.match(runner, /REELOS_GFX_BACKEND="metal"/);
  assert.match(runner, /-hwaccel videotoolbox/);
  assert.match(runner, /--use-metal/);
  assert.match(runner, /kern\.hv_vmm_present/);
});

test("macOS Zero-VM: AppKit Swift Controller implements NSWorkspace yielding and menu bar", () => {
  const swiftPath = join(
    process.cwd(),
    "install/mac/ReelOS-Mac.app/Contents/Resources/ReelOSMenuBarController.swift"
  );
  assert.ok(existsSync(swiftPath), "ReelOSMenuBarController.swift must exist");

  const swift = readFileSync(swiftPath, "utf8");
  assert.match(swift, /import AppKit/);
  assert.match(swift, /NSStatusItem/);
  assert.match(swift, /NSWorkspace\.shared/);
  assert.match(swift, /didActivateApplicationNotification/);
  assert.match(swift, /com\.apple\.FinalCut/);
  assert.match(swift, /com\.blackmagic-design\.DaVinciResolve/);
  assert.match(swift, /VideoToolbox & Metal/);
});

test("macOS Zero-VM: Controller bridge detects creative pro apps and yields", () => {
  // Pro app active in process table
  const psWithFcp = `/Applications/Final Cut Pro.app/Contents/MacOS/Final Cut Pro\n/usr/sbin/syslogd`;
  const statusFcp = detectProApps(psWithFcp);
  assert.equal(statusFcp.yielding, true);
  assert.ok(statusFcp.activeProApps.includes("Final Cut Pro"));

  // No pro apps active
  const psClean = `/usr/sbin/syslogd\n/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder`;
  const statusClean = detectProApps(psClean);
  assert.equal(statusClean.yielding, false);
  assert.equal(statusClean.activeProApps.length, 0);

  // Hardware config
  const cfg = getMacHwAccelConfig();
  assert.equal(cfg.platform, "darwin");
  assert.equal(cfg.arch, "arm64");
  assert.equal(cfg.hwaccel, "videotoolbox");
  assert.equal(cfg.gfxBackend, "metal");
  assert.equal(cfg.zeroVm, true);

  // State writing
  const tempDir = mkdtempSync(join(os.tmpdir(), "reelos-mac-test-"));
  const writeRes = updateMacYieldState(tempDir, statusFcp);
  assert.equal(writeRes.ok, true);
  assert.equal(writeRes.state.yielding, true);
  assert.equal(writeRes.state.hwaccel, "videotoolbox");
});
