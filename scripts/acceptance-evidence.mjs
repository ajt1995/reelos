import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "..");
const ledgerPath = join(repositoryRoot, "docs", "feature-acceptance.json");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const artifactDefinitions = {
  setup: { location: ".reelos-audit/setup/result.json", timestamp: "capturedAt" },
  e2e: { location: ".reelos-audit/e2e-matrix/result.json", timestamp: "generatedAt" },
  contracts: { location: ".reelos-audit/acceptance-contracts/result.json", timestamp: "generatedAt" },
  family: { location: ".reelos-audit/family-social/result.json", timestamp: "capturedAt" },
  settingsBrowser: { location: ".reelos-audit/setup-settings-browser/result.json", timestamp: "generatedAt" },
  release: { location: ".reelos-audit/release-current.log" }
};

// An entry is intentionally narrow: each string must occur verbatim in the named
// artifact. A broad passing suite or a screenshot is never accepted as proof for
// an unrelated requirement.
const coverage = {
  "group-title-and-player": {
    "automated-test": [{ artifact: "contracts", tests: ["registers local start, progress, and stop without an external media service", "subtitles select exact metadata identity despite duplicate labels/languages and list order", "sleep timer pauses the actual video once at its deadline"] }]
  },
  "group-family": {
    "automated-test": [{ artifact: "contracts", tests: ["requires a child PIN, preserves it on empty updates, and bounds playback policy", "merges participating child policy by the strictest safe preference", "family treatment accepts only verified exact-edition, exact-timebase manifests", "blocks child escape through changes, deletion, stale cookies, and cookie clearing", "requires current child exit and target adult entry PINs", "fails closed for child playback until this exact local edition has a verified treatment"] }]
  },
  "group-kids-present": {
    "automated-test": [{ artifact: "contracts", tests: ["resolves child policy from each device instead of the shared active profile or request body", "uses presence for the authenticated device session and rechecks policy on progress"] }],
    "observed-run": [{ artifact: "family", checks: ["Kids Present round-trips and Home filters out adult-only catalog titles"] }]
  },
  "group-companion-and-story": {
    "automated-test": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }],
    "observed-run": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }]
  },
  "group-watch-together": {
    "automated-test": [{ artifact: "family", checks: ["Watch Together host, join, participant confirmation, and stable reconnect render from live service state"] }],
    "observed-run": [{ artifact: "family", checks: ["Watch Together host, join, participant confirmation, and stable reconnect render from live service state"] }]
  },
  "group-devices-and-installation": {
    "automated-test": [{ artifact: "contracts", tests: ["native clients are paired-home clients, never direct provider clients", "catalog and streams cross an authenticated same-origin boundary", "credentials are excluded from Android backup and pairing links", "paired Android clients receive truthful hashed update metadata and exact bytes"] }]
  },
  "group-updates-and-recovery": {
    "automated-test": [{ artifact: "contracts", tests: ["APK updates require origin, digest, and installed signer continuity", "paired Android clients receive truthful hashed update metadata and exact bytes", "Android update routes fail closed for absent, stale, and traversal-shaped artifacts", "verified release is staged and becomes active only after version-matched health", "failed health gate restores and verifies the previous release", "artifact tampering is rejected before unpack or activation"] }]
  },
  "group-home": {
    "automated-test": [{ artifact: "e2e", tests: ["Natural-language search sits directly beneath the hero", "No-idea helper makes a decision and asks for feedback"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Home leads with artwork and a personal hero", "No-idea helper makes a decision and asks for feedback"] }]
  },
  "group-discover": {
    "automated-test": [{ artifact: "e2e", tests: ["Discover is art-led, not an introductory control stack", "Discover keeps Search and Refine compact and functional"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Discover person invitations open an actual destination", "Discover has no horizontal overflow"] }]
  },
  "group-profiles-and-taste": {
    "automated-test": [{ artifact: "e2e", tests: ["Personal profile destination keeps taste separate from Family administration", "Endless taste field replenishes and updates the Cozy collection"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Personal profile destination keeps taste separate from Family administration", "Endless taste field replenishes and updates the Cozy collection"] }]
  },
  "ui-active-identity": {
    "automated-test": [{ artifact: "setup", checks: ["profile isolation", "legacy destinations use acknowledged profile identity"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Profile switcher keeps personal and Family destinations separate"] }]
  },
  "ui-personal-destination": {
    "automated-test": [{ artifact: "e2e", tests: ["Personal profile destination keeps taste separate from Family administration"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Personal profile destination keeps taste separate from Family administration"] }]
  },
  "ui-home-search": {
    "automated-test": [{ artifact: "e2e", tests: ["Home search parses a precise natural-language request"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Natural-language search sits directly beneath the hero"] }]
  },
  "ui-no-idea": {
    "automated-test": [{ artifact: "e2e", tests: ["No-idea helper makes a decision and asks for feedback"] }],
    "observed-run": [{ artifact: "e2e", tests: ["No-idea helper makes a decision and asks for feedback"] }]
  },
  "ui-taste-calibration": {
    "automated-test": [{ artifact: "e2e", tests: ["Endless taste field replenishes and updates the Cozy collection"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Endless taste field replenishes and updates the Cozy collection"] }]
  },
  "ui-tonight-context": {
    "automated-test": [{ artifact: "e2e", tests: ["Discover keeps Search and Refine compact and functional"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Discover keeps Search and Refine compact and functional"] }]
  },
  "ui-deeper-invitation": {
    "automated-test": [{ artifact: "e2e", tests: ["Discover person invitations open an actual destination"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Discover person invitations open an actual destination"] }]
  },
  "ui-search-results": {
    "automated-test": [{ artifact: "e2e", tests: ["Home search parses a precise natural-language request"] }],
    "observed-run": [{ artifact: "e2e", tests: ["Home search parses a precise natural-language request"] }]
  },
  "ui-player": {
    "automated-test": [{ artifact: "contracts", tests: ["registers local start, progress, and stop without an external media service", "subtitles select exact metadata identity despite duplicate labels/languages and list order", "sleep timer pauses the actual video once at its deadline"] }]
  },
  "ui-kids-present": {
    "automated-test": [{ artifact: "contracts", tests: ["resolves child policy from each device instead of the shared active profile or request body", "uses presence for the authenticated device session and rechecks policy on progress"] }]
  },
  "ui-family-filtering": {
    "automated-test": [{ artifact: "contracts", tests: ["merges participating child policy by the strictest safe preference", "fails closed for unrated or over-boundary titles and honors unanimous exceptions", "fails closed for child playback until this exact local edition has a verified treatment"] }]
  },
  "ui-family-overview": {
    "automated-test": [{ artifact: "family", checks: ["service-backed Family overview renders adult and protected child truth"] }]
  },
  "ui-adult-profile-editing": {
    "automated-test": [{ artifact: "family", checks: ["adult edit persists and optional PIN is confirmed by the service"] }],
    "observed-run": [{ artifact: "family", checks: ["adult edit persists and optional PIN is confirmed by the service"] }]
  },
  "ui-child-profile-editing": {
    "automated-test": [{ artifact: "family", checks: ["child boundaries edit persists without weakening required exit PIN"] }],
    "observed-run": [{ artifact: "family", checks: ["child boundaries edit persists without weakening required exit PIN"] }]
  },
  "ui-companion-strip": {
    "automated-test": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }],
    "observed-run": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }]
  },
  "ui-companion-remote": {
    "automated-test": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }]
  },
  "ui-story-companion": {
    "automated-test": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }],
    "observed-run": [{ artifact: "family", checks: ["Companion strip, remote, and story states fail closed when playback evidence is absent"] }]
  },
  "ui-watch-together": {
    "automated-test": [{ artifact: "family", checks: ["Watch Together host, join, participant confirmation, and stable reconnect render from live service state"] }]
  },
  "ui-home-shelves": {
    "automated-test": [{ artifact: "settingsBrowser", tests: ["Home curated shelves expose real title cards"] }],
    "observed-run": [{ artifact: "settingsBrowser", tests: ["Home curated shelves expose real title cards"] }]
  },
  "ui-help-status": {
    "automated-test": [{ artifact: "settingsBrowser", tests: ["Help status exposes honest update recovery and capability state"] }],
    "observed-run": [{ artifact: "settingsBrowser", tests: ["Help status exposes honest update recovery and capability state"] }]
  },
  "ui-devices": {
    "automated-test": [{ artifact: "contracts", tests: ["native clients are paired-home clients, never direct provider clients", "catalog and streams cross an authenticated same-origin boundary", "credentials are excluded from Android backup and pairing links", "paired Android clients receive truthful hashed update metadata and exact bytes"] }]
  }
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function readArtifact(root, name) {
  const definition = artifactDefinitions[name];
  const absolute = join(root, definition.location);
  if (!existsSync(absolute)) return { name, location: definition.location, usable: false, reasons: ["missing"] };
  const bytes = readFileSync(absolute);
  if (name === "release") {
    const content = bytes.toString("utf8");
    const pass = content.match(/tests\s+(\d+)[\s\S]*pass\s+(\d+)[\s\S]*fail\s+(\d+)[\s\S]*skipped\s+(\d+)/u);
    const capturedAt = statSync(absolute).mtime.toISOString();
    const usable = Boolean(pass && Number(pass[1]) > 0 && pass[1] === pass[2] && pass[3] === "0" && pass[4] === "0");
    return { name, location: definition.location, usable, capturedAt, digest: sha256(bytes), reasons: usable ? [] : ["release report is incomplete, failed, or skipped"] };
  }
  let data;
  try { data = JSON.parse(bytes.toString("utf8")); }
  catch { return { name, location: definition.location, usable: false, reasons: ["invalid JSON"] }; }
  const capturedAt = data[definition.timestamp];
  const reasons = [];
  if (!validTimestamp(capturedAt)) reasons.push("invalid timestamp");
  if (name === "setup") {
    if (data.result !== "passed") reasons.push("setup result did not pass");
    if (!Array.isArray(data.runtimeErrors) || data.runtimeErrors.length) reasons.push("setup runtime errors are present");
    if (!Array.isArray(data.checks) || !data.checks.length) reasons.push("setup checks are absent");
    if (!data.sources || typeof data.sources !== "object") reasons.push("setup source fingerprints are absent");
    else for (const [source, expected] of Object.entries(data.sources)) {
      const sourcePath = join(root, source);
      if (!existsSync(sourcePath) || sha256(readFileSync(sourcePath)) !== expected) reasons.push(`source fingerprint changed: ${source}`);
    }
  }
  if (name === "e2e") {
    if (data.failed !== 0 || data.skipped !== 0 || !Array.isArray(data.tests) || data.passed !== data.tests.length || data.tests.length < 32) reasons.push("e2e matrix is not an unskipped complete pass");
    if (!Array.isArray(data.tests) || data.tests.length < 32 || data.tests.some((entry) => entry.status !== "PASS")) reasons.push("e2e test records are incomplete");
    if (!data.sources || typeof data.sources !== "object") reasons.push("e2e source fingerprints are absent");
    else for (const [source, expected] of Object.entries(data.sources)) {
      const sourcePath = join(root, source);
      if (!existsSync(sourcePath) || sha256(readFileSync(sourcePath)) !== expected) reasons.push(`source fingerprint changed: ${source}`);
    }
  }
  if (name === "contracts") {
    if (data.schema !== "reelos-acceptance-contract-evidence/v1" || data.result !== "passed" || data.failed !== 0 || data.skipped !== 0) reasons.push("contract verification did not pass cleanly");
    if (!Array.isArray(data.tests) || !data.tests.length || data.tests.some((entry) => entry.status !== "PASS")) reasons.push("contract test records are incomplete");
    if (!data.sources || typeof data.sources !== "object" || !Object.keys(data.sources).length) reasons.push("contract source fingerprints are absent");
    else for (const [source, expected] of Object.entries(data.sources)) {
      const sourcePath = join(root, source);
      if (!existsSync(sourcePath) || sha256(readFileSync(sourcePath)) !== expected) reasons.push(`source fingerprint changed: ${source}`);
    }
  }
  if (name === "family" || name === "settingsBrowser") {
    if (data.result !== "passed") reasons.push(`${name} browser journey did not pass`);
    if (Array.isArray(data.runtimeErrors) && data.runtimeErrors.length) reasons.push(`${name} runtime errors are present`);
    if (!data.sources || typeof data.sources !== "object" || !Object.keys(data.sources).length) reasons.push(`${name} source fingerprints are absent`);
    else for (const [source, expected] of Object.entries(data.sources)) {
      const sourcePath = join(root, source);
      if (!existsSync(sourcePath) || sha256(readFileSync(sourcePath)) !== expected) reasons.push(`source fingerprint changed: ${source}`);
    }
  }
  return { name, location: definition.location, usable: reasons.length === 0, capturedAt, digest: sha256(bytes), data, reasons };
}

function requirementSatisfied(artifact, condition) {
  if (!artifact?.usable) return false;
  const checks = new Set(artifact.data?.checks ?? []);
  const tests = new Set((artifact.data?.tests ?? []).filter((test) => test.status === "PASS").map((test) => test.name));
  return (condition.checks ?? []).every((check) => checks.has(check))
    && (condition.tests ?? []).every((name) => tests.has(name));
}

function evidenceRecord(itemId, type, artifact, condition, expiresAt) {
  return {
    id: `${itemId}-${type}-${artifact.name}`,
    type,
    result: "passed",
    location: artifact.location,
    capturedAt: artifact.capturedAt,
    expiresAt,
    artifactSha256: artifact.digest,
    directlySupports: [...(condition.checks ?? []), ...(condition.tests ?? [])]
  };
}

export function reconcileAcceptanceEvidence({ ledger, artifacts, now = Date.now() }) {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.name, artifact]));
  const reconcile = (item) => {
    const itemCoverage = coverage[item.id] ?? {};
    const evidence = [];
    let complete = true;
    for (const type of item.requiredEvidence) {
      const alternatives = itemCoverage[type] ?? [];
      const match = alternatives.find((condition) => requirementSatisfied(artifactMap.get(condition.artifact), condition));
      if (!match) { complete = false; continue; }
      const artifact = artifactMap.get(match.artifact);
      const expiresAt = new Date(Date.parse(artifact.capturedAt) + MAX_AGE_MS).toISOString();
      if (Date.parse(artifact.capturedAt) > now + 5 * 60 * 1000 || Date.parse(expiresAt) <= now) { complete = false; continue; }
      evidence.push(evidenceRecord(item.id, type, artifact, match, expiresAt));
    }
    return { ...item, status: complete && evidence.length === item.requiredEvidence.length ? "verified" : "missing", evidence };
  };
  const refreshedAt = artifacts.filter((artifact) => artifact.usable && validTimestamp(artifact.capturedAt)).map((artifact) => artifact.capturedAt).sort().at(-1) ?? null;
  return { ...ledger, evidenceRefreshedAt: refreshedAt, groups: ledger.groups.map(reconcile), requirements: ledger.requirements.map(reconcile) };
}

export function buildCurrentEvidence({ root = repositoryRoot, now = Date.now() } = {}) {
  const ledger = JSON.parse(readFileSync(join(root, "docs", "feature-acceptance.json"), "utf8"));
  const artifacts = Object.keys(artifactDefinitions).map((name) => readArtifact(root, name));
  return { ledger: reconcileAcceptanceEvidence({ ledger, artifacts, now }), artifacts: artifacts.map(({ data: _data, ...artifact }) => artifact) };
}

function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const check = process.argv.includes("--check");
  const json = process.argv.includes("--json");
  const current = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const result = buildCurrentEvidence();
  const changed = stableJson(current) !== stableJson(result.ledger);
  if (!check) writeFileSync(ledgerPath, stableJson(result.ledger));
  if (json) process.stdout.write(stableJson({ changed, ...result }));
  else console.log(`Acceptance evidence ${check ? (changed ? "is stale" : "is current") : "refreshed"}: ${result.ledger.groups.filter((item) => item.status === "verified").length}/19 groups, ${result.ledger.requirements.filter((item) => item.status === "verified").length}/47 interface requirements.`);
  if (check && changed) process.exitCode = 1;
}
