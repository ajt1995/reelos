import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { buildFeatureAcceptance } from "./feature-acceptance.mjs";

const root = resolve(import.meta.dirname, "..");
const registerPath = join(root, "docs", "feature-register.json");
const reportPath = join(root, ".reelos-audit", "feature-contract.json");
const jsonMode = process.argv.includes("--json");
const releaseMode = process.argv.includes("--release");

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".vercel", "dist", ".test-tmp"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const register = JSON.parse(readFileSync(registerPath, "utf8"));
const routeFiles = walk(join(root, "src", "routes")).filter((file) => /\.(?:ts|tsx)$/.test(file));
const routeText = routeFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const knownRoutes = new Set([...routeText.matchAll(/createFileRoute\(["'`]([^"'`]+)["'`]\)/g)].map((match) => match[1]));
const failures = [];
const acceptance = buildFeatureAcceptance();
const features = register.features.map((feature) => {
  const missing = [];
  if (!feature.id || !feature.status) missing.push("id/status");
  if (!Array.isArray(feature.destinations)) missing.push("destinations");
  if (!Array.isArray(feature.entryPoints)) missing.push("entryPoints");
  if (!Array.isArray(feature.states)) missing.push("states");
  if (!Array.isArray(feature.services)) missing.push("services");
  if (!Array.isArray(feature.evidence)) missing.push("evidence");
  if (!feature.acceptance) missing.push("acceptance");
  const missingEvidence = (feature.evidence || []).filter((path) => !existsSync(join(root, path)));
  const unknownDestinations = (feature.destinations || []).filter((route) => !knownRoutes.has(route));
  if (feature.status === "active" && (!feature.destinations?.length || !feature.entryPoints?.length || !feature.states?.length || !feature.services?.length || !feature.evidence?.length)) missing.push("active feature contract");
  const result = { id: feature.id, status: feature.status, missing, missingEvidence, unknownDestinations };
  if (missing.length || missingEvidence.length || unknownDestinations.length) failures.push(result);
  return result;
});

const report = {
  generatedAt: new Date().toISOString(),
  register: relative(root, registerPath).replace(/\\/g, "/"),
  summary: {
    features: features.length,
    active: features.filter((item) => item.status === "active").length,
    parked: features.filter((item) => item.status === "parked").length,
    contractFailures: failures.length,
    releaseAcceptanceFailures: acceptance.failures.length + acceptance.blocked.length,
  },
  knownRoutes: [...knownRoutes].sort(),
  failures,
  features,
  releaseAcceptance: {
    releaseReady: acceptance.summary.releaseReady,
    structuralFailures: acceptance.summary.structuralFailures,
    blockedAcceptance: acceptance.summary.blockedAcceptance,
    note: "This feature-contract audit validates structural inventory only. It does not establish release acceptance unless invoked with --release."
  }
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
if (jsonMode) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else {
  console.log(`Feature inventory contract: ${report.summary.features} features | ${report.summary.active} active | ${report.summary.parked} parked`);
  console.log(`Contract failures: ${report.summary.contractFailures}`);
  console.log(`Release acceptance: ${report.releaseAcceptance.releaseReady ? "READY" : `BLOCKED (${report.summary.releaseAcceptanceFailures} missing or invalid evidence records)`}`);
  for (const failure of failures) console.log(`FAIL ${failure.id}: ${[...failure.missing, ...failure.missingEvidence, ...failure.unknownDestinations].join(", ")}`);
  console.log(`Snapshot: ${relative(root, reportPath)}`);
}
if (failures.length || (releaseMode && !acceptance.summary.releaseReady)) process.exitCode = 1;
