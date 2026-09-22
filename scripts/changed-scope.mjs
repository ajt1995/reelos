import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildTestInventory } from "./test-inventory.mjs";

const root = resolve(import.meta.dirname, "..");
const jsonMode = process.argv.includes("--json");

function git(args) {
  const candidates = [
    process.platform === "win32" ? join(process.env.ProgramFiles ?? "", "Git", "cmd", "git.exe") : null,
    process.platform === "win32" ? join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe") : null,
    "git"
  ].filter((candidate) => candidate === "git" || existsSync(candidate));
  try {
    return execFileSync(candidates[0] ?? "git", ["-c", `safe.directory=${root}`, "-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const register = JSON.parse(readFileSync(join(root, "docs", "feature-register.json"), "utf8"));
const trackedChanges = git(["diff", "--name-only", "HEAD"]);
const untrackedChanges = git(["ls-files", "--others", "--exclude-standard"]);
if (trackedChanges === null || untrackedChanges === null) {
  console.error("Changed-scope check could not read Git state; refusing to report a clean scope.");
  process.exit(2);
}
const changed = [...new Set([
  ...trackedChanges.split(/\r?\n/),
  ...untrackedChanges.split(/\r?\n/)
].filter(Boolean))].sort();
const impactedFeatures = (register.features ?? []).filter((feature) => (feature.evidence ?? []).some((evidence) => changed.some((file) => file === evidence || file.startsWith(`${evidence}/`) || evidence.startsWith(`${file}/`))));
const inventory = buildTestInventory();
const relatedTests = inventory.tests.filter((test) => {
  const stem = test.file.replace(/\.test\.(?:mjs|ts)$/, "");
  return changed.some((file) => file.startsWith(stem.replace(/^scripts\//, "scripts/")) || stem.includes(file.replace(/\.(?:mjs|ts|tsx)$/, "")));
});
const report = {
  schema: "reelos-changed-scope/v1",
  changed,
  impactedFeatures: impactedFeatures.map((feature) => ({ id: feature.id, status: feature.status, acceptance: feature.acceptance })),
  relatedTests,
  requiredChecks: ["npm run context:check", "npm run audit:features", "npm run audit:tests", ...(impactedFeatures.some((feature) => feature.id === "sources-and-providers") ? ["npm run verify:public-release"] : []), ...(changed.some((file) => file.startsWith("src/")) ? ["npm run typecheck", "npm run test:release", "npm run build:dev"] : [])]
};

if (jsonMode) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else {
  console.log(`Changed scope: ${report.changed.length} files | ${report.impactedFeatures.length} features | ${report.relatedTests.length} directly related tests`);
  console.log(`Features: ${report.impactedFeatures.map((feature) => feature.id).join(", ") || "none from registered evidence"}`);
  console.log(`Checks: ${report.requiredChecks.join(" → ")}`);
}
