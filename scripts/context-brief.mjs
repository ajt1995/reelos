import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { buildNeuralArchitectureReport, validateNeuralArchitecture } from "./neural-architecture.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const jsonMode = process.argv.includes("--json");
const checkMode = process.argv.includes("--check");
const gitCandidates = [
  process.platform === "win32" ? join(process.env.ProgramFiles ?? "", "Git", "cmd", "git.exe") : null,
  process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "cmd", "git.exe") : null,
  process.platform === "win32" ? join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe") : null,
  "git"
].filter(Boolean);

function resolveGit() {
  return gitCandidates.find((candidate) => candidate === "git" || existsSync(candidate)) ?? "git";
}

const gitExecutable = resolveGit();

function git(args) {
  try {
    return execFileSync(gitExecutable, ["-c", `safe.directory=${root}`, "-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readAudit(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) return null;
  try {
    const report = readJson(path);
    return { path: relativePath, generatedAt: report.generatedAt ?? new Date(statSync(path).mtimeMs).toISOString(), summary: report.summary ?? null };
  } catch {
    return { path: relativePath, malformed: true };
  }
}

function boundedLines(value, max) {
  const lines = value ? value.split(/\r?\n/).filter(Boolean) : [];
  return { items: lines.slice(0, max), omitted: Math.max(0, lines.length - max) };
}

function selectedScripts(scripts) {
  const names = ["context:brief", "context:check", "architecture:report", "architecture:check", "audit:features", "audit:vision", "audit:tests", "scope:changed", "doctor", "verify:public-release", "typecheck", "build:dev", "test:release", "test:all", "preflight"];
  return Object.fromEntries(names.filter((name) => scripts[name]).map((name) => [name, scripts[name]]));
}

export function buildContext() {
  const pkg = readJson(join(root, "package.json"));
  const register = readJson(join(root, "docs", "feature-register.json"));
  const decisions = readJson(join(root, "docs", "agent-context", "active-decisions.json"));
  const workstreams = readJson(join(root, "docs", "agent-context", "workstreams.json"));
  const statusRaw = git(["status", "--short"]);
  const branchRaw = git(["branch", "--show-current"]);
  const headRaw = git(["rev-parse", "--short", "HEAD"]);
  const commitsRaw = git(["log", "--oneline", "-5"]);
  const gitAvailable = [statusRaw, branchRaw, headRaw, commitsRaw].every(
    (value) => value !== null,
  );
  const status = boundedLines(statusRaw, 12);
  const commits = boundedLines(commitsRaw, 5);
  const features = register.features ?? [];
  const active = features.filter((feature) => feature.status === "active");
  const parked = features.filter((feature) => feature.status === "parked");
  const architecture = buildNeuralArchitectureReport();

  return {
    schema: "reelos-agent-context/v1",
    generatedAt: new Date().toISOString(),
    repository: {
      name: pkg.name,
      version: pkg.version,
      gitAvailable,
      branch: branchRaw || "unavailable",
      head: headRaw || "unavailable",
      workingTree: status.items,
      workingTreeOmitted: status.omitted,
      recentCommits: commits.items
    },
    scope: {
      activeFeatures: active.map((feature) => feature.id),
      parkedFeatures: parked.map((feature) => feature.id),
      decisionIds: (decisions.decisions ?? []).map((decision) => decision.id)
    },
    workstreams: {
      canonicalBranch: workstreams.canonicalBranch ?? null,
      integrationRule: workstreams.integrationRule ?? null,
      active: workstreams.active ?? []
    },
    architecture: {
      identity: architecture.systemStatement,
      dataFlow: architecture.dataFlow,
      registeredCapabilities: architecture.summary.registered,
      coordinatorConnected: architecture.summary.coordinatorConnected,
      fallbackCapabilities: architecture.summary.fallback,
      shadowCapabilities: architecture.summary.shadow,
      retirementEntries: architecture.summary.retirementEntries
    },
    startHere: {
      interface: ["src/experience/reelos-world.tsx", "src/experience/experience-state.ts", "src/experience/source-access.ts"],
      consumerScope: ["docs/feature-register.json", "docs/agent-context/active-decisions.json"],
      neuralSystem: ["docs/agent-context/neural-capabilities.json", "scripts/services/reel-intelligence-system.mjs", "scripts/services/intelligence-coordinator.mjs"],
      legacyBoundary: ["docs/agent-context/legacy-retirement.json"],
      testsAndPolicy: ["scripts/feature-contract.mjs", "scripts/verify-public-release.mjs"],
      workstreams: ["docs/agent-context/workstreams.json"],
      historicalOnly: decisions.historicalSources ?? []
    },
    validation: selectedScripts(pkg.scripts ?? {}),
    localAudits: [
      readAudit(".reelos-audit/feature-contract.json"),
      readAudit(".reelos-audit/release-tests-in-process.json"),
      readAudit(".reelos-audit/feature-acceptance-current.json"),
      readAudit(".reelos-audit/ship-intelligence.json")
    ].filter(Boolean)
  };
}

export function validateContext(context) {
  const failures = [];
  if (!existsSync(join(root, "AGENTS.md"))) failures.push("missing AGENTS.md");
  if (context.scope.decisionIds.length === 0) failures.push("no active decisions");
  if (context.scope.activeFeatures.length === 0) failures.push("no active feature registrations");
  if (!context.repository.gitAvailable) {
    failures.push("Git state unavailable; run `git status --short --branch` and `git log -5 --oneline` directly before editing");
  }
  const allowedStatuses = new Set(["active", "waiting", "blocked"]);
  const ids = new Set();
  const branches = new Set();
  for (const stream of context.workstreams.active) {
    if (!stream.id || ids.has(stream.id)) failures.push(`invalid or duplicate workstream id: ${stream.id ?? "missing"}`);
    if (!stream.owner) failures.push(`workstream ${stream.id ?? "missing"} has no owner`);
    if (!stream.branch || branches.has(stream.branch)) failures.push(`invalid or duplicate workstream branch: ${stream.branch ?? "missing"}`);
    if (!stream.checkpoint) failures.push(`workstream ${stream.id ?? "missing"} has no checkpoint`);
    if (!allowedStatuses.has(stream.status)) failures.push(`workstream ${stream.id ?? "missing"} has invalid status: ${stream.status ?? "missing"}`);
    ids.add(stream.id);
    branches.add(stream.branch);
  }
  for (const section of Object.values(context.startHere)) {
    for (const path of section) if (!existsSync(join(root, path))) failures.push(`missing context target: ${path}`);
  }
  failures.push(...validateNeuralArchitecture(buildNeuralArchitectureReport()));
  return failures;
}

function humanBrief(context) {
  const tree = !context.repository.gitAvailable
    ? "unavailable (Git command blocked; do not infer a clean tree)"
    : context.repository.workingTree.length
      ? context.repository.workingTree.join("; ")
      : "clean";
  const trimmedTree = context.repository.workingTreeOmitted ? `${tree}; +${context.repository.workingTreeOmitted} more` : tree;
  const recent = context.repository.recentCommits.join(" | ") || "unavailable";
  const audits = context.localAudits.length
    ? context.localAudits.map((audit) => `${audit.path}${audit.malformed ? " (malformed)" : ` (${audit.generatedAt})`}`).join("; ")
    : "none yet";
  const streams = context.workstreams.active.length
    ? context.workstreams.active.map((stream) => `${stream.id} [${stream.status}] ${stream.branch} from ${stream.checkpoint}`).join("; ")
    : "none";
  return [
    `ReelOS context brief — ${context.repository.name}@${context.repository.version}`,
    `Git: ${context.repository.branch} @ ${context.repository.head}; working tree: ${trimmedTree}`,
    `Recent: ${recent}`,
    `Feature scope: ${context.scope.activeFeatures.length} active (${context.scope.activeFeatures.join(", ")}); ${context.scope.parkedFeatures.length} parked (${context.scope.parkedFeatures.join(", ") || "none"})`,
    `Durable decisions: ${context.scope.decisionIds.join(", ")}`,
    `Architecture: ${context.architecture.identity}`,
    `Neural wiring: ${context.architecture.registeredCapabilities} registered; ${context.architecture.coordinatorConnected} coordinator-connected; ${context.architecture.fallbackCapabilities} fallback; ${context.architecture.shadowCapabilities} shadow.`,
    `Active workstreams: ${streams}`,
    `Start interface work: ${context.startHere.interface.join(", ")}`,
    `Start scope/policy work: ${context.startHere.consumerScope.join(", ")}`,
    `Do not begin with historical files: ${context.startHere.historicalOnly.join(", ")}`,
    `Useful checks: ${Object.keys(context.validation).join(", ")}`,
    `Local audit snapshots: ${audits}`,
    ...(!context.repository.gitAvailable ? ["Git fallback: run `git status --short --branch` and `git log -5 --oneline` directly; do not assume a clean tree."] : []),
    "Authority: current code/tests → feature register → active decisions → this generated brief → historical records."
  ].join("\n");
}

const context = buildContext();
const failures = validateContext(context);
if (checkMode) {
  if (failures.length) {
    console.error(`Context check failed: ${failures.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Context check passed: ${context.scope.activeFeatures.length} active features, ${context.scope.decisionIds.length} durable decisions, ${context.architecture.registeredCapabilities} neural capabilities (${context.architecture.coordinatorConnected} coordinator-connected).`);
  }
} else if (jsonMode) {
  process.stdout.write(JSON.stringify({ ...context, validationFailures: failures }, null, 2) + "\n");
} else {
  console.log(humanBrief(context));
  if (failures.length) console.log(`Context warnings: ${failures.join("; ")}`);
}
