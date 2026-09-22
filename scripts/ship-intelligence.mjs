import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cachePath = join(root, ".reelos-audit", "ship-intelligence.json");
const jsonMode = process.argv.includes("--json");
const reset = process.argv.includes("--reset");

const roots = ["src", "scripts/services", "scripts/reelflow"];
const entryFiles = [
  "scripts/reelos-lookup-plugin.mjs",
  "scripts/reelos-books.mjs",
  "scripts/verify-public-release.mjs",
];
const extensions = new Set([".ts", ".tsx", ".mjs"]);
const ignored = new Set(["node_modules", ".vercel", "dist", "build"]);

function walk(path) {
  const out = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (
      extensions.has(extname(entry.name)) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.mjs")
    )
      out.push(full);
  }
  return out;
}

const files = [
  ...roots.flatMap((part) => {
    const path = join(root, part);
    return existsSync(path) ? walk(path) : [];
  }),
  ...entryFiles.map((part) => join(root, part)).filter(existsSync),
];
const records = files.map((path) => {
  const text = readFileSync(path, "utf8");
  return {
    path,
    rel: relative(root, path).replace(/\\/g, "/"),
    text,
    hash: createHash("sha256").update(text).digest("hex").slice(0, 16),
  };
});

const previous =
  !reset && existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : { hashes: {} };
const hashes = Object.fromEntries(
  records.map((record) => [record.rel, record.hash]),
);
const changed = records
  .filter((record) => previous.hashes?.[record.rel] !== record.hash)
  .map((record) => record.rel);
const removed = Object.keys(previous.hashes || {}).filter(
  (path) => !hashes[path],
);

function matches(pattern) {
  return records.flatMap((record) =>
    [...record.text.matchAll(pattern)].map((match) => ({
      file: record.rel,
      value: match[1] || match[0],
      line: record.text.slice(0, match.index).split("\n").length,
    })),
  );
}

const routes = matches(/createFileRoute\(["'`]([^"'`]+)["'`]\)/g);
const endpoints = matches(
  /apiRouter\.(?:all|get|post|put|delete|prefix)\(["'`]([^"'`]+)["'`]/g,
);
const consumerJargon = [
  "Dual-Brain",
  "Neural",
  "In-RAM",
  "Micro-Ducking",
  "Vector",
  "Manifold",
  "Prowlarr",
  "Radarr",
  "Sonarr",
  "Decypharr",
  "Torznab",
  "FUSE",
  "Indexer",
];
const jargon = records.flatMap((record) =>
  consumerJargon.flatMap((term) => {
    if (!record.rel.startsWith("src/") || !record.text.includes(term))
      return [];
    return [
      { file: record.rel, term, count: record.text.split(term).length - 1 },
    ];
  }),
);
const placeholderSignals = matches(
  /\b(TODO|FIXME|placeholder|simulat(?:e|ed|ion)|not connected|unavailable in this preview)\b/gi,
);
const visibleButtons = matches(/<button\b/g).length;
const visibleInputs = matches(/<(?:input|select|textarea)\b/g).length;

const routeOwners = [];
for (const record of records.filter((item) =>
  item.rel.startsWith("src/routes/"),
)) {
  const imports = [
    ...record.text.matchAll(/import\s+\{?\s*([A-Za-z0-9_]+)/g),
  ].map((match) => match[1]);
  routeOwners.push({
    route: routes.find((item) => item.file === record.rel)?.value || record.rel,
    file: record.rel,
    owners: imports.slice(0, 8),
  });
}

const invariantFiles = {
  sourcePolicy: records.some((record) =>
    record.rel.endsWith("source-access-policy.mjs"),
  ),
  clientSourceAccess: records.some((record) =>
    record.rel.endsWith("source-access.ts"),
  ),
  publicCatalogs: records.some((record) =>
    record.rel.endsWith("public-catalogs.mjs"),
  ),
  publicReleaseGuard: records.some((record) =>
    record.rel.endsWith("verify-public-release.mjs"),
  ),
};

const findings = [];
const settingsRoute = records.find(
  (record) => record.rel === "src/routes/settings.tsx",
);
if (settingsRoute?.text.includes("SettingsView")) {
  findings.push({
    severity: "high",
    id: "duplicate-settings-world",
    message:
      "Direct /settings still opens the legacy technical SettingsView instead of the approved personal-world settings.",
    file: settingsRoute.rel,
  });
}
if (jargon.length) {
  findings.push({
    severity: "medium",
    id: "consumer-jargon",
    message: `${jargon.reduce((sum, item) => sum + item.count, 0)} technical/marketing terms remain in consumer UI source.`,
    files: [...new Set(jargon.map((item) => item.file))].slice(0, 12),
  });
}
if (!Object.values(invariantFiles).every(Boolean)) {
  findings.push({
    severity: "high",
    id: "source-boundary-missing",
    message: "One or more source-boundary enforcement modules are missing.",
    evidence: invariantFiles,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: {
    files: records.length,
    routes: routes.length,
    endpoints: endpoints.length,
    visibleButtons,
    visibleInputs,
  },
  delta: { changed, removed, unchanged: records.length - changed.length },
  truthBoundaries: invariantFiles,
  findings,
  evidence: {
    routeOwners,
    topJargonFiles: jargon.sort((a, b) => b.count - a.count).slice(0, 20),
    placeholderSignalCount: placeholderSignals.length,
  },
  hashes,
};

mkdirSync(dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify(report, null, 2) + "\n", "utf8");

if (jsonMode) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(
    `Ship intelligence: ${report.scope.files} files | ${report.scope.routes} routes | ${report.scope.endpoints} API entries`,
  );
  console.log(
    `Delta: ${changed.length} changed | ${removed.length} removed | ${report.delta.unchanged} unchanged`,
  );
  console.log(
    `Surface: ${visibleButtons} buttons | ${visibleInputs} fields | ${placeholderSignals.length} truth-review signals`,
  );
  if (!findings.length) console.log("No structural findings.");
  for (const finding of findings)
    console.log(`${finding.severity.toUpperCase()}: ${finding.message}`);
  console.log(`Snapshot: ${relative(root, cachePath)}`);
}
