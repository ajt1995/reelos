import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildSetupSettingsEvidence, reconcileSetupSettingsEvidence } from "./setup-settings-evidence.mjs";

const root = resolve(import.meta.dirname, "..");
const ledger = JSON.parse(readFileSync(resolve(root, "docs", "feature-acceptance.json"), "utf8"));
const requirements = ledger.requirements;
const artifact = (name, data) => ({ name, usable: true, location: `.audit/${name}.json`, capturedAt: "2026-09-21T08:00:00.000Z", artifactSha256: name.repeat(64).slice(0, 64), data });

test("setup/settings adapter covers the requested acceptance surface without granting review evidence", () => {
  const setupSource = readFileSync(resolve(root, "scripts", "test-setup-journey.mjs"), "utf8");
  const setup = artifact("setup", {
    checks: ["fresh setup", "stable roster IDs", "acknowledged completion", "draft reload", "source failure recovery", "retried taste persists privately", "phone/TV overflow", "unauthorized settings denied"],
    sources: { "scripts/test-setup-journey.mjs": "fixture" },
  });
  const e2e = artifact("e2e", { tests: [
    "Home leads with artwork and a personal hero", "Settings explains source access honestly",
  ].map((name) => ({ name, status: "PASS" })), sources: {} });
  const contracts = artifact("contracts", { tests: [
    "manual update actions are reachable on mobile and TV", "paired Android clients receive truthful hashed update metadata and exact bytes",
  ].map((name) => ({ name, status: "PASS" })), sources: {} });
  const settingsBrowser = artifact("settingsBrowser", { tests: [
    "Home curated shelves expose real title cards",
    "Motion preference persists after server acknowledgement and reload",
    "Browsing density persists after server acknowledgement and reload",
    "Help status exposes honest update recovery and capability state",
  ].map((name) => ({ name, status: "PASS" })), sources: {} });
  assert.match(setupSource, /Finish and open phone setup/);
  const result = reconcileSetupSettingsEvidence({ requirements, artifacts: [setup, e2e, contracts, settingsBrowser], root });
  assert.equal(result.length, 14);
  assert.equal(result.find((item) => item.id === "ui-setup-guidance").status, "supported");
  assert.deepEqual(result.find((item) => item.id === "ui-setup-color").missingRequiredEvidence, ["visual-review"]);
  assert.deepEqual(result.find((item) => item.id === "ui-source-choice").missingRequiredEvidence, ["security-review"]);
  assert.deepEqual(result.find((item) => item.id === "ui-deployment-choice").missingRequiredEvidence, ["hardware-run"]);
  assert.deepEqual(result.find((item) => item.id === "ui-devices").missingRequiredEvidence, ["hardware-run"]);
  assert.equal(result.find((item) => item.id === "ui-home-shelves").status, "supported");
  assert.deepEqual(result.find((item) => item.id === "ui-motion-preference").missingRequiredEvidence, ["visual-review"]);
  assert.deepEqual(result.find((item) => item.id === "ui-density-preference").missingRequiredEvidence, ["visual-review"]);
  assert.equal(result.find((item) => item.id === "ui-help-status").status, "supported");
  assert.equal(result.some((item) => item.evidence.some((proof) => ["security-review", "visual-review", "hardware-run"].includes(proof.type))), false);
});

test("current adapter output is source-fingerprinted and never hides unusable inputs", () => {
  const report = buildSetupSettingsEvidence({ root });
  assert.equal(report.schema, "reelos-setup-settings-evidence/v1");
  assert.equal(report.summary.covered, 14);
  assert.match(report.sources["scripts/setup-settings-evidence.mjs"], /^[a-f0-9]{64}$/);
  assert.equal(report.artifacts.length, 4);
  assert.equal(report.constraints.length, 3);
});
