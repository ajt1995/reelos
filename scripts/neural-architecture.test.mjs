import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { buildNeuralArchitectureReport, validateNeuralArchitecture } from "./neural-architecture.mjs";

const root = resolve(import.meta.dirname, "..");

test("neural architecture report reconciles runtime registration, coordinator wiring, and durable metadata", () => {
  const report = buildNeuralArchitectureReport();
  assert.match(report.systemStatement, /one end-to-end local neural system/);
  assert.equal(report.summary.registered, 11);
  assert.equal(report.summary.coordinatorConnected, 7);
  assert.deepEqual(validateNeuralArchitecture(report), []);
  assert.equal(report.capabilities.find((capability) => capability.id === "taste-ranking")?.coordinatorConnected, true);
  assert.equal(report.capabilities.find((capability) => capability.id === "scene-understanding")?.lifecycle, "shadow");
  assert.ok(report.retirement.some((entry) => entry.id === "jellyfin-protocol-shim" && entry.disposition === "active-shim"));
});

test("architecture check is a fail-closed command suitable for context validation", () => {
  const output = execFileSync(process.execPath, [resolve(root, "scripts", "neural-architecture.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  assert.match(output, /Neural architecture check passed/);
});
