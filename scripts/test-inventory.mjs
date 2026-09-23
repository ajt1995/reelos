import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const policyPath = join(root, "docs", "test-inventory-policy.json");
const jsonMode = process.argv.includes("--json");
const checkMode = process.argv.includes("--check");

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".test-tmp", "dist", ".reelos-audit", "build", ".gradle", ".kotlin"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (/\.test\.(?:mjs|ts)$/.test(entry.name) || (/\.kt$/.test(entry.name) && /[/\\]src[/\\](?:test|smoke)[/\\]/.test(path))) files.push(path);
  }
  return files;
}

function globExpression(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("**", "___DOUBLE_STAR___").replaceAll("*", "[^/]*").replaceAll("___DOUBLE_STAR___", ".*")}$`);
}

export function buildTestInventory() {
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  const rules = (policy.rules ?? []).map((rule) => ({ ...rule, expression: globExpression(rule.match) }));
  const files = [...walk(join(root, "scripts")), ...walk(join(root, "src", "lib")), ...walk(join(root, "clients", "native"))]
    .map((path) => relative(root, path).replaceAll("\\", "/"))
    .sort();
  const tests = files.map((file) => {
    const rule = rules.find((candidate) => candidate.expression.test(file));
    return {
      file,
      disposition: rule?.disposition ?? "unclassified",
      rule: rule?.id ?? null,
      reason: rule?.reason ?? "No test-inventory policy rule matched this file."
    };
  });
  const byDisposition = Object.fromEntries(
    [...new Set(tests.map((test) => test.disposition))]
      .sort()
      .map((disposition) => [disposition, tests.filter((test) => test.disposition === disposition).length])
  );
  return {
    schema: "reelos-test-inventory/v2",
    purpose: "Classification only. A classified test is not acceptance evidence; release acceptance is evaluated by scripts/feature-acceptance.mjs.",
    testCount: tests.length,
    byDisposition,
    unclassified: tests.filter((test) => test.disposition === "unclassified").map((test) => test.file),
    tests
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "test-inventory.mjs");
if (invokedDirectly) {
  const inventory = buildTestInventory();
  if (checkMode) {
    if (inventory.unclassified.length) {
      console.error(`Test inventory failed: ${inventory.unclassified.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log(`Test inventory passed: ${inventory.testCount} tests classified (${Object.entries(inventory.byDisposition).map(([kind, count]) => `${kind}: ${count}`).join(", ")}).`);
    }
  } else if (jsonMode) {
    process.stdout.write(JSON.stringify(inventory, null, 2) + "\n");
  } else {
    console.log(`Test inventory: ${inventory.testCount} tests | ${Object.entries(inventory.byDisposition).map(([kind, count]) => `${kind}: ${count}`).join(" | ")}`);
    if (inventory.unclassified.length) console.log(`UNCLASSIFIED: ${inventory.unclassified.join(", ")}`);
  }
}
