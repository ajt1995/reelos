#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "..");

function present(root, path) {
  return existsSync(join(root, ...path.split("/")));
}

function artifactEvidence(root, paths) {
  const path = paths.find((candidate) => present(root, candidate));
  if (!path) return { state: "unavailable", path: null, sha256: null, bytes: null };
  const absolute = join(root, ...path.split("/"));
  const bytes = statSync(absolute).size;
  const sha256 = createHash("sha256").update(readFileSync(absolute)).digest("hex");
  return { state: "built", path, sha256, bytes };
}

function record({ id, artifact, signature = "unsigned", notarization = "not-applicable", blockers }) {
  return Object.freeze({
    id,
    packagingState: artifact.state,
    artifact: { path: artifact.path, sha256: artifact.sha256, bytes: artifact.bytes },
    signatureState: artifact.state === "built" ? signature : "unavailable",
    notarizationState: artifact.state === "built" ? notarization : "unavailable",
    deviceVerificationState: "real-device-unverified",
    releaseReady: false,
    blockers,
  });
}

export function platformReleaseStatus({ root = DEFAULT_ROOT, hostPlatform = process.platform, hostArch = process.arch, env = process.env } = {}) {
  const windowsArtifact = artifactEvidence(root, ["dist-windows/ReelOS.runtime.zip"]);
  const macArtifact = artifactEvidence(root, ["dist-macos/ReelOS-Mac.app/Contents/Resources/reelos-runtime/bundle-manifest.json"]);
  // A copied/public APK is not build evidence: it may be stale and has no
  // Gradle provenance. Only the release task's canonical output counts here.
  const androidArtifact = artifactEvidence(root, ["clients/android/app/build/outputs/apk/release/app-release.apk"]);
  const linuxArtifact = artifactEvidence(root, ["public/install/reelos-native.zip"]);
  const androidToolchain = Boolean(env.ANDROID_HOME || env.ANDROID_SDK_ROOT);

  const platforms = [
    record({
      id: "linux",
      artifact: linuxArtifact,
      blockers: [
        ...(linuxArtifact.state === "built" ? [] : ["native Linux bundle has not been built in this checkout"]),
        "no externally signed Linux release candidate has been supplied",
        "native install, OTA, rollback, and recovery need a real Linux target",
      ],
    }),
    record({
      id: "windows",
      artifact: windowsArtifact,
      blockers: [
        ...(windowsArtifact.state === "built" ? [] : ["Windows runtime bundle has not been built in this checkout"]),
        "the current output is an unsigned runtime ZIP, not a signed self-contained installer",
        "service install, update, rollback, and uninstall need a real Windows acceptance run",
      ],
    }),
    record({
      id: "macos-apple-silicon",
      artifact: macArtifact,
      notarization: "unnotarized",
      blockers: [
        ...(macArtifact.state === "built" ? [] : ["Apple Silicon app bundle has not been built in this checkout"]),
        ...(hostPlatform === "darwin" && hostArch === "arm64" ? [] : ["packaging requires a native Apple Silicon Mac"]),
        "Apple Developer signing and notarization have not been performed",
        "launch, update, rollback, and uninstall need a real Mac acceptance run",
      ],
    }),
    ...["android", "android-tv"].map((id) => record({
      id,
      artifact: androidArtifact,
      blockers: [
        ...(androidArtifact.state === "built" ? [] : ["signed release APK has not been built in this checkout"]),
        ...(androidToolchain ? [] : ["Android SDK location is not configured"]),
        "release keystore is external and was not provided",
        `${id === "android-tv" ? "TV" : "phone/tablet"} install, pairing, playback, and update need a real-device run`,
      ],
    })),
  ];

  return Object.freeze({
    schema: "reelos-platform-release-status/v1",
    generatedAt: new Date().toISOString(),
    host: { platform: hostPlatform, arch: hostArch },
    summary: {
      built: platforms.filter((item) => item.packagingState === "built").length,
      releaseReady: platforms.filter((item) => item.releaseReady).length,
      total: platforms.length,
    },
    platforms,
    updater: {
      state: "contract-ready",
      reasons: [
        "signed Ed25519 manifests, artifact receipts, staging, version-matched health gates, and automatic pointer rollback are implemented",
        "paired Android update metadata and same-origin digest-addressed APK delivery are implemented; installed-signer continuity remains device-verified only",
        "release trust remains unavailable until an owner manually pins an externally supplied public key",
        "no supported platform has completed a signed real-device update and rollback run",
      ],
    },
    recovery: {
      state: "contract-ready",
      reasons: [
        "credential-free allowlisted export/import, checksums, confirmation, and pre-import preservation are implemented",
        "recovery remains real-device-unverified on Windows and Linux",
      ],
    },
  });
}

export function validatePlatformReleaseStatus(report) {
  if (report?.schema !== "reelos-platform-release-status/v1") throw new Error("Invalid platform release status schema.");
  const ids = report.platforms?.map((item) => item.id) || [];
  for (const required of ["linux", "windows", "macos-apple-silicon", "android", "android-tv"]) {
    if (!ids.includes(required)) throw new Error(`Platform release status is missing ${required}.`);
  }
  for (const item of report.platforms) {
    if (!["built", "unavailable"].includes(item.packagingState)) throw new Error(`${item.id} has an invalid packaging state.`);
    if (item.packagingState === "built" && (!item.artifact?.path || !/^[a-f0-9]{64}$/.test(item.artifact?.sha256 || "") || item.artifact?.bytes < 1)) {
      throw new Error(`${item.id} lacks artifact digest evidence.`);
    }
    if (!["unsigned", "unavailable"].includes(item.signatureState)) throw new Error(`${item.id} has an invalid signature state.`);
    if (!["unnotarized", "not-applicable", "unavailable"].includes(item.notarizationState)) throw new Error(`${item.id} has an invalid notarization state.`);
    if (item.deviceVerificationState !== "real-device-unverified") throw new Error(`${item.id} improperly claims device verification.`);
    if (item.releaseReady || !Array.isArray(item.blockers) || item.blockers.length === 0) throw new Error(`${item.id} improperly claims release readiness.`);
  }
  if (!['contract-ready', 'unavailable'].includes(report.updater?.state)) throw new Error("Updater has an invalid state.");
  if (!['contract-ready', 'unavailable'].includes(report.recovery?.state)) throw new Error("Recovery has an invalid state.");
  return report;
}

function main() {
  const rootArg = process.argv.indexOf("--root");
  const root = rootArg >= 0 ? resolve(process.argv[rootArg + 1]) : DEFAULT_ROOT;
  const report = validatePlatformReleaseStatus(platformReleaseStatus({ root }));
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const output = join(root, ".reelos-audit", "platform-release-status.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Platform release truth: ${report.summary.built}/${report.summary.total} artifacts built; 0 certified.\n`);
  for (const item of report.platforms) {
    process.stdout.write(`${item.id}: ${item.packagingState}, ${item.signatureState}, ${item.notarizationState}, ${item.deviceVerificationState}\n`);
  }
  process.stdout.write(`Evidence: ${output}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
