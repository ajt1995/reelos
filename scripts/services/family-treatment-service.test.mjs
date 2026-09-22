import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadFamilyTreatmentManifest, localEditionFingerprint, validateFamilyTreatmentManifest } from "./family-treatment-service.mjs";

const expected = { itemId: "film-1", mediaSourceId: "source-1", editionFingerprint: `sha256:${"a".repeat(64)}`, durationTicks: 600_000_000 };
const manifest = () => ({
  schema: "reelos.family-treatment/v1",
  media: { itemId: expected.itemId, mediaSourceId: expected.mediaSourceId, editionFingerprint: expected.editionFingerprint },
  timebase: { ticksPerSecond: 10_000_000, durationTicks: expected.durationTicks },
  verification: { status: "verified", verifiedAt: 1, evidenceId: "local-evidence-1" },
  intervals: {
    visual: [{ startTicks: 10, endTicks: 20, action: "hide" }, { startTicks: 30, endTicks: 40, action: "skip" }],
    audio: [{ startTicks: 10, endTicks: 20, action: "mute" }],
    subtitle: [{ startTicks: 10, endTicks: 20, action: "replace", replacement: "Darn." }],
  },
});

test("family treatment accepts only verified exact-edition, exact-timebase manifests", () => {
  assert.ok(validateFamilyTreatmentManifest(manifest(), expected));
  assert.equal(validateFamilyTreatmentManifest({ ...manifest(), media: { ...manifest().media, editionFingerprint: `sha256:${"b".repeat(64)}` } }, expected), null);
  assert.equal(validateFamilyTreatmentManifest({ ...manifest(), timebase: { ticksPerSecond: 1000, durationTicks: expected.durationTicks } }, expected), null);
  assert.equal(validateFamilyTreatmentManifest({ ...manifest(), verification: { status: "proposed", verifiedAt: 1, evidenceId: "model-guess" } }, expected), null);
});

test("family treatment rejects overlapping, out-of-range, and incomplete intervals", () => {
  const overlapping = manifest();
  overlapping.intervals.audio = [
    { startTicks: 10, endTicks: 30, action: "mute" },
    { startTicks: 20, endTicks: 40, action: "soften" },
  ];
  assert.equal(validateFamilyTreatmentManifest(overlapping, expected), null);
  const missingReplacement = manifest();
  delete missingReplacement.intervals.subtitle[0].replacement;
  assert.equal(validateFamilyTreatmentManifest(missingReplacement, expected), null);
});

test("family treatment storage fails closed when absent or mismatched", () => {
  const stateDir = fs.mkdtempSync(path.join(process.cwd(), ".family-treatment-"));
  try {
    assert.equal(loadFamilyTreatmentManifest(expected, { stateDir }).code, "family_treatment_unavailable");
    fs.mkdirSync(path.join(stateDir, "family-treatments"));
    fs.writeFileSync(path.join(stateDir, "family-treatments", "film-1.json"), JSON.stringify(manifest()));
    assert.equal(loadFamilyTreatmentManifest(expected, { stateDir }).ok, true);
    assert.equal(loadFamilyTreatmentManifest({ ...expected, mediaSourceId: "other" }, { stateDir }).code, "family_treatment_unverified");
  } finally { fs.rmSync(stateDir, { recursive: true, force: true }); }
});

test("local edition fingerprints change when the verified file changes", () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".family-edition-"));
  const file = path.join(dir, "film.mp4");
  try {
    fs.writeFileSync(file, "one");
    const first = localEditionFingerprint(file);
    fs.appendFileSync(file, "-two");
    assert.notEqual(localEditionFingerprint(file), first);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
