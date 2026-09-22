/**
 * Downloads the optional local-concierge runtime and model pack without ever
 * registering, evaluating, or activating it.  The installed pack is external
 * machine state, not a source-controlled application artifact.
 */
import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync } from "node:fs";
import { open } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { atomicWriteJsonSync } from "./utils/fs-atomic.mjs";

const SHA256 = /^[a-f0-9]{64}$/;
const WINDOWS_RUNTIME = Object.freeze({
  id: "llama.cpp-b11065-win-cpu-x64",
  kind: "runtime",
  fileName: "llama-b11065-bin-win-cpu-x64.zip",
  url: "https://github.com/ggml-org/llama.cpp/releases/download/b11065/llama-b11065-bin-win-cpu-x64.zip",
  byteSize: 18_466_663,
  sha256: "33f941a74b8db38e92690f5f151a770ef5a66481c07dabfe2e505b57e3546807",
  license: Object.freeze({ id: "MIT", noticeUrl: "https://github.com/ggml-org/llama.cpp/blob/b11065/LICENSE" }),
});
const QWEN_CONCIERGE = Object.freeze({
  id: "qwen2.5-1.5b-instruct-q4-k-m",
  kind: "model",
  revision: "91cad51170dc346986eccefdc2dd33a9da36ead9",
  fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true",
  byteSize: 1_117_320_736,
  // SHA-256 of the actual GGUF bytes. The Xet ETag is a CAS identifier and
  // is deliberately not treated as a file digest.
  sha256: "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
  license: Object.freeze({ id: "Apache-2.0", noticeUrl: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/blob/91cad51170dc346986eccefdc2dd33a9da36ead9/LICENSE" }),
});

export const LOCAL_INTELLIGENCE_PACK = Object.freeze({ schemaVersion: 1, runtime: WINDOWS_RUNTIME, model: QWEN_CONCIERGE });

function fail(code, message, cause) {
  throw Object.assign(new Error(message), { code, ...(cause ? { cause } : {}) });
}

function safeRegularFile(path) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 ? stat : null;
  } catch { return null; }
}

export function sha256File(path) {
  const stat = safeRegularFile(path);
  if (!stat) return null;
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally { closeSync(descriptor); }
  return hash.digest("hex");
}

export function resolveLocalModelPackDirectory({ env = process.env, platform = process.platform, home = homedir() } = {}) {
  const explicit = env.REELOS_MODEL_PACK_DIR;
  if (explicit) {
    if (!isAbsolute(explicit)) fail("model_pack_directory_invalid", "REELOS_MODEL_PACK_DIR must be an absolute path.");
    return resolve(explicit);
  }
  if (platform === "win32") return resolve(env.LOCALAPPDATA || join(home, "AppData", "Local"), "ReelOS", "model-packs");
  if (platform === "darwin") return resolve(home, "Library", "Application Support", "ReelOS", "model-packs");
  return resolve(env.XDG_STATE_HOME || join(home, ".local", "state"), "reelos", "model-packs");
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || typeof artifact.id !== "string" || typeof artifact.fileName !== "string"
    || typeof artifact.url !== "string" || !artifact.url.startsWith("https://") || !Number.isSafeInteger(artifact.byteSize)
    || artifact.byteSize < 1 || !SHA256.test(artifact.sha256 || "")) {
    fail("model_pack_manifest_invalid", "The local model-pack pin is invalid.");
  }
}

function existingIntegrity(path, artifact) {
  const stat = safeRegularFile(path);
  if (!stat) return { present: false, valid: false };
  if (stat.size !== artifact.byteSize) return { present: true, valid: false, reason: "size" };
  return { present: true, valid: sha256File(path) === artifact.sha256, reason: "hash" };
}

function temporarySibling(target) {
  return `${target}.partial-${process.pid}-${randomBytes(8).toString("hex")}`;
}

async function responseReader(response, expectedBytes) {
  if (!response?.ok) fail("model_pack_download_failed", `Download failed with HTTP ${response?.status ?? "unknown"}.`);
  const header = response.headers?.get?.("content-length");
  if (header && Number(header) !== expectedBytes) fail("model_pack_content_length_mismatch", "Download content length does not match the pinned artifact.");
  if (response.body?.getReader) return response.body.getReader();
  // Keep test doubles convenient without allowing a real multi-gigabyte model
  // download to buffer in memory.
  if (expectedBytes > 32 * 1024 * 1024) fail("model_pack_stream_required", "The model server did not provide a streaming response.");
  const body = new Uint8Array(await response.arrayBuffer());
  let sent = false;
  return { async read() { if (sent) return { done: true }; sent = true; return { done: false, value: body }; }, async cancel() {} };
}

/** Download to a same-volume staging file, verify it, then atomically rename it. */
export async function downloadVerifiedArtifact({ artifact, target, fetchImpl = globalThis.fetch } = {}) {
  validateArtifact(artifact);
  if (typeof target !== "string" || !isAbsolute(target)) fail("model_pack_target_invalid", "Model-pack targets must be absolute paths.");
  if (typeof fetchImpl !== "function") fail("model_pack_fetch_unavailable", "A network download function is unavailable.");
  const current = existingIntegrity(target, artifact);
  if (current.valid) return Object.freeze({ path: target, reused: true, byteSize: artifact.byteSize, sha256: artifact.sha256 });
  if (current.present) fail("model_pack_existing_file_invalid", `Refusing to overwrite an invalid existing artifact: ${basename(target)}.`);

  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const staged = temporarySibling(target);
  let handle = null;
  let reader = null;
  try {
    const response = await fetchImpl(artifact.url, { redirect: "follow" });
    reader = await responseReader(response, artifact.byteSize);
    handle = await open(staged, "wx", 0o600);
    const hash = createHash("sha256");
    let written = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      written += chunk.byteLength;
      if (written > artifact.byteSize) fail("model_pack_size_mismatch", "Download exceeded its pinned size.");
      hash.update(chunk);
      await handle.write(chunk);
    }
    await handle.sync();
    await handle.close();
    handle = null;
    const digest = hash.digest("hex");
    if (written !== artifact.byteSize) fail("model_pack_size_mismatch", "Download size does not match its pinned size.");
    if (digest !== artifact.sha256) fail("model_pack_hash_mismatch", "Download digest does not match its pinned digest.");
    renameSync(staged, target);
    return Object.freeze({ path: target, reused: false, byteSize: written, sha256: digest });
  } catch (error) {
    try { await reader?.cancel?.(); } catch {}
    throw error;
  } finally {
    try { await handle?.close(); } catch {}
    try { rmSync(staged, { force: true }); } catch {}
  }
}

function findRuntimeExecutable(directory) {
  const expected = process.platform === "win32" ? "llama-cli.exe" : "llama-cli";
  const pending = [directory];
  let visited = 0;
  while (pending.length && visited < 800) {
    const current = pending.shift();
    let entries = [];
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      visited += 1;
      if (visited > 800) break;
      const candidate = join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile() && entry.name.toLowerCase() === expected) return candidate;
      if (entry.isDirectory()) pending.push(candidate);
    }
  }
  return null;
}

function defaultUnpackZip(archive, destination) {
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  try {
    execFileSync(process.platform === "win32" ? "tar.exe" : "tar", ["-xf", archive, "-C", destination], { stdio: "ignore", windowsHide: true });
  } catch (error) {
    fail("model_pack_runtime_extract_failed", "Could not unpack the verified llama.cpp runtime archive.", error);
  }
}

function validRuntimeInstall(runtimeDir, runtime) {
  const receiptPath = join(runtimeDir, "runtime-install.json");
  try {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    if (receipt?.runtime?.sha256 !== runtime.sha256 || receipt?.runtime?.byteSize !== runtime.byteSize || typeof receipt.executableRelative !== "string") return null;
    const executable = resolve(runtimeDir, receipt.executableRelative);
    if (!executable.startsWith(`${resolve(runtimeDir)}${process.platform === "win32" ? "\\" : "/"}`) || !safeRegularFile(executable)) return null;
    return executable;
  } catch { return null; }
}

export function installVerifiedRuntime({ packDir, archivePath, runtime = WINDOWS_RUNTIME, unpackZip = defaultUnpackZip } = {}) {
  if (!isAbsolute(packDir) || !isAbsolute(archivePath) || typeof unpackZip !== "function") fail("model_pack_runtime_configuration_invalid", "Runtime installation requires absolute local paths.");
  const runtimeDir = join(packDir, "runtime", runtime.id);
  const existing = validRuntimeInstall(runtimeDir, runtime);
  if (existing) return Object.freeze({ directory: runtimeDir, executable: existing, reused: true });
  if (existsSync(runtimeDir)) fail("model_pack_runtime_existing_invalid", "Refusing to overwrite an invalid existing runtime installation.");
  const staged = temporarySibling(runtimeDir);
  try {
    unpackZip(archivePath, staged);
    const executable = findRuntimeExecutable(staged);
    if (!executable) fail("model_pack_runtime_executable_missing", "The verified runtime archive did not contain llama-cli.");
    const executableRelative = relative(staged, executable);
    atomicWriteJsonSync(join(staged, "runtime-install.json"), {
      schemaVersion: 1, runtime: { id: runtime.id, url: runtime.url, byteSize: runtime.byteSize, sha256: runtime.sha256 },
      executableRelative, unpackedAt: new Date().toISOString(),
      status: "installed_not_registered_or_activated",
    }, { mode: 0o600 });
    renameSync(staged, runtimeDir);
    return Object.freeze({ directory: runtimeDir, executable: join(runtimeDir, executableRelative), reused: false });
  } catch (error) {
    try { rmSync(staged, { recursive: true, force: true }); } catch {}
    throw error;
  }
}

function writeReceipts(packDir, installation, { runtime, model }) {
  const licenses = [runtime, model].map((artifact) => ({
    artifactId: artifact.id, license: artifact.license.id, noticeUrl: artifact.license.noticeUrl,
    sourceUrl: artifact.url, ...(artifact.revision ? { revision: artifact.revision } : {}),
  }));
  atomicWriteJsonSync(join(packDir, "LICENSE-NOTICES.json"), {
    schemaVersion: 1, generatedAt: new Date().toISOString(), notices: licenses,
    note: "This receipt identifies upstream licenses. It is not a model evaluation, registration, or activation record.",
  }, { mode: 0o600 });
  atomicWriteJsonSync(join(packDir, "install-receipt.json"), {
    schemaVersion: 1, generatedAt: new Date().toISOString(), status: "downloaded_not_registered_or_activated",
    runtime: { ...installation.runtime, path: installation.runtime.path },
    model: { ...installation.model, path: installation.model.path },
    nextStep: "A separately signed artifact manifest, verification, and evaluation are required before any capability can activate this pack.",
  }, { mode: 0o600 });
}

/**
 * Installs the exact, public default pack. It deliberately never writes a
 * model-artifact registry entry and never starts any executable.
 */
export async function installLocalIntelligencePack({
  packDir = resolveLocalModelPackDirectory(), fetchImpl = globalThis.fetch, unpackZip = defaultUnpackZip,
  platform = process.platform, artifacts = LOCAL_INTELLIGENCE_PACK,
} = {}) {
  if (platform !== "win32") fail("model_pack_platform_unsupported", "The pinned local concierge runtime is currently available only for Windows x64.");
  if (!isAbsolute(packDir)) fail("model_pack_directory_invalid", "The local model-pack directory must be absolute.");
  const runtime = artifacts.runtime;
  const model = artifacts.model;
  validateArtifact(runtime);
  validateArtifact(model);
  mkdirSync(packDir, { recursive: true, mode: 0o700 });
  const runtimeArchive = await downloadVerifiedArtifact({ artifact: runtime, target: join(packDir, "downloads", runtime.fileName), fetchImpl });
  const installedRuntime = installVerifiedRuntime({ packDir, archivePath: runtimeArchive.path, runtime, unpackZip });
  const installedModel = await downloadVerifiedArtifact({ artifact: model, target: join(packDir, "models", model.id, model.fileName), fetchImpl });
  const result = Object.freeze({
    packDir, status: "downloaded_not_registered_or_activated",
    runtime: Object.freeze({ ...runtimeArchive, directory: installedRuntime.directory, executable: installedRuntime.executable, runtimeReused: installedRuntime.reused }),
    model: Object.freeze(installedModel),
  });
  writeReceipts(packDir, result, { runtime, model });
  return result;
}

function parseCli(argv) {
  const args = [...argv];
  let packDir = null;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--dir") packDir = args.shift() || fail("model_pack_cli_invalid", "--dir requires an absolute path.");
    else if (arg === "--help") return { help: true };
    else fail("model_pack_cli_invalid", `Unknown argument: ${arg}`);
  }
  return { packDir };
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      console.log("Usage: npm run intelligence:install-pack -- [--dir ABSOLUTE_PATH]");
    } else {
      const result = await installLocalIntelligencePack({ ...(options.packDir ? { packDir: options.packDir } : {}) });
      console.log(JSON.stringify({ status: result.status, packDir: result.packDir, runtime: result.runtime.path, model: result.model.path }, null, 2));
    }
  } catch (error) {
    console.error(`[reelos-model-pack] ${error.code || "model_pack_failed"}: ${error.message}`);
    process.exitCode = 1;
  }
}
