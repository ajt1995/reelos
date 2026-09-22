#!/usr/bin/env node
/**
 * ReelOS Atomic Version Synchronization Engine
 * 
 * Enforces the Single Source of Truth for the entire ReelOS ecosystem.
 * Propagates the canonical version defined in /VERSION across all runtime,
 * client, installer, and UI targets.
 * 
 * Usage:
 *   node scripts/sync-versions.mjs           # Synchronizes all files to current VERSION
 *   node scripts/sync-versions.mjs 2.5.1     # Bumps VERSION to 2.5.1 and synchronizes all files
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve('.');

// 1. Determine Target Version
const versionArg = process.argv[2]?.trim();
const versionFile = join(ROOT, 'VERSION');

let canonicalVersion = '';
if (versionArg && /^\d+\.\d+\.\d+/.test(versionArg)) {
  canonicalVersion = versionArg;
  writeFileSync(versionFile, canonicalVersion + '\n', 'utf8');
  console.log(`[VersionSync] Canonical VERSION set to: ${canonicalVersion}`);
} else {
  if (!existsSync(versionFile)) {
    console.error('[VersionSync] ERROR: VERSION file not found at repository root!');
    process.exit(1);
  }
  canonicalVersion = readFileSync(versionFile, 'utf8').trim();
  console.log(`[VersionSync] Synchronizing repository to canonical VERSION: ${canonicalVersion}`);
}

const v = canonicalVersion;
const vFourPart = `${v}.0`;
const [versionMajor, versionMinor, versionPatch] = v.split('.').map((part) => Number.parseInt(part, 10) || 0);
const androidVersionCode = versionMajor * 1_000_000 + versionMinor * 1_000 + versionPatch;

let updatedCount = 0;

function syncFile(relPath, transformFn) {
  const fullPath = join(ROOT, relPath);
  if (!existsSync(fullPath)) {
    console.warn(`[VersionSync] Skipping missing file: ${relPath}`);
    return;
  }
  const original = readFileSync(fullPath, 'utf8');
  const modified = transformFn(original);
  if (original !== modified) {
    writeFileSync(fullPath, modified, 'utf8');
    console.log(`  ✓ Updated: ${relPath}`);
    updatedCount++;
  } else {
    console.log(`  - Already in sync: ${relPath}`);
  }
}

// 2. Sync package.json
syncFile('package.json', (content) => {
  const pkg = JSON.parse(content);
  pkg.version = v;
  return JSON.stringify(pkg, null, 2) + '\n';
});

// 3. Sync channel.json
syncFile('channel.json', (content) => {
  const chan = JSON.parse(content);
  chan.version = v;
  const notePrefix = `${v}:`;
  const hasNote = Array.isArray(chan.notes) && chan.notes.some(n => n.startsWith(notePrefix));
  if (!hasNote && Array.isArray(chan.notes)) {
    chan.notes.unshift(
      `${v}: Sovereign Cinema OS & Dynamic Multi-Subnet Release. Direct hardware adaptive memory management, zero-leak streaming daemon, multi-subnet dynamic Android discovery, Two-Vector Pairing (Same House Wi-Fi vs Tailscale Funnel), and 1-tap direct phone & TV APK distribution.`
    );
  }
  return JSON.stringify(chan, null, 2) + '\n';
});

// 4. Sync src/lib/version-stamp.ts
syncFile('src/lib/version-stamp.ts', (content) => {
  let updated = content.replace(/export const LATEST_VERSION = "[^"]+";/, `export const LATEST_VERSION = "${v}";`);
  updated = updated.replace(/export const SHIPPED_VERSION = "[^"]+";/, `export const SHIPPED_VERSION = "${v}";`);
  
  if (!updated.includes('export const APP_VERSION')) {
    updated = updated.replace(/export const SHIPPED_VERSION = "[^"]+";/, `export const SHIPPED_VERSION = "${v}";\nexport const APP_VERSION = "${v}";`);
  } else {
    updated = updated.replace(/export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${v}";`);
  }

  const notePrefix = `"${v}:`;
  if (!updated.includes(notePrefix)) {
    const newNote = `  "${v}: Sovereign Cinema OS & Dynamic Multi-Subnet Release. Direct hardware adaptive memory management, zero-leak streaming daemon, multi-subnet dynamic Android discovery, Two-Vector Pairing (Same House Wi-Fi vs Tailscale Funnel), and 1-tap direct phone & TV APK distribution.",\n`;
    updated = updated.replace(/export const UPDATE_NOTES = \[\r?\n/, `export const UPDATE_NOTES = [\n${newNote}`);
  }
  return updated;
});

// 5. Sync clients/android/app/build.gradle.kts
syncFile('clients/android/app/build.gradle.kts', (content) => {
  let updated = content.replace(/versionName\s*=\s*"[^"]+"/, `versionName = "${v}"`);
  updated = updated.replace(/versionCode\s*=\s*\d+/, `versionCode = ${androidVersionCode}`);
  return updated;
});

// 6. Sync src/installer/ReelOS-Desktop.cs
syncFile('src/installer/ReelOS-Desktop.cs', (content) => {
  let updated = content;
  updated = updated.replace(/\[assembly:\s*System\.Reflection\.AssemblyVersion\("[^"]+"\)]/, `[assembly: System.Reflection.AssemblyVersion("${vFourPart}")]`);
  updated = updated.replace(/\[assembly:\s*System\.Reflection\.AssemblyFileVersion\("[^"]+"\)]/, `[assembly: System.Reflection.AssemblyFileVersion("${vFourPart}")]`);
  updated = updated.replace(/wc\.Headers\["User-Agent"\]\s*=\s*"ReelOS-Installer\/[^"]+";/g, `wc.Headers["User-Agent"] = "ReelOS-Installer/${v}";`);
  updated = updated.replace(/key\.SetValue\("DisplayVersion",\s*"[^"]+"\);/, `key.SetValue("DisplayVersion", "${v}");`);
  return updated;
});

// 7. Sync prebuilt/MANIFEST.txt
syncFile('prebuilt/MANIFEST.txt', (content) => {
  return content.replace(/version=.*/, `version=${v}`);
});

console.log(`\n[VersionSync] Complete. ${updatedCount} file(s) updated to canonical v${v}.\n`);
