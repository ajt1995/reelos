import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts", "context-brief.mjs");

test("context brief is compact, machine-readable, and points to real entry files", () => {
  const output = execFileSync(process.execPath, [script, "--json"], { cwd: root, encoding: "utf8" });
  const context = JSON.parse(output);
  assert.equal(context.schema, "reelos-agent-context/v1");
  assert.ok(context.scope.activeFeatures.includes("home"));
  assert.ok(context.scope.decisionIds.includes("source-policy"));
  assert.ok(context.scope.decisionIds.includes("neural-system-identity"));
  assert.match(context.architecture.identity, /one end-to-end local neural system/);
  assert.equal(context.architecture.registeredCapabilities, 15);
  assert.equal(context.architecture.coordinatorConnected, 15);
  assert.equal(typeof context.repository.gitAvailable, "boolean");
  assert.ok(context.startHere.interface.includes("src/experience/reelos-world.tsx"));
  assert.ok(context.startHere.neuralSystem.includes("docs/agent-context/neural-capabilities.json"));
  assert.ok(context.startHere.workstreams.includes("docs/agent-context/workstreams.json"));
  assert.ok(context.validation["context:brief"]);
  assert.deepEqual(context.validationFailures, []);
});
