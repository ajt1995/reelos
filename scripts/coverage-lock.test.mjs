import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const run = (script, args = []) => execFileSync(process.execPath, [resolve(root, "scripts", script), ...args], { cwd: root, encoding: "utf8" });

test("coverage lock classifies every test and reconciles every historical group", () => {
  const tests = JSON.parse(run("test-inventory.mjs", ["--json"]));
  const vision = JSON.parse(run("vision-reconciliation.mjs", ["--json"]));
  assert.ok(tests.testCount >= 200);
  assert.deepEqual(tests.unclassified, []);
  assert.ok(vision.entryCount >= 8);
  assert.equal(vision.activeFeatureCount, 19);
  assert.equal(vision.interfaceRequirementCount, 47);
  assert.deepEqual(vision.failures, []);
});

test("release acceptance refuses inventory-only or stale claims", () => {
  const result = execFileSync(process.execPath, [resolve(root, "scripts", "feature-acceptance.mjs"), "--json"], { cwd: root, encoding: "utf8" });
  const acceptance = JSON.parse(result);
  assert.equal(acceptance.summary.activeFeatureCount, 19);
  assert.equal(acceptance.summary.interfaceRequirementCount, 47);
  assert.equal(acceptance.summary.releaseReady, false);
  assert.ok(acceptance.summary.blockedAcceptance > 0);
});

test("runtime doctor is read-only and reports local prerequisites", () => {
  const doctor = JSON.parse(run("runtime-doctor.mjs", ["--json"]));
  assert.equal(doctor.schema, "reelos-runtime-doctor/v1");
  assert.equal(typeof doctor.tools.ffmpeg === "string" || doctor.tools.ffmpeg === null, true);
  assert.equal(typeof doctor.localConcierge.eligible, "boolean");
});
