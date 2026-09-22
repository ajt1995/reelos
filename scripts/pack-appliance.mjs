#!/usr/bin/env node
/** Build one native ReelOS appliance, never the retired container stack. */
import { spawnSync } from "node:child_process";
import {
  chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync,
  rmSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  RELEASE_RUNTIME_ENTRIES, copyReleasePath, shouldIncludeReleasePath, writeReleaseManifests,
} from "./release-artifact-boundary.mjs";

export const APP_ENTRIES = RELEASE_RUNTIME_ENTRIES;

export const NATIVE_INSTALL_FILES = [
  "reelos-install.sh",
  "bin/reelos-selfheal.sh",
  "bin/reelos_hardware.py",
  "bin/reelos-update.sh",
  "systemd/reelos.service",
  "systemd/reelos-selfheal.service",
  "systemd/reelos-selfheal.timer",
  "avahi/reelos.service",
  "README.md",
];

export function shouldPackage(relativePath) {
  return shouldIncludeReleasePath(relativePath);
}

function createZip(bundleRoot, output) {
  if (process.platform === "win32") {
    // Windows' .NET ZIP writer records backslashes in entry names. They are
    // tolerated by some readers but make Info-ZIP return a warning status,
    // which can abort a fail-closed Linux installer. bsdtar emits portable '/'.
    return spawnSync("tar", ["-a", "-cf", output, "."], { cwd: bundleRoot, stdio: "inherit" });
  }
  return spawnSync("zip", ["-qr", output, "."], { cwd: bundleRoot, stdio: "inherit" });
}

export function stageNativeAppliance({ root, staging }) {
  const bundleRoot = join(staging, "reelos");
  const appRoot = join(bundleRoot, "app");
  mkdirSync(appRoot, { recursive: true });
  for (const entry of APP_ENTRIES) copyReleasePath(join(root, entry), join(appRoot, entry), entry);
  for (const entry of NATIVE_INSTALL_FILES) {
    copyReleasePath(join(root, "install", entry), join(bundleRoot, entry), join("install", entry));
  }
  if (existsSync(join(root, "VERSION"))) cpSync(join(root, "VERSION"), join(bundleRoot, "VERSION"));
  cpSync(join(bundleRoot, "reelos-install.sh"), join(bundleRoot, "install.sh"));
  for (const executable of ["install.sh", "reelos-install.sh", "bin/reelos-selfheal.sh", "bin/reelos_hardware.py", "bin/reelos-update.sh"]) {
    const path = join(bundleRoot, executable);
    if (existsSync(path)) chmodSync(path, 0o755);
  }
  writeFileSync(join(appRoot, ".reelos-appliance"), "native-v1\n");
  const verified = writeReleaseManifests({ artifactRoot: bundleRoot, repoRoot: root, platform: "linux" });
  return { bundleRoot, manifest: verified.files };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  if (process.argv.includes("--plan")) {
    process.stdout.write(`${JSON.stringify({ app: APP_ENTRIES, install: NATIVE_INSTALL_FILES }, null, 2)}\n`);
    return;
  }
  const staging = mkdtempSync(join(tmpdir(), "reelos-native-pack-"));
  const dest = join(root, "public", "install");
  mkdirSync(dest, { recursive: true });
  try {
    const { bundleRoot, manifest } = stageNativeAppliance({ root, staging });
    const zip = join(dest, "reelos-native.zip");
    rmSync(zip, { force: true });
    const zipped = createZip(bundleRoot, zip);
    if (zipped.status !== 0) throw new Error(`ZIP creation failed (${zipped.status ?? "unknown"}).`);
    process.stdout.write(`Created ${zip} with ${manifest.length} native files.\n`);
    process.stdout.write("Bootable USB media remains unavailable until a real target passes installation and recovery testing.\n");
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
