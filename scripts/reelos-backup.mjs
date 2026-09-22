/** Portable, credential-free ReelOS recovery bundles. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const RECOVERY_SCHEMA = "reelos-recovery/v1";
export const DEFAULT_BACKUP_DIR = "/var/lib/reelos/backups";
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const SAFE_ROOT_FILES = new Set(["profiles.json", "child-profiles.json", "library-shelf.json", "native-media-registry.json", "retention-ledger.json", "ui-settings.json", "books-state.json", "taste-feedback.json"]);
const SAFE_DIRS = new Set(["profiles", "books", "library", "taste"]);
const SECRET_KEY = /(?:pin(?:hash|salt)?|password|passwd|secret|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|private[_-]?key)$/i;

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function portable(path) { return path.split(sep).join("/"); }
function safeRelative(path) {
  const value = String(path || "").replaceAll("\\", "/");
  if (!value || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").includes("..")) return false;
  const parts = value.split("/");
  return (parts.length === 1 && SAFE_ROOT_FILES.has(parts[0])) || (parts.length > 1 && SAFE_DIRS.has(parts[0]) && parts.every((part) => /^[A-Za-z0-9._-]+$/.test(part)));
}
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEY.test(key)).map(([key, child]) => [key, sanitize(child)]));
}
function walk(root, current = root) {
  const files = [];
  if (!existsSync(current)) return files;
  for (const name of readdirSync(current)) {
    const file = join(current, name); const stat = lstatSync(file);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) files.push(...walk(root, file));
    else if (stat.isFile()) files.push({ file, relative: portable(relative(root, file)), bytes: stat.size });
  }
  return files;
}
function atomicJson(file, value) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
}

export function getBackupDir() { return process.env.REELOS_BACKUP_DIR || DEFAULT_BACKUP_DIR; }
export function generateBackupFileName(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
  return `reelos-recovery-${stamp}.json`;
}
export function listBackups(backupDir = getBackupDir()) {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir).filter((name) => name.startsWith("reelos-recovery-") && name.endsWith(".json")).map((file) => {
    const path = join(backupDir, file); const stat = statSync(path);
    return { file, path, size: stat.size, mtime: stat.mtime.toISOString() };
  }).sort((a, b) => b.mtime.localeCompare(a.mtime));
}
export function validateArchivePaths(paths) {
  const unsafe = paths.find((path) => !safeRelative(path));
  return unsafe ? { ok: false, error: `Unsafe recovery path: ${unsafe}` } : { ok: true };
}

export function createBackupSnapshot({ backupDir = getBackupDir(), stateDir = "/var/lib/reelos", targetFileName = null, now = new Date() } = {}) {
  const entries = []; let total = 0;
  for (const candidate of walk(stateDir).filter((entry) => safeRelative(entry.relative))) {
    if (candidate.bytes > MAX_FILE_BYTES) fail("recovery_file_too_large", `Recovery file is too large: ${candidate.relative}`);
    let parsed;
    try { parsed = JSON.parse(readFileSync(candidate.file, "utf8")); } catch { fail("recovery_json_invalid", `Recovery file is not valid JSON: ${candidate.relative}`); }
    const data = Buffer.from(`${JSON.stringify(sanitize(parsed), null, 2)}\n`);
    total += data.length;
    if (total > MAX_BUNDLE_BYTES) fail("recovery_bundle_too_large", "The recovery bundle exceeds the safe size limit.");
    entries.push({ path: candidate.relative, bytes: data.length, sha256: sha256(data), content: data.toString("base64") });
  }
  if (!entries.length) return { ok: false, error: "No credential-free recovery state is available." };
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const envelope = { schema: RECOVERY_SCHEMA, createdAt: now.toISOString(), credentialsIncluded: false, entries };
  envelope.bundleSha256 = sha256(JSON.stringify(entries));
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const file = targetFileName || generateBackupFileName(now);
  if (!/^reelos-recovery-[A-Za-z0-9._-]+\.json$/.test(file)) fail("recovery_filename", "The recovery filename is invalid.");
  const path = join(backupDir, file); atomicJson(path, envelope);
  return { ok: true, file, path, size: statSync(path).size, entries: entries.length, credentialsIncluded: false };
}

export function restoreBackupSnapshot({ archivePath, targetDir, confirmed = false, now = new Date() } = {}) {
  if (!confirmed) return { ok: false, code: "recovery_confirmation_required", error: "Recovery import requires explicit confirmation." };
  if (!archivePath || !existsSync(archivePath) || lstatSync(archivePath).isSymbolicLink()) return { ok: false, code: "recovery_missing", error: "Recovery bundle not found." };
  let bundle;
  try { bundle = JSON.parse(readFileSync(archivePath, "utf8")); } catch { return { ok: false, code: "recovery_invalid", error: "Recovery bundle is invalid." }; }
  if (bundle?.schema !== RECOVERY_SCHEMA || bundle.credentialsIncluded !== false || !Array.isArray(bundle.entries) || sha256(JSON.stringify(bundle.entries)) !== bundle.bundleSha256) return { ok: false, code: "recovery_invalid", error: "Recovery bundle validation failed." };
  const pathCheck = validateArchivePaths(bundle.entries.map((entry) => entry.path));
  if (!pathCheck.ok) return pathCheck;
  const decoded = []; let total = 0;
  try {
    for (const entry of bundle.entries) {
      const data = Buffer.from(entry.content, "base64"); total += data.length;
      if (data.length !== entry.bytes || data.length > MAX_FILE_BYTES || total > MAX_BUNDLE_BYTES || sha256(data) !== entry.sha256) fail("recovery_receipt", "A recovery entry failed its checksum.");
      const parsed = JSON.parse(data.toString("utf8"));
      if (JSON.stringify(sanitize(parsed)) !== JSON.stringify(parsed)) fail("recovery_secret", "A recovery entry contains credential fields.");
      decoded.push({ path: entry.path, data });
    }
  } catch (error) { return { ok: false, code: error.code || "recovery_invalid", error: error.message }; }
  const destination = resolve(targetDir);
  const backupDir = join(destination, `.recovery-import-backup-${now.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`);
  for (const entry of decoded) {
    const output = resolve(destination, ...entry.path.split("/"));
    if (!output.startsWith(`${destination}${sep}`)) return { ok: false, code: "recovery_path", error: "Recovery path escaped the state directory." };
    if (existsSync(output)) {
      const preserved = join(backupDir, ...entry.path.split("/")); mkdirSync(dirname(preserved), { recursive: true, mode: 0o700 });
      writeFileSync(preserved, readFileSync(output), { mode: 0o600 });
    }
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 }); writeFileSync(output, entry.data, { mode: 0o600 });
  }
  return { ok: true, restoredFilesCount: decoded.length, previousState: existsSync(backupDir) ? backupDir : null };
}
