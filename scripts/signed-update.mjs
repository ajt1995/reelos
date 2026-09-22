import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defaultTrustStore, recordAcceptedRelease, verifyReleaseManifest } from "./release-trust.mjs";

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function digest(file) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }
function atomicJson(file, value) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
}
function readJson(file) { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null; }

export function verifyArtifact(file, receipt) {
  if (!file || !existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) fail("artifact_missing", "The update artifact is unavailable.");
  if (statSync(file).size !== receipt.bytes) fail("artifact_size", "The update artifact size does not match the signed manifest.");
  if (digest(file) !== receipt.sha256) fail("artifact_digest", "The update artifact digest does not match the signed manifest.");
  return true;
}

function validateArchiveEntry(entry) {
  const normalized = String(entry || "").replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").includes("..")) fail("archive_path", "The update archive contains an unsafe path.");
}

function rejectLinks(root) {
  for (const name of readdirSync(root)) {
    const candidate = join(root, name);
    const stat = lstatSync(candidate);
    if (stat.isSymbolicLink()) fail("archive_link", "Update archives may not contain links.");
    if (stat.isDirectory()) rejectLinks(candidate);
  }
}

export function extractArchive(archive, destination) {
  mkdirSync(destination, { recursive: false, mode: 0o700 });
  const listed = spawnSync("tar", ["-tvf", archive], { encoding: "utf8", timeout: 60_000 });
  if (listed.status !== 0) fail("archive_unreadable", "The update archive could not be inspected.");
  const listing = listed.stdout.split(/\r?\n/).filter(Boolean);
  if (listing.some((line) => /^[lh]/i.test(line.trim()))) fail("archive_link", "Update archives may not contain links.");
  const names = spawnSync("tar", ["-tf", archive], { encoding: "utf8", timeout: 60_000 });
  if (names.status !== 0) fail("archive_unreadable", "The update archive could not be inspected.");
  names.stdout.split(/\r?\n/).filter(Boolean).forEach(validateArchiveEntry);
  const extracted = spawnSync("tar", ["-xf", archive, "-C", destination], { encoding: "utf8", timeout: 180_000 });
  if (extracted.status !== 0) fail("archive_extract", "The update archive could not be staged.");
  rejectLinks(destination);
}

export function createServiceController({ platform = process.platform, serviceName = "reelos" } = {}) {
  const run = (command, args) => {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 60_000 });
    if (result.status !== 0) fail("service_control_failed", `${serviceName} could not be restarted.`);
  };
  if (platform === "linux") return { restart: () => run("systemctl", ["restart", `${serviceName}.service`]) };
  if (platform === "win32") return { restart: () => {
    const stopped = spawnSync("sc.exe", ["stop", serviceName], { encoding: "utf8", timeout: 60_000 });
    const stopText = `${stopped.stdout || ""}\n${stopped.stderr || ""}`;
    if (stopped.status !== 0 && !/(?:1062|has not been started)/i.test(stopText)) fail("service_control_failed", `${serviceName} could not be stopped.`);
    run("sc.exe", ["start", serviceName]);
  } };
  return { restart: () => fail("service_control_unavailable", "This platform has no supported ReelOS service controller.") };
}

export async function probeReleaseHealth({ url = "http://127.0.0.1:8080/api/ready", version, attempts = 20, intervalMs = 1500, fetchImpl = fetch } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (response.status === 200) {
        const body = await response.json();
        if (typeof body?.provisioned === "boolean" && body?.update?.local === version) return true;
      }
    } catch { /* unavailable until timeout */ }
    if (attempt + 1 < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
  }
  return false;
}

export async function applySignedUpdate({ manifest, artifactPath, stateDir, installDir, platform, architecture, unpack = extractArchive, serviceController = createServiceController({ platform }), healthCheck = probeReleaseHealth } = {}) {
  const trustStorePath = defaultTrustStore(stateDir);
  verifyReleaseManifest(manifest, { trustStorePath, platform, architecture });
  verifyArtifact(artifactPath, manifest.artifact);
  const releasesDir = join(installDir, "releases");
  const releaseName = manifest.release.version.replace(/[^A-Za-z0-9._-]/g, "_");
  const releaseDir = join(releasesDir, releaseName);
  const stagingDir = join(releasesDir, `.staging-${releaseName}-${process.pid}`);
  const currentFile = join(installDir, "current.json");
  const previousFile = join(installDir, "previous.json");
  const statusFile = join(stateDir, "update-status.json");
  if (existsSync(releaseDir) || existsSync(stagingDir)) fail("release_exists", "That release is already staged.");
  mkdirSync(releasesDir, { recursive: true, mode: 0o700 });
  atomicJson(statusFile, { state: "staging", version: manifest.release.version, updatedAt: new Date().toISOString() });
  try {
    unpack(artifactPath, stagingDir);
    if (!existsSync(join(stagingDir, "package.json"))) fail("release_layout", "The staged release is missing package.json.");
    renameSync(stagingDir, releaseDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    atomicJson(statusFile, { state: "failed", code: error.code || "stage_failed", version: manifest.release.version, updatedAt: new Date().toISOString() });
    throw error;
  }
  const oldCurrent = readJson(currentFile);
  if (oldCurrent) atomicJson(previousFile, oldCurrent);
  const next = { version: manifest.release.version, path: resolve(releaseDir), manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex") };
  atomicJson(currentFile, next);
  atomicJson(statusFile, { state: "health-check", version: next.version, updatedAt: new Date().toISOString() });
  try {
    serviceController.restart();
    if (!await healthCheck({ version: next.version })) fail("health_check_failed", "The staged release did not become healthy.");
    recordAcceptedRelease(trustStorePath, manifest);
    atomicJson(statusFile, { state: "active", version: next.version, previousVersion: oldCurrent?.version || null, updatedAt: new Date().toISOString() });
    return { ok: true, state: "active", version: next.version, releaseDir };
  } catch (activationError) {
    if (!oldCurrent) {
      atomicJson(statusFile, { state: "recovery-required", version: next.version, code: activationError.code || "activation_failed", updatedAt: new Date().toISOString() });
      throw Object.assign(new Error("Activation failed and no previous release is available."), { code: "recovery_required", cause: activationError });
    }
    atomicJson(currentFile, oldCurrent);
    try {
      serviceController.restart();
      if (!await healthCheck({ version: oldCurrent.version })) fail("rollback_health_failed", "The previous release did not become healthy after rollback.");
      atomicJson(statusFile, { state: "rolled-back", version: oldCurrent.version, rejectedVersion: next.version, updatedAt: new Date().toISOString() });
      throw Object.assign(new Error("The update failed its health gate and ReelOS rolled back."), { code: "update_rolled_back", cause: activationError });
    } catch (rollbackError) {
      if (rollbackError.code === "update_rolled_back") throw rollbackError;
      atomicJson(statusFile, { state: "recovery-required", version: oldCurrent.version, rejectedVersion: next.version, code: rollbackError.code || "rollback_failed", updatedAt: new Date().toISOString() });
      throw Object.assign(new Error("Update and rollback health checks failed; recovery is required."), { code: "recovery_required", cause: rollbackError });
    }
  }
}
