import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = join(root, "docs", "agent-context", "neural-capabilities.json");
const retirementPath = join(root, "docs", "agent-context", "legacy-retirement.json");
const runtimePath = join(root, "scripts", "services", "reel-intelligence-system.mjs");
const specialistsPath = join(root, "scripts", "services", "shipping-intelligence-specialists.mjs");
const lifecycleStates = new Set(["offline", "fallback", "shadow", "assisted", "autonomous"]);
const requiredText = ["id", "owner", "purpose", "lifecycle", "fallback", "privacy", "resourceBudget", "coordinatorRoute"];
const requiredLists = ["inputs", "outputs", "tests", "evidence"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

function runtimeCapabilities() {
  const source = readFileSync(runtimePath, "utf8");
  const declaration = source.match(/REEL_INTELLIGENCE_CAPABILITIES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
  if (!declaration) return [];
  return [...declaration[1].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)]
    .map((match) => ({ id: match[1], scope: match[2] }));
}

function connectedSpecialists() {
  const source = readFileSync(specialistsPath, "utf8");
  return [...source.matchAll(/registerSpecialist\("([^"]+)"/g)].map((match) => match[1]);
}

export function buildNeuralArchitectureReport() {
  const manifest = readJson(manifestPath);
  const retirement = readJson(retirementPath);
  const runtime = runtimeCapabilities();
  const connected = connectedSpecialists();
  const annotations = new Map((manifest.capabilities ?? []).map((capability) => [capability.id, capability]));
  const capabilities = runtime.map(({ id, scope }) => {
    const annotation = annotations.get(id) ?? { id };
    return {
      ...annotation,
      scope,
      registered: true,
      coordinatorConnected: connected.includes(id),
    };
  });
  return {
    schema: "reelos-neural-architecture/v1",
    systemStatement: manifest.systemStatement,
    dataFlow: manifest.dataFlow,
    summary: {
      registered: runtime.length,
      coordinatorConnected: capabilities.filter((capability) => capability.coordinatorConnected).length,
      fallback: capabilities.filter((capability) => capability.lifecycle === "fallback").length,
      shadow: capabilities.filter((capability) => capability.lifecycle === "shadow").length,
      retirementEntries: retirement.entries?.length ?? 0,
    },
    capabilities,
    retirement: retirement.entries ?? [],
  };
}

export function validateNeuralArchitecture(report) {
  const failures = [];
  const manifest = readJson(manifestPath);
  const runtimeIds = new Set(report.capabilities.map((capability) => capability.id));
  const manifestIds = new Set((manifest.capabilities ?? []).map((capability) => capability.id));
  const connected = new Set(connectedSpecialists());

  if (!report.systemStatement?.includes("one end-to-end local neural system")) failures.push("system statement does not define the end-to-end local neural system");
  if (!Array.isArray(report.dataFlow) || report.dataFlow.length < 8) failures.push("neural data flow is missing or incomplete");
  for (const id of runtimeIds) if (!manifestIds.has(id)) failures.push(`runtime capability lacks context metadata: ${id}`);
  for (const id of manifestIds) if (!runtimeIds.has(id)) failures.push(`context metadata has no runtime capability: ${id}`);

  for (const capability of manifest.capabilities ?? []) {
    for (const field of requiredText) {
      if (typeof capability[field] !== "string" || !capability[field].trim()) failures.push(`${capability.id || "unknown"} missing ${field}`);
    }
    for (const field of requiredLists) {
      if (!Array.isArray(capability[field]) || capability[field].length === 0) failures.push(`${capability.id || "unknown"} missing ${field}`);
    }
    if (!lifecycleStates.has(capability.lifecycle)) failures.push(`${capability.id} has invalid lifecycle: ${capability.lifecycle}`);
    if (connected.has(capability.id) && capability.coordinatorRoute !== capability.id) failures.push(`${capability.id} is connected but its coordinatorRoute is not authoritative`);
    if (!connected.has(capability.id) && capability.coordinatorRoute !== "not-connected") failures.push(`${capability.id} claims a coordinator route that is not registered`);
    for (const file of [...(capability.tests ?? []), ...(capability.evidence ?? [])]) {
      if (!existsSync(join(root, normalizedPath(file)))) failures.push(`${capability.id} references missing evidence: ${file}`);
    }
  }

  const retirementIds = new Set();
  for (const entry of report.retirement) {
    if (!entry.id || retirementIds.has(entry.id)) failures.push(`duplicate or missing retirement id: ${entry.id || "unknown"}`);
    retirementIds.add(entry.id);
    if (!Array.isArray(entry.patterns) || entry.patterns.length === 0) failures.push(`${entry.id} missing retirement patterns`);
    if (!["retired", "migration-only", "active-shim"].includes(entry.disposition)) failures.push(`${entry.id} has invalid retirement disposition`);
    for (const file of entry.testEvidence ?? []) {
      if (!existsSync(join(root, normalizedPath(file)))) failures.push(`${entry.id} references missing retirement evidence: ${file}`);
    }
  }
  return [...new Set(failures)];
}

function humanReport(report) {
  const lines = [
    report.systemStatement,
    `Flow: ${report.dataFlow.join(" -> ")}`,
    `Capabilities: ${report.summary.registered} registered; ${report.summary.coordinatorConnected} coordinator-connected; ${report.summary.fallback} fallback; ${report.summary.shadow} shadow.`,
    "",
    "Capability | Stage | Coordinator | Owner | Fallback",
    "--- | --- | --- | --- | ---",
    ...report.capabilities.map((capability) => `${capability.id} | ${capability.lifecycle} | ${capability.coordinatorConnected ? capability.coordinatorRoute : "not connected"} | ${capability.owner} | ${capability.fallback}`),
    "",
    `Legacy retirement: ${report.retirement.map((entry) => `${entry.id}=${entry.disposition}`).join("; ")}`,
  ];
  return lines.join("\n");
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "neural-architecture.mjs");
if (invokedDirectly) {
  const report = buildNeuralArchitectureReport();
  const failures = validateNeuralArchitecture(report);
  if (process.argv.includes("--check")) {
    if (failures.length) {
      console.error(`Neural architecture check failed:\n- ${failures.join("\n- ")}`);
      process.exitCode = 1;
    } else {
      console.log(`Neural architecture check passed: ${report.summary.registered} registered, ${report.summary.coordinatorConnected} coordinator-connected, ${report.summary.shadow} shadow.`);
    }
  } else if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ ...report, validationFailures: failures }, null, 2)}\n`);
  } else {
    console.log(humanReport(report));
    if (failures.length) console.log(`\nValidation warnings:\n- ${failures.join("\n- ")}`);
  }
}
