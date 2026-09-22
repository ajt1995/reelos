import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenNames = new Set([
  ".reelos-private",
  "owner-indexers.json",
  "indexer-presets.private.json",
]);
const ignoredDirectories = new Set([
  ".git",
  ".vercel",
  "node_modules",
  "dist",
  ".test-tmp",
  ".reelos-audit",
  ".reelos-state",
  ".reelos-test-state",
]);
const failures = [];

function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch (error) {
    failures.push(`unable to inspect ${directory}: ${error.code || error.message}`);
    return;
  }
  for (const entry of entries) {
    if (ignoredDirectories.has(entry)) continue;
    // Windows test workers leave root-level tmp* directories behind. They are
    // ignored by the release artifact and must not turn an otherwise complete
    // source-policy audit into an access-denied crash.
    if (directory === root && /^tmp[a-z0-9_]+$/i.test(entry)) continue;
    const path = join(directory, entry);
    const relative = path.slice(root.length + 1).replaceAll("\\", "/");
    let info;
    try {
      info = statSync(path);
    } catch (error) {
      failures.push(`unable to inspect ${relative}: ${error.code || error.message}`);
      continue;
    }
    if (info.isDirectory()) {
      if (forbiddenNames.has(entry)) failures.push(relative);
      else walk(path);
      continue;
    }
    if (forbiddenNames.has(entry)) failures.push(relative);
  }
}

walk(root);

const moduleUrl = new URL("./services/neural-indexer-repair.mjs", import.meta.url);
delete process.env.REELOS_INDEXER_PRESETS_FILE;
const { PUBLIC_INDEXER_ROSTER } = await import(moduleUrl.href + `?public=${Date.now()}`);
if (PUBLIC_INDEXER_ROSTER.length !== 0) {
  failures.push("public runtime contains bundled indexer presets");
}

const example = JSON.parse(
  readFileSync(join(root, "config", "indexer-presets.example.json"), "utf8"),
);
if (!Array.isArray(example.presets) || example.presets.length !== 1) {
  failures.push("generic indexer example is missing or malformed");
}

if (failures.length) {
  console.error("Public release refused:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public release boundary verified: no private owner preset is bundled.");
