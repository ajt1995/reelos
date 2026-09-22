import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFeatureAcceptance } from "./feature-acceptance.mjs";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts", "feature-acceptance.mjs");

test("acceptance ledger maps every active group and every interface requirement", () => {
  const report = JSON.parse(execFileSync(process.execPath, [script, "--json"], { cwd: root, encoding: "utf8" }));
  assert.equal(report.summary.activeFeatureCount, 19);
  assert.equal(report.summary.groupCount, 19);
  assert.equal(report.summary.interfaceRequirementCount, 47);
  assert.equal(report.summary.mappedRequirementCount, 47);
  assert.deepEqual(report.failures, []);
});

test("partial proof reports the smallest remaining blocker category", () => {
  const ledger = JSON.parse(readFileSync(resolve(root, "docs", "feature-acceptance.json"), "utf8"));
  const register = JSON.parse(readFileSync(resolve(root, "docs", "feature-register.json"), "utf8"));
  const interfaceMarkdown = readFileSync(resolve(root, "docs", "INTERFACE-FEATURE-REGISTER.md"), "utf8");
  const devices = ledger.groups.find((item) => item.id === "group-devices-and-installation");
  devices.status = "missing";
  devices.evidence = [{ id: "device-contract", type: "automated-test", result: "passed", location: "scripts/feature-acceptance.test.mjs", capturedAt: "2026-09-21T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" }];
  const report = buildFeatureAcceptance({ now: Date.parse("2026-09-21T01:00:00.000Z"), ledger, register, interfaceMarkdown });
  const blocker = report.blockerDetails.find((item) => item.id === devices.id);
  assert.equal(blocker.category, "hardware-external");
  assert.deepEqual(blocker.missingEvidence, ["hardware-run"]);
});

test("release acceptance exits nonzero until observed evidence is recorded", () => {
  const result = spawnSync(process.execPath, [script, "--check"], { cwd: root, encoding: "utf8" });
  const report = JSON.parse(execFileSync(process.execPath, [script, "--json"], { cwd: root, encoding: "utf8" }));
  assert.equal(report.summary.releaseReady, false);
  assert.equal(result.status, 1);
  assert.ok(report.summary.blockedAcceptance > 0);
});

test("skipped and expired evidence cannot be represented as acceptance", () => {
  const ledger = JSON.parse(readFileSync(resolve(root, "docs", "feature-acceptance.json"), "utf8"));
  const register = JSON.parse(readFileSync(resolve(root, "docs", "feature-register.json"), "utf8"));
  const interfaceMarkdown = readFileSync(resolve(root, "docs", "INTERFACE-FEATURE-REGISTER.md"), "utf8");
  const group = ledger.groups[0];
  group.status = "verified";
  group.evidence = [
    { id: "skipped-proof", type: "automated-test", result: "skipped", location: "scripts/feature-acceptance.test.mjs", capturedAt: "2026-09-20T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" },
    { id: "expired-proof", type: "observed-run", result: "passed", location: "scripts/feature-acceptance.test.mjs", capturedAt: "2026-09-20T00:00:00.000Z", expiresAt: "2026-09-20T00:00:00.000Z" }
  ];
  const report = buildFeatureAcceptance({ now: Date.parse("2026-09-21T00:00:00.000Z"), ledger, register, interfaceMarkdown });
  assert.equal(report.summary.releaseReady, false);
  assert.ok(report.failures.some((failure) => failure.includes("evidence was skipped")));
  assert.ok(report.failures.some((failure) => failure.includes("evidence is stale")));
});
