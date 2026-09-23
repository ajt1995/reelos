import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { NATIVE_INSTALL_FILES, shouldPackage } from "./pack-appliance.mjs";
import {
  releasePathDecision, verifyReleaseDirectory, writeReleaseManifests,
} from "./release-artifact-boundary.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("Windows packaging is local and excludes household state", () => {
  const sync = read("scripts/sync-installers.ps1");
  const pack = read("scripts/pack-windows-bundle.ps1");
  const compatibilityEntry = read("scripts/build-windows-installer.ps1");
  assert.doesNotMatch(sync, /Stop-Process|OneDrive|Google Drive|AppData/i);
  assert.doesNotMatch(pack, /Stop-Process|OneDrive|Google Drive|AppData/i);
  assert.match(pack, /\.reelos-state/);
  assert.match(pack, /bundle-manifest\.json/);
  assert.match(pack, /release-artifact-boundary\.mjs/);
  assert.match(pack, /Refusing to overwrite/);
  assert.match(compatibilityEntry, /not a signed installer/i);
  assert.match(compatibilityEntry, /Bootable Windows\/USB installation is unavailable/);
  assert.doesNotMatch(compatibilityEntry, /Decypharr|\.reelos-state|Provisioning Node/i);
});

test("macOS package runs its bundled runtime and never clones a guessed checkout", () => {
  const installer = read("install/install-macos.sh");
  const packer = read("install/mac/macOS-zero-vm-bundle.sh");
  const runner = read("install/mac/ReelOS-Mac.app/Contents/MacOS/ReelOS-Mac");
  assert.doesNotMatch(installer, /git clone|npm install|launchctl/i);
  assert.match(packer, /reelos-runtime/);
  assert.match(packer, /\.reelos-state/);
  assert.match(packer, /release-artifact-boundary\.mjs/);
  assert.match(runner, /ROOT_DIR="\$RESOURCES_DIR\/reelos-runtime"/);
  assert.doesNotMatch(runner, /VideoToolbox HWAccel: active/);
});

test("Android release signing uses only external release configuration", () => {
  const gradle = read("clients/android/app/build.gradle.kts");
  assert.match(gradle, /REELOS_RELEASE_STORE_FILE/);
  assert.match(gradle, /create\("reelosRelease"\)/);
  assert.match(gradle, /signingConfig = signingConfigs\.getByName\("reelosRelease"\)/);
  assert.doesNotMatch(gradle, /signingConfig = signingConfigs\.getByName\("debug"\)/);
  assert.match(gradle, /Debug signing is never used for release/);
});

test("runtime doctor reports repository evidence and strict flags", () => {
  const output = execFileSync(process.execPath, ["scripts/runtime-doctor.mjs", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  const report = JSON.parse(output);
  assert.equal(report.schema, "reelos-runtime-doctor/v1");
  assert.equal(typeof report.repository.installed, "boolean");
  assert.equal(typeof report.repository.pathAvailable, "boolean");
  assert.equal(typeof report.repository.repository, "boolean");
  if (!report.repository.pathAvailable && report.repository.installed) {
    assert.equal(report.repository.source, "codex-runtime");
    assert.match(report.repository.executable, /codex-runtimes[\\/]codex-primary-runtime[\\/]dependencies[\\/]native[\\/]git/i);
  }
  const doctor = read("scripts/runtime-doctor.mjs");
  for (const flag of ["--require-media", "--require-ffmpeg", "--require-ffprobe", "--require-browser", "--require-git"]) {
    assert.match(doctor, new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Linux appliance packages only the native ReelOS runtime", () => {
  const packer = read("scripts/pack-appliance.mjs");
  const installer = read("install/reelos-install.sh");
  for (const retired of ["compose/docker-compose.yml", "bin/wiring/arr.py", "bin/wire-engines.py"]) {
    assert.equal(shouldPackage(`install/${retired}`), false, retired);
  }
  for (const retired of [
    "fleet-learning-service.mjs", "anonymous-gossip-service.mjs", "cinema-brain-loader.mjs",
    "basement-lighthouse-service.mjs", "neural-scale-engine.mjs", "jellyfin-service.mjs",
  ]) assert.equal(shouldPackage(`scripts/services/${retired}`), false, retired);
  assert.deepEqual(NATIVE_INSTALL_FILES, [
    "reelos-install.sh", "bin/reelos-selfheal.sh", "bin/reelos_hardware.py", "bin/reelos-update.sh",
    "bin/reelos-hotspot.sh",
    "systemd/reelos.service", "systemd/reelos-selfheal.service",
    "systemd/reelos-selfheal.timer", "systemd/reelos-hotspot.service",
    "avahi/reelos.service", "README.md",
  ]);
  assert.doesNotMatch(packer, /cpSync\(join\(root, "install"\),/);
  assert.doesNotMatch(installer, /apt-get install[^\n]*(?:docker|sonarr|radarr|prowlarr|decypharr)/i);
  assert.doesNotMatch(installer, /systemctl (?:enable|start|restart) (?:docker|jellyfin|sonarr|radarr|prowlarr|decypharr)/i);
  assert.match(installer, /native appliance/i);
});

test("shared release policy rejects private, generated, test, and retired runtime paths", () => {
  const decisions = new Map([
    ["src/app.tsx", true],
    [".reelos-state/answers.json", false],
    ["app/.env.production", false],
    ["public/install/reelos-native.zip", false],
    ["app/public/install/reelos-native.zip", false],
    ["scripts/example.test.mjs", false],
    ["scripts/services/jellyfin-service.mjs", false],
    ["app/scripts/services/neural-scale-engine.mjs", false],
    ["owner-indexers.json", false],
  ]);
  for (const [path, allowed] of decisions) assert.equal(releasePathDecision(path).allowed, allowed, path);
});

test("shared release manifest records version, provenance, capability state, and exact hashes", () => {
  const temporary = mkdtempSync(join(tmpdir(), "reelos-release-boundary-"));
  try {
    cpSync(join(root, "package.json"), join(temporary, "package.json"));
    mkdirSync(join(temporary, "src"));
    writeFileSync(join(temporary, "src", "safe.ts"), "export const safe = true;\n");
    const result = writeReleaseManifests({ artifactRoot: temporary, repoRoot: root, platform: "test" });
    assert.equal(result.manifest.schema, "reelos-release-artifact/v1");
    assert.equal(result.manifest.version, JSON.parse(read("package.json")).version);
    assert.equal(result.manifest.platform, "test");
    assert.deepEqual(result.manifest.assurance, {
      buildState: "built",
      signatureState: "unsigned",
      notarizationState: "not-applicable",
      realDeviceState: "real-device-unverified",
    });
    assert.equal(typeof result.manifest.provenance.sourceRevision, "string");
    assert.ok(result.manifest.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
    assert.ok(result.capabilities.capabilities.length > 0);
    assert.doesNotThrow(() => verifyReleaseDirectory({ artifactRoot: temporary, platform: "test" }));
    writeFileSync(join(temporary, "src", "safe.ts"), "export const safe = false;\n");
    assert.throws(() => verifyReleaseDirectory({ artifactRoot: temporary, platform: "test" }), /hashes do not match/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("shared release verification refuses suspicious embedded credentials", () => {
  const temporary = mkdtempSync(join(tmpdir(), "reelos-release-secret-"));
  try {
    cpSync(join(root, "package.json"), join(temporary, "package.json"));
    writeFileSync(join(temporary, "runtime.json"), JSON.stringify({ credential: `AKIA${"A".repeat(16)}` }));
    assert.throws(
      () => writeReleaseManifests({ artifactRoot: temporary, repoRoot: root, platform: "test" }),
      /suspicious secret material/,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
