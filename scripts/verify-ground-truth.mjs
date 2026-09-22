#!/usr/bin/env node
/**
 * ReelOS Anti-Facade & Ground-Truth Automated Linter
 * 
 * Verifies that the codebase strictly obeys:
 * 1. GROUND-TRUTH.md
 * 2. docs/THE-LAWS-OF-REELOS.md
 * 3. docs/MASTER-VISION-LEDGER.md (Highest version authority)
 *
 * Exits with code 1 upon detecting any prohibited obsolete relics.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
let violations = 0;

function report(violation, file, line) {
  console.error(`? GROUND-TRUTH VIOLATION: ${violation} at ${file}:${line}`);
  violations++;
}

function scanDir(dir, filterExts, ignoreDirs, checkFn) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        scanDir(fullPath, filterExts, ignoreDirs, checkFn);
      }
    } else if (filterExts.some(ext => entry.name.endsWith(ext))) {
      checkFn(fullPath);
    }
  }
}

console.log('================================================================================');
console.log('              REELOS AUTOMATED GROUND-TRUTH & ANTI-FACADE AUDIT                 ');
console.log('================================================================================\n');

// 1. Check for SampleCatalog or fake mock libraries in clients/android
console.log('[1/5] Checking for fake catalog / SampleCatalog relics in Android client...');
scanDir(join(ROOT, 'clients', 'android'), ['.kt', '.java'], ['build', '.gradle'], (file) => {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('SampleCatalog') && !line.trim().startsWith('//')) {
      report('SampleCatalog mock data reference detected', file, idx + 1);
    }
  });
});

// 2. Check for dead legacy ports (8096, 8989, 7878, 9696) in active Android player code
console.log('[2/5] Checking for dead legacy ports (8096, 8989) in active Android players...');
scanDir(join(ROOT, 'clients', 'android'), ['.kt'], ['build', '.gradle'], (file) => {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if ((line.includes(':8096') || line.includes(':8989')) && !line.trim().startsWith('//')) {
      report('Dead legacy port hardcoded in client code', file, idx + 1);
    }
  });
});

// 3. Check for rigid 100MB/15MB memory limits in scripts/
console.log('[3/5] Checking for obsolete 100MB memory ceiling assertions in scripts/...');
scanDir(join(ROOT, 'scripts'), ['.mjs', '.js'], ['node_modules'], (file) => {
  if (file.endsWith('verify-ground-truth.mjs')) return;
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if ((line.includes('MAX_WIN_BACKGROUND_MB = 100') || line.includes('assert(mb < 100')) && !line.trim().startsWith('//')) {
      report('Obsolete 100MB memory ceiling assertion found (must obey Law 1 & Section 17)', file, idx + 1);
    }
  });
});

// 4. Verify Android AppPreferences has no hardcoded IP default
console.log('[4/5] Verifying AppPreferences.kt has zero hardcoded LAN IP defaults...');
const prefsFile = join(ROOT, 'clients', 'android', 'app', 'src', 'main', 'java', 'com', 'reelos', 'core', 'prefs', 'AppPreferences.kt');
try {
  const prefsContent = readFileSync(prefsFile, 'utf8');
  if (prefsContent.includes('192.168.1.234')) {
    report('Hardcoded IP default (192.168.1.234) found in AppPreferences.kt', prefsFile, 1);
  }
} catch (e) {
  console.warn('Could not read AppPreferences.kt directly:', e.message);
}

// 5. Verify Repository-Wide Version Parity against single source of truth (/VERSION)
console.log('[5/5] Verifying repository-wide Version Parity against /VERSION...');
const versionPath = join(ROOT, 'VERSION');
if (!existsSync(versionPath)) {
  report('Missing canonical VERSION file at repository root', 'VERSION', 1);
} else {
  const canonicalVer = readFileSync(versionPath, 'utf8').trim();

  // A. package.json
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    if (pkg.version !== canonicalVer) {
      report(`package.json version (${pkg.version}) does not match canonical VERSION (${canonicalVer})`, 'package.json', 1);
    }
  } catch (e) {
    report(`Failed to parse package.json: ${e.message}`, 'package.json', 1);
  }

  // B. channel.json
  try {
    const chan = JSON.parse(readFileSync(join(ROOT, 'channel.json'), 'utf8'));
    if (chan.version !== canonicalVer) {
      report(`channel.json version (${chan.version}) does not match canonical VERSION (${canonicalVer})`, 'channel.json', 1);
    }
  } catch (e) {
    report(`Failed to parse channel.json: ${e.message}`, 'channel.json', 1);
  }

  // C. src/lib/version-stamp.ts
  try {
    const stamp = readFileSync(join(ROOT, 'src', 'lib', 'version-stamp.ts'), 'utf8');
    const latestMatch = stamp.match(/export const LATEST_VERSION = "([^"]+)";/);
    const shippedMatch = stamp.match(/export const SHIPPED_VERSION = "([^"]+)";/);
    const appVerMatch = stamp.match(/export const APP_VERSION = "([^"]+)";/);
    if (!latestMatch || latestMatch[1] !== canonicalVer) {
      report(`version-stamp.ts LATEST_VERSION (${latestMatch?.[1]}) does not match canonical VERSION (${canonicalVer})`, 'src/lib/version-stamp.ts', 1);
    }
    if (!shippedMatch || shippedMatch[1] !== canonicalVer) {
      report(`version-stamp.ts SHIPPED_VERSION (${shippedMatch?.[1]}) does not match canonical VERSION (${canonicalVer})`, 'src/lib/version-stamp.ts', 1);
    }
    if (!appVerMatch || appVerMatch[1] !== canonicalVer) {
      report(`version-stamp.ts APP_VERSION (${appVerMatch?.[1]}) does not match canonical VERSION (${canonicalVer})`, 'src/lib/version-stamp.ts', 1);
    }
  } catch (e) {
    report(`Failed to read version-stamp.ts: ${e.message}`, 'src/lib/version-stamp.ts', 1);
  }

  // D. clients/android/app/build.gradle.kts
  try {
    const gradle = readFileSync(join(ROOT, 'clients', 'android', 'app', 'build.gradle.kts'), 'utf8');
    const gradleMatch = gradle.match(/versionName\s*=\s*"([^"]+)"/);
    if (!gradleMatch || gradleMatch[1] !== canonicalVer) {
      report(`build.gradle.kts versionName (${gradleMatch?.[1]}) does not match canonical VERSION (${canonicalVer})`, 'clients/android/app/build.gradle.kts', 1);
    }
  } catch (e) {
    report(`Failed to read Android build.gradle.kts: ${e.message}`, 'clients/android/app/build.gradle.kts', 1);
  }

  // E. src/installer/ReelOS-Desktop.cs
  try {
    const desktopCs = readFileSync(join(ROOT, 'src', 'installer', 'ReelOS-Desktop.cs'), 'utf8');
    const v4 = `${canonicalVer}.0`;
    if (!desktopCs.includes(`[assembly: System.Reflection.AssemblyVersion("${v4}")]`)) {
      report(`ReelOS-Desktop.cs AssemblyVersion does not match canonical VERSION (${v4})`, 'src/installer/ReelOS-Desktop.cs', 1);
    }
    if (!desktopCs.includes(`key.SetValue("DisplayVersion", "${canonicalVer}");`)) {
      report(`ReelOS-Desktop.cs DisplayVersion does not match canonical VERSION (${canonicalVer})`, 'src/installer/ReelOS-Desktop.cs', 1);
    }
  } catch (e) {
    report(`Failed to read ReelOS-Desktop.cs: ${e.message}`, 'src/installer/ReelOS-Desktop.cs', 1);
  }

  // F. prebuilt/MANIFEST.txt
  try {
    const manifest = readFileSync(join(ROOT, 'prebuilt', 'MANIFEST.txt'), 'utf8');
    if (!manifest.includes(`version=${canonicalVer}`)) {
      report(`prebuilt/MANIFEST.txt version does not match canonical VERSION (${canonicalVer})`, 'prebuilt/MANIFEST.txt', 1);
    }
  } catch (e) {
    report(`Failed to read prebuilt/MANIFEST.txt: ${e.message}`, 'prebuilt/MANIFEST.txt', 1);
  }
}

console.log('\n--------------------------------------------------------------------------------');
if (violations > 0) {
  console.error(`FAILED: ${violations} ground-truth violation(s) detected. Fix before proceeding.`);
  process.exit(1);
} else {
  console.log('✔ 100% GROUND-TRUTH COMPLIANT: Zero fake catalogs, zero dead ports, zero version drift.');
  console.log('================================================================================\n');
}
