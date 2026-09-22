import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let resolved;

/**
 * Resolve a real Python interpreter for executable contract tests.
 *
 * Linux appliances normally expose `python3`. Windows contributors may have
 * `python`, or may be running inside the Codex desktop runtime whose Python is
 * intentionally not added to the global PATH. We probe rather than skipping:
 * a missing interpreter remains a loud test failure with an actionable error.
 */
export function pythonBin() {
  if (resolved) return resolved;
  const bundled = join(
    homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    process.platform === "win32" ? "python.exe" : "bin/python3",
  );
  const candidates = [
    process.env.PYTHON,
    existsSync(bundled) ? bundled : null,
    process.platform === "win32" ? "python" : "python3",
    process.platform === "win32" ? "python3" : "python",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (probe.status === 0) {
      resolved = candidate;
      return resolved;
    }
  }
  throw new Error(
    "Python 3 is required for ReelOS appliance contract tests. Set the PYTHON environment variable to its executable.",
  );
}
