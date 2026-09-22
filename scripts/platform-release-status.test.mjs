import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { platformReleaseStatus, validatePlatformReleaseStatus } from "./platform-release-status.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("platform report refuses to turn source presence into release certification", () => {
  const report = validatePlatformReleaseStatus(platformReleaseStatus({
    root,
    hostPlatform: "win32",
    hostArch: "x64",
    env: {},
  }));
  assert.deepEqual(report.platforms.map((item) => item.id), [
    "linux", "windows", "macos-apple-silicon", "android", "android-tv",
  ]);
  assert.ok(report.platforms.every((item) => item.releaseReady === false));
  assert.ok(report.platforms.every((item) => item.deviceVerificationState === "real-device-unverified"));
  assert.equal(report.updater.state, "contract-ready");
  assert.equal(report.recovery.state, "contract-ready");
  assert.match(report.updater.reasons.join(" "), /real-device/);
  assert.match(report.updater.reasons.join(" "), /paired Android update metadata/);
  assert.ok(report.platforms.filter((item) => item.id.startsWith("android")).every((item) => item.blockers.every((blocker) => !blocker.includes("not implemented"))));
  assert.match(report.recovery.reasons.join(" "), /real-device-unverified/);
});

test("an artifact is built but remains unsigned and real-device-unverified", () => {
  const temporary = mkdtempSync(join(tmpdir(), "reelos-platform-status-"));
  try {
    mkdirSync(join(temporary, "dist-windows"), { recursive: true });
    writeFileSync(join(temporary, "dist-windows", "ReelOS.runtime.zip"), "fixture");
    const report = platformReleaseStatus({ root: temporary, hostPlatform: "win32", hostArch: "x64", env: {} });
    const windows = report.platforms.find((item) => item.id === "windows");
    assert.equal(windows.packagingState, "built");
    assert.match(windows.artifact.sha256, /^[a-f0-9]{64}$/);
    assert.equal(windows.artifact.bytes, 7);
    assert.equal(windows.signatureState, "unsigned");
    assert.equal(windows.deviceVerificationState, "real-device-unverified");
    assert.equal(windows.releaseReady, false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("a copied public APK is not accepted as an Android build receipt", () => {
  const temporary = mkdtempSync(join(tmpdir(), "reelos-platform-apk-"));
  try {
    mkdirSync(join(temporary, "public", "clients"), { recursive: true });
    writeFileSync(join(temporary, "public", "clients", "reelos-android-universal.apk"), "stale");
    const report = platformReleaseStatus({ root: temporary, hostPlatform: "win32", hostArch: "x64", env: {} });
    assert.equal(report.platforms.find((item) => item.id === "android").packagingState, "unavailable");
    assert.equal(report.platforms.find((item) => item.id === "android-tv").packagingState, "unavailable");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Android updater source requires a paired server, same-origin APK, and SHA-256", () => {
  const source = readFileSync(join(root, "clients/android/app/src/main/java/com/reelos/core/ota/OtaUpdateManager.kt"), "utf8");
  assert.match(source, /serverBaseUrl/);
  assert.match(source, /api\/app\/version/);
  assert.match(source, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(source, /download\.host == base\.host/);
  assert.match(source, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.doesNotMatch(source, /raw\.githubusercontent|github\.com\/ajt1995/);
  const gradleProperties = readFileSync(join(root, "clients/android/gradle.properties"), "utf8");
  assert.doesNotMatch(gradleProperties, /android\.builder\.sdkDownload\s*=\s*true/);
});

test("Android discovery confines cleartext probes to household addresses", () => {
  const source = readFileSync(join(root, "clients/android/app/src/main/java/com/reelos/core/discovery/ServerDiscovery.kt"), "utf8");
  assert.match(source, /supplied\.scheme == "http" && !isPrivateHouseholdHost/);
  assert.match(source, /octets\[0\] == 192 && octets\[1\] == 168/);
  assert.match(source, /octets\[0\] == 100 && octets\[1\] in 64\.\.127/);
});
