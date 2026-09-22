import { writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Atomically writes JSON data to a file by first writing to a temporary file
 * and then renaming it over the destination. This prevents 0-byte file corruption
 * during unexpected power losses or hard shutdowns.
 *
 * @param {string} filePath - Absolute path to the destination file
 * @param {any} data - Object to serialize or already-serialized string
 * @param {object} [options]
 * @param {number} [options.mode=0o600] - File permissions mode
 */
export function atomicWriteJsonSync(filePath, data, options = {}) {
  const mode = options.mode ?? 0o600;
  const dir = dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}

  const serialized = typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n";
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;

  try {
    writeFileSync(tempPath, serialized, { mode });
    renameSync(tempPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tempPath);
    } catch {}
    throw err;
  }
}
