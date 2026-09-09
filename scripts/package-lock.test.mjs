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
  const keys = Object.keys(lock.packages || {});
  assert.ok(
    keys.some((k) => k === "node_modules/fast-uri" || k.endsWith("/fast-uri")),
    "lockfile must include fast-uri (ajv 8)",
  );
  assert.ok(
    keys.some((k) => k === "node_modules/require-from-string" || k.endsWith("/require-from-string")),
    "lockfile must include require-from-string",
  );
  const ajv = lock.packages["node_modules/ajv"];
  assert.ok(ajv, "lockfile must have a hoisted ajv");
  assert.match(String(ajv.version), /^(6|8)\./);
});
