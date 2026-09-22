#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const targetArg = process.argv[2];
const outputPath = targetArg ? path.resolve(targetArg) : path.join(repoRoot, "testbench", "reelos-bundle.tar.gz");

console.log("[ReelOS USB Packager]");
console.log(`Repository root: ${repoRoot}`);
console.log(`Target bundle:   ${outputPath}`);

const stagingDir = path.join(repoRoot, ".tmp-bundle-staging");
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

fs.mkdirSync(path.join(stagingDir, "reelos", "app"), { recursive: true });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// Copy App files
const appCopies = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "src",
  "scripts",
  "server",
  "channel.json",
  "channel-beta.json",
  "prebuilt",
];

for (const rel of appCopies) {
  const srcPath = path.join(repoRoot, rel);
  if (!fs.existsSync(srcPath)) continue;
  fs.cpSync(srcPath, path.join(stagingDir, "reelos", "app", rel), { recursive: true });
}

// Copy public directory (excluding install or bundle caches)
if (fs.existsSync(path.join(repoRoot, "public"))) {
  fs.mkdirSync(path.join(stagingDir, "reelos", "app", "public"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "public"), path.join(stagingDir, "reelos", "app", "public"), {
    recursive: true,
    filter: (src) => !src.includes("install") && !src.endsWith(".tar.gz") && !src.endsWith(".zip"),
  });
}

// Write .reelos-appliance marker
fs.writeFileSync(path.join(stagingDir, "reelos", "app", ".reelos-appliance"), "1\n");

// Copy install tree
if (fs.existsSync(path.join(repoRoot, "install"))) {
  fs.cpSync(path.join(repoRoot, "install"), path.join(stagingDir, "reelos"), { recursive: true });
}

// Copy install.sh
if (fs.existsSync(path.join(repoRoot, "install", "reelos-install.sh"))) {
  fs.cpSync(path.join(repoRoot, "install", "reelos-install.sh"), path.join(stagingDir, "reelos", "install.sh"));
  fs.cpSync(path.join(repoRoot, "install", "reelos-install.sh"), path.join(stagingDir, "reelos", "reelos-install.sh"));
}

// Copy VERSION
if (fs.existsSync(path.join(repoRoot, "VERSION"))) {
  fs.cpSync(path.join(repoRoot, "VERSION"), path.join(stagingDir, "reelos", "VERSION"));
}

// Copy daemon scripts to bin
const binDir = path.join(stagingDir, "reelos", "bin");
fs.mkdirSync(binDir, { recursive: true });
if (fs.existsSync(path.join(repoRoot, "daemon"))) {
  fs.cpSync(path.join(repoRoot, "daemon"), binDir, { recursive: true });
}

console.log("Staging complete. Creating tar.gz archive using Python...");

// Create tar.gz using Python's tarfile for cross-platform tar/gzip execution
const pythonScript = `
import os
import sys
import tarfile

staging_dir = sys.argv[1]
output_file = sys.argv[2]

source_dir = os.path.join(staging_dir, "reelos")

with tarfile.open(output_file, "w:gz") as tar:
    tar.add(source_dir, arcname="reelos")

print(f"Archive written successfully: {os.path.getsize(output_file)} bytes")
`;

const res = spawnSync("python", ["-c", pythonScript, stagingDir, outputPath], { stdio: "inherit" });

// Clean staging
fs.rmSync(stagingDir, { recursive: true, force: true });

if (res.status !== 0) {
  console.error("Packaging failed with status", res.status);
  process.exit(res.status || 1);
}

const stats = fs.statSync(outputPath);
console.log(`[Success] ReelOS bundle created at ${outputPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
