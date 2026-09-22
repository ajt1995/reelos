import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "..");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const outputPath = join(repositoryRoot, ".reelos-audit", "setup-settings", "result.json");

const artifactDefinitions = {
  setup: { location: ".reelos-audit/setup/result.json", timestamp: "capturedAt", mode: "setup" },
  e2e: { location: ".reelos-audit/e2e-matrix/result.json", timestamp: "generatedAt", mode: "e2e" },
  contracts: { location: ".reelos-audit/acceptance-contracts/result.json", timestamp: "generatedAt", mode: "contracts" },
  settingsBrowser: { location: ".reelos-audit/setup-settings-browser/result.json", timestamp: "generatedAt", mode: "settings-browser" },
};

// These mappings normalize only directly named browser/contract observations.
// They deliberately never manufacture visual, security, or hardware review.
const coverage = {
  "ui-setup-identity": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["fresh setup", "stable roster IDs", "acknowledged completion"], fragments: ["Hi, what should we call you?", "getByPlaceholder(\"Your name\")"] },
  ],
  "ui-setup-color": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["fresh setup", "draft reload"], fragments: ["And what is your favorite color?"] },
  ],
  "ui-setup-guidance": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["fresh setup", "source failure recovery"], fragments: ["Just you for now?", "What can this home play?", "Where should ReelOS meet you?"] },
  ],
  "ui-setup-taste": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["fresh setup", "retried taste persists privately"], fragments: ["Continue without choosing", "vote: \"comfort\""] },
  ],
  "ui-setup-home": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["acknowledged completion", "phone/TV overflow"], fragments: ["completed-home.png", "Finish and open phone setup"] },
  ],
  "ui-source-choice": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["source failure recovery", "unauthorized settings denied"], fragments: ["Use public and personal media", "Test source save unavailable"] },
    { artifact: "e2e", types: ["automated-test", "observed-run"], tests: ["Settings explains source access honestly"] },
  ],
  "ui-deployment-choice": [
    { artifact: "setup", types: ["automated-test", "observed-run"], checks: ["acknowledged completion"], fragments: ["Where should ReelOS meet you?", "Finish and open phone setup"] },
  ],
  "ui-home-hero": [
    { artifact: "e2e", types: ["automated-test", "observed-run"], tests: ["Home leads with artwork and a personal hero"] },
  ],
  "ui-home-shelves": [
    { artifact: "settingsBrowser", types: ["automated-test", "observed-run"], tests: ["Home curated shelves expose real title cards"] },
  ],
  "ui-motion-preference": [
    { artifact: "settingsBrowser", types: ["automated-test", "observed-run"], tests: ["Motion preference persists after server acknowledgement and reload"] },
  ],
  "ui-density-preference": [
    { artifact: "settingsBrowser", types: ["automated-test", "observed-run"], tests: ["Browsing density persists after server acknowledgement and reload"] },
  ],
  "ui-help-status": [
    { artifact: "settingsBrowser", types: ["automated-test", "observed-run"], tests: ["Help status exposes honest update recovery and capability state"] },
  ],
  "ui-torbox-management": [
    { artifact: "e2e", types: ["automated-test", "observed-run"], tests: ["Settings explains source access honestly"] },
  ],
  "ui-devices": [
    { artifact: "setup", types: ["observed-run"], checks: ["acknowledged completion", "phone/TV overflow"], fragments: ["Where should ReelOS meet you?", "Finish and open phone setup"] },
    { artifact: "contracts", types: ["automated-test"], tests: ["manual update actions are reachable on mobile and TV", "paired Android clients receive truthful hashed update metadata and exact bytes"] },
  ],
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function readArtifact(root, name, now) {
  const definition = artifactDefinitions[name];
  const path = join(root, definition.location);
  if (!existsSync(path)) return { name, usable: false, location: definition.location, reasons: ["missing"] };
  const bytes = readFileSync(path);
  let data;
  try { data = JSON.parse(bytes.toString("utf8")); }
  catch { return { name, usable: false, location: definition.location, reasons: ["invalid JSON"] }; }
  const capturedAt = data[definition.timestamp];
  const reasons = [];
  if (!validTimestamp(capturedAt)) reasons.push("invalid timestamp");
  else if (Date.parse(capturedAt) > now + 5 * 60 * 1000 || Date.parse(capturedAt) + MAX_AGE_MS <= now) reasons.push("stale or future timestamp");
  if (definition.mode === "setup" && (data.result !== "passed" || !Array.isArray(data.checks) || !data.checks.length || !Array.isArray(data.runtimeErrors) || data.runtimeErrors.length)) reasons.push("setup did not pass cleanly");
  if (definition.mode === "e2e" && (data.failed !== 0 || data.skipped !== 0 || !Array.isArray(data.tests) || data.tests.some((test) => test.status !== "PASS"))) reasons.push("E2E matrix did not pass cleanly");
  if (definition.mode === "contracts" && (data.result !== "passed" || data.failed !== 0 || data.skipped !== 0 || !Array.isArray(data.tests) || data.tests.some((test) => test.status !== "PASS"))) reasons.push("contract matrix did not pass cleanly");
  if (definition.mode === "settings-browser" && (data.schema !== "reelos-setup-settings-browser/v1" || data.result !== "passed" || data.failed !== 0 || data.skipped !== 0 || !Array.isArray(data.runtimeErrors) || data.runtimeErrors.length || !Array.isArray(data.tests) || data.tests.some((test) => test.status !== "PASS"))) reasons.push("setup/settings browser journey did not pass cleanly");
  if (!data.sources || typeof data.sources !== "object" || !Object.keys(data.sources).length) reasons.push("source fingerprints are absent");
  else for (const [source, expected] of Object.entries(data.sources)) {
    const sourcePath = join(root, source);
    if (!existsSync(sourcePath) || sha256(readFileSync(sourcePath)) !== expected) reasons.push(`source fingerprint changed: ${source}`);
  }
  return { name, usable: reasons.length === 0, location: definition.location, capturedAt, artifactSha256: sha256(bytes), data, reasons };
}

function conditionSatisfied(artifact, condition, root) {
  if (!artifact?.usable) return false;
  const checks = new Set(artifact.data.checks ?? []);
  const tests = new Set((artifact.data.tests ?? []).filter((test) => test.status === "PASS").map((test) => test.name));
  if (!(condition.checks ?? []).every((check) => checks.has(check)) || !(condition.tests ?? []).every((test) => tests.has(test))) return false;
  if (condition.fragments?.length) {
    const source = "scripts/test-setup-journey.mjs";
    if (artifact.name !== "setup" || !(source in artifact.data.sources)) return false;
    const content = readFileSync(join(root, source), "utf8");
    if (!condition.fragments.every((fragment) => content.includes(fragment))) return false;
  }
  return true;
}

export function reconcileSetupSettingsEvidence({ requirements, artifacts, root = repositoryRoot }) {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.name, artifact]));
  const requirementMap = new Map(requirements.map((item) => [item.id, item]));
  return Object.entries(coverage).map(([id, conditions]) => {
    const requirement = requirementMap.get(id);
    if (!requirement) throw new Error(`Acceptance requirement is missing: ${id}`);
    const evidence = [];
    for (const condition of conditions) {
      const artifact = artifactMap.get(condition.artifact);
      if (!conditionSatisfied(artifact, condition, root)) continue;
      for (const type of condition.types) if (!evidence.some((proof) => proof.type === type)) evidence.push({
        type,
        artifact: artifact.location,
        artifactSha256: artifact.artifactSha256,
        capturedAt: artifact.capturedAt,
        directlySupports: [...(condition.checks ?? []), ...(condition.tests ?? []), ...(condition.fragments ?? []).map((fragment) => `executed setup trace: ${fragment}`)],
      });
    }
    const found = new Set(evidence.map((proof) => proof.type));
    const missingRequiredEvidence = requirement.requiredEvidence.filter((type) => !found.has(type));
    return {
      id,
      label: requirement.label,
      requiredEvidence: requirement.requiredEvidence,
      evidence,
      missingRequiredEvidence,
      status: missingRequiredEvidence.length ? (evidence.length ? "partial" : "missing") : "supported",
    };
  });
}

export function buildSetupSettingsEvidence({ root = repositoryRoot, now = Date.now() } = {}) {
  const ledger = JSON.parse(readFileSync(join(root, "docs", "feature-acceptance.json"), "utf8"));
  const artifacts = Object.keys(artifactDefinitions).map((name) => readArtifact(root, name, now));
  const requirements = reconcileSetupSettingsEvidence({ requirements: ledger.requirements, artifacts, root });
  return {
    schema: "reelos-setup-settings-evidence/v1",
    generatedAt: new Date(now).toISOString(),
    summary: {
      covered: requirements.length,
      supported: requirements.filter((item) => item.status === "supported").length,
      partial: requirements.filter((item) => item.status === "partial").length,
      missing: requirements.filter((item) => item.status === "missing").length,
    },
    constraints: ["No screenshot counts as visual-review.", "No automated run counts as security-review.", "No simulated or browser run counts as hardware-run."],
    artifacts: artifacts.map(({ data: _data, ...artifact }) => artifact),
    requirements,
    sources: {
      "scripts/setup-settings-evidence.mjs": sha256(readFileSync(join(root, "scripts", "setup-settings-evidence.mjs"))),
    },
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const report = buildSetupSettingsEvidence();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Setup/settings evidence: ${report.summary.supported} supported, ${report.summary.partial} partial, ${report.summary.missing} missing (${report.summary.covered} covered).`);
  for (const artifact of report.artifacts.filter((item) => !item.usable)) console.log(`UNUSABLE ${artifact.name}: ${artifact.reasons.join("; ")}`);
}
