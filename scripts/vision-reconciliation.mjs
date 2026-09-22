import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const visionPath = join(root, "docs", "vision-reconciliation.json");
const registerPath = join(root, "docs", "feature-register.json");
const acceptancePath = join(root, "docs", "feature-acceptance.json");
const jsonMode = process.argv.includes("--json");
const checkMode = process.argv.includes("--check");

function interfaceRequirements() {
  const source = "docs/INTERFACE-FEATURE-REGISTER.md";
  const lines = readFileSync(join(root, source), "utf8").split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith("| Feature"));
  if (header < 0) return [];
  const requirements = [];
  for (let index = header + 2; index < lines.length; index += 1) {
    if (!lines[index].startsWith("|")) break;
    const label = lines[index].split("|")[1]?.trim();
    if (label) requirements.push({ label, sourceLine: index + 1 });
  }
  return requirements;
}

export function buildVisionReconciliation() {
  const vision = JSON.parse(readFileSync(visionPath, "utf8"));
  const register = JSON.parse(readFileSync(registerPath, "utf8"));
  const acceptance = JSON.parse(readFileSync(acceptancePath, "utf8"));
  const featureIds = new Set((register.features ?? []).map((feature) => feature.id));
  const activeFeatureIds = (register.features ?? []).filter((feature) => feature.status === "active").map((feature) => feature.id);
  const entries = vision.entries ?? [];
  const failures = [];
  const activeTargets = new Set();
  const interfaceEntries = new Map();
  for (const entry of entries) {
    if (!entry.id || !entry.source || !entry.disposition || !entry.rationale) failures.push(`${entry.id || "unnamed"}: incomplete entry`);
    if (!existsSync(join(root, entry.source))) failures.push(`${entry.id}: missing source ${entry.source}`);
    for (const target of entry.targets ?? []) if (!featureIds.has(target)) failures.push(`${entry.id}: unknown target ${target}`);
    if (!Array.isArray(entry.targets) || !entry.targets.length) failures.push(`${entry.id}: missing target`);
    if (entry.disposition === "active") for (const target of entry.targets ?? []) activeTargets.add(target);
    if (entry.source === "docs/INTERFACE-FEATURE-REGISTER.md" && entry.requirement) {
      if (interfaceEntries.has(entry.requirement)) failures.push(`${entry.id}: duplicate interface requirement ${entry.requirement}`);
      interfaceEntries.set(entry.requirement, entry);
    }
  }
  const ledger = vision.acceptanceLedger;
  if (!ledger?.source || ledger.disposition !== "active" || !ledger.rationale) failures.push("acceptanceLedger: incomplete active acceptance-ledger reconciliation");
  if (ledger?.source !== "docs/feature-acceptance.json") failures.push("acceptanceLedger: must reference docs/feature-acceptance.json");
  if (ledger?.source && !existsSync(join(root, ledger.source))) failures.push(`acceptanceLedger: missing source ${ledger.source}`);
  for (const group of acceptance.groups ?? []) {
    if (!activeFeatureIds.includes(group.featureId)) failures.push(`acceptance group is unknown or inactive: ${group.featureId}`);
    else activeTargets.add(group.featureId);
  }
  for (const requirement of acceptance.requirements ?? []) {
    if (requirement.source !== "docs/INTERFACE-FEATURE-REGISTER.md") failures.push(`acceptance requirement has unexpected source: ${requirement.id}`);
    if (interfaceEntries.has(requirement.label)) failures.push(`acceptance ledger duplicates interface requirement: ${requirement.label}`);
    interfaceEntries.set(requirement.label, requirement);
  }
  for (const featureId of activeFeatureIds) if (!activeTargets.has(featureId)) failures.push(`active feature is not reconciled: ${featureId}`);
  for (const requirement of interfaceRequirements()) {
    const entry = interfaceEntries.get(requirement.label);
    if (!entry) failures.push(`interface requirement is not reconciled: ${requirement.label}`);
    else if (entry.sourceLine !== requirement.sourceLine) failures.push(`interface requirement source line is stale: ${requirement.label}`);
  }
  for (const label of interfaceEntries.keys()) if (!interfaceRequirements().some((requirement) => requirement.label === label)) failures.push(`reconciled interface requirement no longer exists: ${label}`);
  return {
    schema: "reelos-vision-reconciliation/v1",
    entryCount: entries.length,
    activeFeatureCount: activeFeatureIds.length,
    interfaceRequirementCount: interfaceRequirements().length,
    byDisposition: Object.fromEntries([...new Set(entries.map((entry) => entry.disposition))].sort().map((kind) => [kind, entries.filter((entry) => entry.disposition === kind).length])),
    failures,
    entries
  };
}

const report = buildVisionReconciliation();
if (checkMode) {
  if (report.failures.length) {
    console.error(`Vision reconciliation failed: ${report.failures.join("; ")}`);
    process.exitCode = 1;
  } else console.log(`Vision reconciliation passed: ${report.entryCount} historical requirement groups mapped.`);
} else if (jsonMode) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(`Vision reconciliation: ${report.entryCount} groups | ${Object.entries(report.byDisposition).map(([kind, count]) => `${kind}: ${count}`).join(" | ")}`);
  if (report.failures.length) console.log(`FAILURES: ${report.failures.join("; ")}`);
}
