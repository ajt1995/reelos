import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildCurrentEvidence, reconcileAcceptanceEvidence } from "./acceptance-evidence.mjs";

const root = resolve(import.meta.dirname, "..");
const baseLedger = () => JSON.parse(readFileSync(resolve(root, "docs", "feature-acceptance.json"), "utf8"));
const now = Date.parse("2026-09-21T06:00:00.000Z");
const artifact = (name, data, capturedAt = "2026-09-21T05:30:00.000Z") => ({ name, usable: true, location: `.audit/${name}.json`, capturedAt, digest: name.repeat(64).slice(0, 64), data });

const passingE2e = () => ({
  passed: 32, failed: 0, skipped: 0,
  tests: [
    "Natural-language search sits directly beneath the hero",
    "No-idea helper makes a decision and asks for feedback",
    "Home leads with artwork and a personal hero",
    "Discover is art-led, not an introductory control stack",
    "Discover keeps Search and Refine compact and functional",
    "Discover person invitations open an actual destination",
    "Discover has no horizontal overflow",
    "Profile switcher keeps personal and Family destinations separate",
    "Home search parses a precise natural-language request",
    "Personal profile destination keeps taste separate from Family administration",
    "Endless taste field replenishes and updates the Cozy collection"
  ].map((name) => ({ name, status: "PASS" }))
});

test("only direct current evidence clears its narrow acceptance mappings", () => {
  const setup = artifact("setup", { checks: ["profile isolation", "legacy destinations use acknowledged profile identity"] });
  const result = reconcileAcceptanceEvidence({ ledger: baseLedger(), artifacts: [setup, artifact("e2e", passingE2e())], now });
  assert.deepEqual(result.groups.filter((item) => item.status === "verified").map((item) => item.id), ["group-profiles-and-taste", "group-home", "group-discover"]);
  assert.deepEqual(result.requirements.filter((item) => item.status === "verified").map((item) => item.id), ["ui-active-identity", "ui-personal-destination", "ui-home-search", "ui-no-idea", "ui-taste-calibration", "ui-tonight-context", "ui-deeper-invitation", "ui-search-results"]);
  assert.ok(result.groups.find((item) => item.id === "group-family").evidence.length === 0);
  assert.ok(result.requirements.find((item) => item.id === "ui-home-hero").evidence.length === 0);
});

test("valid partial evidence is retained so the remaining blocker stays narrow", () => {
  const contract = artifact("contracts", {
    tests: [
      "native clients are paired-home clients, never direct provider clients",
      "catalog and streams cross an authenticated same-origin boundary",
      "credentials are excluded from Android backup and pairing links",
      "paired Android clients receive truthful hashed update metadata and exact bytes",
    ].map((name) => ({ name, status: "PASS" })),
  });
  const result = reconcileAcceptanceEvidence({ ledger: baseLedger(), artifacts: [contract], now });
  const devices = result.groups.find((item) => item.id === "group-devices-and-installation");
  assert.equal(devices.status, "missing");
  assert.deepEqual(devices.evidence.map((proof) => proof.type), ["automated-test"]);
});

test("skipped, stale, and future evidence never verifies acceptance", () => {
  const skipped = artifact("e2e", { ...passingE2e(), skipped: 1 });
  skipped.usable = false;
  const stale = artifact("setup", { checks: ["profile isolation", "legacy destinations use acknowledged profile identity"] }, "2026-09-19T05:00:00.000Z");
  const result = reconcileAcceptanceEvidence({ ledger: baseLedger(), artifacts: [skipped, stale], now });
  assert.equal(result.groups.some((item) => item.status === "verified"), false);
  assert.equal(result.requirements.some((item) => item.status === "verified"), false);
});

test("a generic passing artifact cannot fabricate a named interaction", () => {
  const fabricated = artifact("e2e", { passed: 30, failed: 0, skipped: 0, tests: [{ name: "everything passed", status: "PASS" }] });
  const result = reconcileAcceptanceEvidence({ ledger: baseLedger(), artifacts: [fabricated], now });
  assert.equal(result.groups.some((item) => item.status === "verified"), false);
  assert.equal(result.requirements.some((item) => item.status === "verified"), false);
});

test("current repository artifacts remain deliberately short of complete acceptance", () => {
  const result = buildCurrentEvidence({ root });
  const groupCount = result.ledger.groups.filter((item) => item.status === "verified").length;
  const requirementCount = result.ledger.requirements.filter((item) => item.status === "verified").length;
  assert.ok(groupCount < 19);
  assert.ok(requirementCount < 47);
  assert.ok(result.ledger.groups.some((item) => item.requiredEvidence.includes("hardware-run") && item.status === "missing"));
  assert.ok(result.ledger.groups.some((item) => item.requiredEvidence.includes("security-review") && item.status === "missing"));
});
