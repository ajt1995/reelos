import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildTestInventory } from "./test-inventory.mjs";
import { mediaToolEnvironment } from "./local-tool-discovery.mjs";

const root = path.resolve(import.meta.dirname, "..");
const testTemp = path.join(root, ".reelos-test-tmp");
fs.mkdirSync(testTemp, { recursive: true });
const testEnvironment = {
  ...mediaToolEnvironment(root),
  ...process.env,
  TEMP: testTemp,
  TMP: testTemp,
};

const requested = process.argv.find((arg) => arg.startsWith("--group="))?.slice("--group=".length) || "release";
const inventory = buildTestInventory();
const selected = inventory.tests.filter((test) => test.disposition === requested).map((test) => test.file);

if (!selected.length) {
  console.error(`No tests are classified as ${requested}.`);
  process.exitCode = 1;
} else {
  const scriptTests = selected.filter((file) => file.endsWith(".test.mjs"));
  const sourceTests = selected.filter((file) => file.endsWith(".test.ts"));
  const run = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env: testEnvironment });
  console.log(`Running ${selected.length} ${requested} tests.`);
  const scriptResult = scriptTests.length ? run(["--test", "--test-concurrency=1", ...scriptTests]) : { status: 0 };
  const sourceResult = scriptResult.status === 0 && sourceTests.length
    ? run(["--experimental-strip-types", "--test", ...sourceTests])
    : { status: scriptResult.status };
  if (scriptResult.status !== 0 || sourceResult.status !== 0) process.exitCode = scriptResult.status || sourceResult.status || 1;
}
