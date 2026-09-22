import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const registerPath = join(root, "docs", "feature-register.json");
const ledgerPath = join(root, "docs", "feature-acceptance.json");
const interfaceRegisterPath = join(root, "docs", "INTERFACE-FEATURE-REGISTER.md");
const jsonMode = process.argv.includes("--json");
const checkMode = process.argv.includes("--check");

const evidenceTypes = new Set(["automated-test", "observed-run", "security-review", "hardware-run", "visual-review"]);

function parseConsumerJourneyRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith("| Feature"));
  if (header < 0) return [];
  const rows = [];
  for (let index = header + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6) continue;
    rows.push({ label: cells[0], sourceLine: index + 1 });
  }
  return rows;
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateEvidence(item, now, failures) {
  const evidence = item.evidence ?? [];
  if (!Array.isArray(evidence)) return failures.push(`${item.id}: evidence is not an array`);
  if (item.status === "verified" && !evidence.length) return failures.push(`${item.id}: verified status has no evidence`);
  const foundTypes = new Set();
  for (const proof of evidence) {
    if (proof?.result === "skipped") {
      failures.push(`${item.id}: evidence was skipped: ${proof.id ?? "unnamed"}`);
      continue;
    }
    if (!proof?.id || !evidenceTypes.has(proof.type) || proof.result !== "passed") {
      failures.push(`${item.id}: invalid evidence record`);
      continue;
    }
    if (!proof.location || typeof proof.location !== "string" || !existsSync(join(root, proof.location))) failures.push(`${item.id}: evidence artifact is missing: ${proof.location ?? "none"}`);
    if (!validDate(proof.capturedAt) || !validDate(proof.expiresAt)) failures.push(`${item.id}: evidence timestamps are invalid`);
    else if (Date.parse(proof.expiresAt) <= now) failures.push(`${item.id}: evidence is stale: ${proof.id}`);
    foundTypes.add(proof.type);
  }
  if (item.status === "verified") for (const type of item.requiredEvidence ?? []) if (!foundTypes.has(type)) failures.push(`${item.id}: missing required ${type} evidence`);
  return foundTypes;
}

function classifyBlocker(item, foundTypes) {
  const missingEvidence = (item.requiredEvidence ?? []).filter((type) => !foundTypes.has(type));
  const category = missingEvidence.some((type) => type === "automated-test" || type === "observed-run") ? "code-required" : "hardware-external";
  return { id: item.id, featureId: item.featureId, status: item.status, missingEvidence, category };
}

export function buildFeatureAcceptance({ now = Date.now(), register: registerOverride, ledger: ledgerOverride, interfaceMarkdown } = {}) {
  const register = registerOverride ?? JSON.parse(readFileSync(registerPath, "utf8"));
  const ledger = ledgerOverride ?? JSON.parse(readFileSync(ledgerPath, "utf8"));
  const activeFeatures = (register.features ?? []).filter((feature) => feature.status === "active").map((feature) => feature.id).sort();
  const activeFeatureIds = new Set(activeFeatures);
  const expectedRequirements = parseConsumerJourneyRows(interfaceMarkdown ?? readFileSync(interfaceRegisterPath, "utf8"));
  const failures = [];
  const blocked = [];
  const blockerDetails = [];
  const groups = ledger.groups ?? [];
  const requirements = ledger.requirements ?? [];

  if (ledger.schema !== "reelos-feature-acceptance/v1") failures.push("unsupported feature-acceptance schema");
  const groupByFeature = new Map();
  for (const group of groups) {
    if (!group?.id || !group.featureId || !group.status || !Array.isArray(group.requiredEvidence) || !Array.isArray(group.evidence)) failures.push(`${group?.id ?? "unnamed group"}: incomplete group record`);
    if (!activeFeatureIds.has(group.featureId)) failures.push(`${group.id}: unknown or inactive feature ${group.featureId}`);
    if (groupByFeature.has(group.featureId)) failures.push(`${group.id}: duplicate group mapping for ${group.featureId}`);
    groupByFeature.set(group.featureId, group);
    const foundTypes = validateEvidence(group, now, failures) ?? new Set();
    if (group.status !== "verified") {
      blocked.push(`${group.id}: ${group.status ?? "missing status"}`);
      blockerDetails.push(classifyBlocker(group, foundTypes));
    }
  }
  for (const featureId of activeFeatures) if (!groupByFeature.has(featureId)) failures.push(`missing group acceptance mapping for ${featureId}`);
  for (const featureId of groupByFeature.keys()) if (!activeFeatureIds.has(featureId)) failures.push(`group mapping is not active: ${featureId}`);

  const expectedByLabel = new Map(expectedRequirements.map((item) => [item.label, item]));
  const requirementByLabel = new Map();
  for (const requirement of requirements) {
    if (!requirement?.id || !requirement.featureId || !requirement.label || !requirement.status || !Array.isArray(requirement.requiredEvidence) || !Array.isArray(requirement.evidence)) failures.push(`${requirement?.id ?? "unnamed requirement"}: incomplete requirement record`);
    if (!activeFeatureIds.has(requirement.featureId)) failures.push(`${requirement.id}: unknown or inactive feature ${requirement.featureId}`);
    if (requirement.source !== "docs/INTERFACE-FEATURE-REGISTER.md") failures.push(`${requirement.id}: requirement source must be the interface register`);
    const expected = expectedByLabel.get(requirement.label);
    if (!expected) failures.push(`${requirement.id}: unknown interface requirement ${requirement.label}`);
    else if (expected.sourceLine !== requirement.sourceLine) failures.push(`${requirement.id}: stale source line for ${requirement.label}`);
    if (requirementByLabel.has(requirement.label)) failures.push(`${requirement.id}: duplicate mapping for ${requirement.label}`);
    requirementByLabel.set(requirement.label, requirement);
    const foundTypes = validateEvidence(requirement, now, failures) ?? new Set();
    if (requirement.status !== "verified") {
      blocked.push(`${requirement.id}: ${requirement.status ?? "missing status"}`);
      blockerDetails.push(classifyBlocker(requirement, foundTypes));
    }
  }
  for (const expected of expectedRequirements) if (!requirementByLabel.has(expected.label)) failures.push(`missing interface acceptance mapping for ${expected.label}`);
  for (const label of requirementByLabel.keys()) if (!expectedByLabel.has(label)) failures.push(`interface acceptance mapping is no longer registered: ${label}`);

  return {
    schema: "reelos-feature-acceptance-report/v1",
    generatedAt: new Date(now).toISOString(),
    summary: {
      activeFeatureCount: activeFeatures.length,
      groupCount: groups.length,
      verifiedGroupCount: groups.filter((item) => item.status === "verified").length,
      interfaceRequirementCount: expectedRequirements.length,
      mappedRequirementCount: requirements.length,
      verifiedRequirementCount: requirements.filter((item) => item.status === "verified").length,
      structuralFailures: failures.length,
      blockedAcceptance: blocked.length,
      codeRequiredBlockers: blockerDetails.filter((item) => item.category === "code-required").length,
      hardwareExternalBlockers: blockerDetails.filter((item) => item.category === "hardware-external").length,
      releaseReady: failures.length === 0 && blocked.length === 0
    },
    failures,
    blocked,
    blockerDetails,
    groups,
    requirements
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "feature-acceptance.mjs");
if (invokedDirectly) {
  const report = buildFeatureAcceptance();
  if (jsonMode) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    console.log(`Feature acceptance inventory: ${report.summary.groupCount}/${report.summary.activeFeatureCount} active groups mapped | ${report.summary.mappedRequirementCount}/${report.summary.interfaceRequirementCount} interface requirements mapped`);
    console.log(`Verified acceptance: ${report.summary.verifiedGroupCount}/${report.summary.activeFeatureCount} groups | ${report.summary.verifiedRequirementCount}/${report.summary.interfaceRequirementCount} interface requirements`);
    console.log(`Structural failures: ${report.summary.structuralFailures} | Acceptance blockers: ${report.summary.blockedAcceptance}`);
    console.log(`Remaining blockers: ${report.summary.codeRequiredBlockers} code/test | ${report.summary.hardwareExternalBlockers} hardware/external`);
    console.log(`Release acceptance: ${report.summary.releaseReady ? "READY" : "BLOCKED"}`);
  }
  if (checkMode && !report.summary.releaseReady) {
    for (const failure of report.failures) console.error(`FAIL ${failure}`);
    for (const blocker of report.blockerDetails) console.error(`${blocker.category === "code-required" ? "CODE" : "EXTERNAL"} ${blocker.id}: missing ${blocker.missingEvidence.join(", ") || blocker.status}`);
    process.exitCode = 1;
  }
}
