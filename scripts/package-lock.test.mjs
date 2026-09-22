import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("package-lock.json stays in sync for house npm ci", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages?.[""]?.name, pkg.name);
  const lockRoot = lock.packages?.[""] || {};
  assert.deepEqual(lockRoot.dependencies || {}, pkg.dependencies || {});
  assert.deepEqual(lockRoot.devDependencies || {}, pkg.devDependencies || {});

  // Every direct package must be represented. Transitive package names and
  // hoisting positions are npm implementation details and can change without
  // making `npm ci` unsafe.
  for (const name of [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]) {
    assert.ok(lock.packages?.[`node_modules/${name}`], `lockfile is missing direct dependency ${name}`);
  }
});
