#!/usr/bin/env node
/** Canonical source-runtime release boundary shared by every native packer. */
import { createHash } from "node:crypto";
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync,
  statSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_RUNTIME_ENTRIES = Object.freeze([
  "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "VERSION",
  "channel.json", "channel-beta.json", "src", "scripts", "server", "prebuilt", "public",
]);

const PRIVATE_PARTS = new Set([
  ".git", ".reelos-state", ".reelos-private", ".reelos-test-state", "node_modules",
  "owner-indexers.json", "indexer-presets.private.json",
]);
const BINARY_OR_SECRET_EXTENSIONS = /\.(?:key|token|pem|p12|pfx|iso|zip|tar|gz|apk|exe)$/i;
const RETIRED_RUNTIME_PATHS = Object.freeze([
  /(^|\/)install\/compose(?:\/|$)/i,
  /(^|\/)install\/bin\/wiring(?:\/|$)/i,
  /(^|\/)install\/bin\/wire-engines(?:\.|\/|$)/i,
  /(^|\/)install\/bin\/(?:lock-download-clients|stuck-downloads|sonarr_manual_import)\./i,
  /(^|\/)scripts\/services\/(?:fleet-learning-service|anonymous-gossip-service|cinema-brain-loader|basement-lighthouse-service|neural-scale-engine|neural-distillation-service|yield-simulation-testbench|jellyfin-service)\.mjs$/i,
]);
const TEXT_EXTENSIONS = new Set([
  "", ".cjs", ".css", ".html", ".ini", ".js", ".json", ".jsx", ".md", ".mjs",
  ".plist", ".ps1", ".py", ".sh", ".svg", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
]);
const SECRET_PATTERNS = Object.freeze([
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { id: "github-token", pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/ },
  { id: "slack-token", pattern: /\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{20,}\b/ },
  { id: "openai-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/ },
]);

function portable(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function releasePathDecision(relativePath) {
  const path = portable(relativePath);
  const parts = path.split("/").filter(Boolean);
  const leaf = parts.at(-1) || "";
  if (!path || parts.some((part) => PRIVATE_PARTS.has(part))) return { allowed: false, reason: "private-path" };
  if (leaf === ".env" || leaf.startsWith(".env.")) return { allowed: false, reason: "environment-file" };
  if (BINARY_OR_SECRET_EXTENSIONS.test(leaf)) return { allowed: false, reason: "binary-or-secret-extension" };
  if (/\.test\.(?:mjs|js|ts|tsx)$/i.test(leaf)) return { allowed: false, reason: "test-source" };
  if (/(^|\/)public\/install\//i.test(path) || /(^|\/)dist(?:-[^/]+)?\//i.test(path)) {
    return { allowed: false, reason: "generated-artifact" };
  }
  if (RETIRED_RUNTIME_PATHS.some((pattern) => pattern.test(path))) return { allowed: false, reason: "retired-runtime" };
  return { allowed: true, reason: "runtime" };
}

export function shouldIncludeReleasePath(relativePath) {
  return releasePathDecision(relativePath).allowed;
}

export function copyReleasePath(source, destination, baseRelative) {
  if (!existsSync(source)) return;
  cpSync(source, destination, {
    recursive: true,
    filter: (current) => {
      const rel = relative(source, current);
      const candidate = rel ? join(baseRelative, rel) : baseRelative;
      return shouldIncludeReleasePath(candidate);
    },
  });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function extension(path) {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index <= 0 ? "" : name.slice(index).toLowerCase();
}

export function listReleaseFiles(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    const info = lstatSync(full);
    if (info.isSymbolicLink()) throw new Error(`Release artifacts cannot contain symbolic links: ${portable(relative(root, full))}`);
    if (entry.isDirectory()) listReleaseFiles(root, full, output);
    else if (entry.isFile()) output.push({
      path: portable(relative(root, full)), bytes: info.size, sha256: sha256(full),
    });
  }
  return output;
}

function packageMetadata(root) {
  const candidates = [join(root, "package.json"), join(root, "app", "package.json")];
  const file = candidates.find(existsSync);
  if (!file) throw new Error("Release artifact is missing package.json.");
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (typeof data.name !== "string" || typeof data.version !== "string") throw new Error("package.json lacks release identity.");
  return { name: data.name, version: data.version };
}

function capabilitySource(repoRoot) {
  const file = join(repoRoot, "docs", "agent-context", "neural-capabilities.json");
  if (!existsSync(file)) throw new Error("Canonical neural capability context is missing.");
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) throw new Error("Capability context contains no registered capabilities.");
  return data;
}

function sourceRevision(repoRoot) {
  const explicit = String(process.env.REELOS_SOURCE_REVISION || "").trim();
  if (explicit) return explicit;
  try {
    const dotGit = join(repoRoot, ".git");
    let gitDir = dotGit;
    if (statSync(dotGit).isFile()) {
      const match = readFileSync(dotGit, "utf8").match(/^gitdir:\s*(.+)$/m);
      if (match) gitDir = resolve(repoRoot, match[1].trim());
    }
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (/^[a-f0-9]{40}$/i.test(head)) return head;
    const ref = head.match(/^ref:\s*(.+)$/)?.[1];
    if (ref) {
      const refFile = join(gitDir, ...ref.split("/"));
      if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
    }
  } catch { /* A source archive may not contain Git metadata. */ }
  return "unavailable";
}

function scanSecrets(root, files) {
  const findings = [];
  for (const entry of files) {
    if (entry.bytes > 2 * 1024 * 1024 || !TEXT_EXTENSIONS.has(extension(entry.path))) continue;
    const content = readFileSync(join(root, ...entry.path.split("/")), "utf8");
    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(content)) findings.push(`${entry.path}:${rule.id}`);
    }
  }
  return findings;
}

export function writeReleaseManifests({ artifactRoot, repoRoot, platform, artifactKind = "source-runtime" }) {
  const absoluteArtifact = resolve(artifactRoot);
  const absoluteRepo = resolve(repoRoot);
  const metadata = packageMetadata(absoluteArtifact);
  const capabilities = capabilitySource(absoluteRepo);
  const capabilityManifest = {
    schema: "reelos-capability-manifest/v1",
    systemStatement: capabilities.systemStatement,
    dataFlow: capabilities.dataFlow,
    capabilities: capabilities.capabilities.map((item) => ({
      id: item.id, owner: item.owner, lifecycle: item.lifecycle,
      coordinatorRoute: item.coordinatorRoute, fallback: item.fallback,
    })),
  };
  writeFileSync(join(absoluteArtifact, "capability-manifest.json"), `${JSON.stringify(capabilityManifest, null, 2)}\n`);
  rmSync(join(absoluteArtifact, "bundle-manifest.json"), { force: true });
  const files = listReleaseFiles(absoluteArtifact).sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schema: "reelos-release-artifact/v1",
    product: metadata.name,
    version: metadata.version,
    platform,
    artifactKind,
    provenance: { sourceRevision: sourceRevision(absoluteRepo), source: "source-checkout" },
    capabilityManifest: "capability-manifest.json",
    assurance: {
      buildState: "built",
      signatureState: "unsigned",
      notarizationState: platform === "macos" ? "unnotarized" : "not-applicable",
      realDeviceState: "real-device-unverified",
    },
    files,
  };
  writeFileSync(join(absoluteArtifact, "bundle-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyReleaseDirectory({ artifactRoot: absoluteArtifact, platform });
}

export function verifyReleaseDirectory({ artifactRoot, platform }) {
  const root = resolve(artifactRoot);
  const manifestFile = join(root, "bundle-manifest.json");
  const capabilityFile = join(root, "capability-manifest.json");
  if (!existsSync(manifestFile) || !existsSync(capabilityFile)) throw new Error("Release artifact requires bundle and capability manifests.");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const capabilities = JSON.parse(readFileSync(capabilityFile, "utf8"));
  if (manifest.schema !== "reelos-release-artifact/v1" || manifest.product !== "reelos") throw new Error("Release manifest identity is invalid.");
  if (platform && manifest.platform !== platform) throw new Error(`Release platform mismatch: expected ${platform}, received ${manifest.platform}.`);
  if (typeof manifest.version !== "string" || !manifest.version || typeof manifest.provenance?.sourceRevision !== "string") {
    throw new Error("Release manifest lacks version or provenance.");
  }
  if (manifest.assurance?.buildState !== "built"
    || manifest.assurance?.signatureState !== "unsigned"
    || !["unnotarized", "not-applicable"].includes(manifest.assurance?.notarizationState)
    || manifest.assurance?.realDeviceState !== "real-device-unverified") {
    throw new Error("Release manifest must state its unsigned and real-device-unverified assurance level.");
  }
  const metadata = packageMetadata(root);
  if (metadata.name !== manifest.product || metadata.version !== manifest.version) {
    throw new Error("Release manifest does not match the packaged application identity.");
  }
  if (manifest.capabilityManifest !== "capability-manifest.json" || capabilities.schema !== "reelos-capability-manifest/v1"
    || !Array.isArray(capabilities.capabilities) || capabilities.capabilities.length === 0) {
    throw new Error("Release capability manifest is invalid.");
  }
  const actual = listReleaseFiles(root)
    .filter((entry) => entry.path !== "bundle-manifest.json")
    .sort((a, b) => a.path.localeCompare(b.path));
  const expected = Array.isArray(manifest.files) ? [...manifest.files].sort((a, b) => a.path.localeCompare(b.path)) : [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Release file hashes do not match bundle-manifest.json.");
  const forbidden = actual.filter((entry) => !shouldIncludeReleasePath(entry.path));
  if (forbidden.length) throw new Error(`Release contains forbidden paths: ${forbidden.map((item) => item.path).join(", ")}`);
  const secrets = scanSecrets(root, actual);
  if (secrets.length) throw new Error(`Release contains suspicious secret material: ${secrets.join(", ")}`);
  return { manifest, capabilities, files: actual };
}

export function stageReleaseRuntime({ repoRoot, outputRoot, platform }) {
  const root = resolve(repoRoot);
  const output = resolve(outputRoot);
  mkdirSync(output, { recursive: true });
  for (const entry of RELEASE_RUNTIME_ENTRIES) copyReleasePath(join(root, entry), join(output, entry), entry);
  return writeReleaseManifests({ artifactRoot: output, repoRoot: root, platform });
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function main() {
  const action = process.argv[2];
  const root = valueAfter("--root");
  const artifact = valueAfter("--artifact");
  const platform = valueAfter("--platform");
  if (!root || !artifact || !platform) throw new Error("Usage: release-artifact-boundary.mjs <stage|finalize|verify> --root <repo> --artifact <dir> --platform <name>");
  const result = action === "stage"
    ? stageReleaseRuntime({ repoRoot: root, outputRoot: artifact, platform })
    : action === "finalize"
      ? writeReleaseManifests({ artifactRoot: artifact, repoRoot: root, platform })
      : action === "verify"
        ? verifyReleaseDirectory({ artifactRoot: artifact, platform })
        : (() => { throw new Error(`Unknown release-boundary action: ${action}`); })();
  process.stdout.write(`Verified ${result.files.length} ${platform} release files.\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
