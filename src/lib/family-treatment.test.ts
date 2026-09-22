import test from "node:test";
import assert from "node:assert/strict";
import { familyTreatmentFrame, parseFamilyTreatmentManifest } from "./family-treatment.ts";

const manifest = {
  schema: "reelos.family-treatment/v1",
  media: { itemId: "film", mediaSourceId: "source", editionFingerprint: "sha256:abc" },
  timebase: { ticksPerSecond: 10_000_000, durationTicks: 1_000_000_000 },
  verification: { status: "verified", verifiedAt: 1, evidenceId: "evidence" },
  intervals: {
    visual: [{ startTicks: 100_000_000, endTicks: 200_000_000, action: "skip" }],
    audio: [{ startTicks: 300_000_000, endTicks: 400_000_000, action: "soften" }],
    subtitle: [{ startTicks: 500_000_000, endTicks: 600_000_000, action: "replace", replacement: "Oh, darn." }],
  },
} as const;

test("family executor applies exact verified intervals and stricter audio fallback", () => {
  const parsed = parseFamilyTreatmentManifest(manifest);
  assert.ok(parsed);
  assert.equal(familyTreatmentFrame(parsed, 15).skipToSeconds, 20);
  assert.equal(familyTreatmentFrame(parsed, 35).muteAudio, true);
  assert.deepEqual(familyTreatmentFrame(parsed, 55), {
    skipToSeconds: null, hideVisual: false, muteAudio: false, hideSubtitles: true, subtitleReplacement: "Oh, darn.",
  });
  assert.equal(familyTreatmentFrame(parsed, 65).hideSubtitles, false);
});

test("family executor rejects unverified, malformed, and overlapping manifests", () => {
  assert.equal(parseFamilyTreatmentManifest({ ...manifest, verification: { ...manifest.verification, status: "proposed" } }), null);
  assert.equal(parseFamilyTreatmentManifest({ ...manifest, intervals: { ...manifest.intervals, audio: [
    { startTicks: 30, endTicks: 50, action: "mute" }, { startTicks: 40, endTicks: 60, action: "mute" },
  ] } }), null);
  assert.deepEqual(familyTreatmentFrame(null, 10), {
    skipToSeconds: null, hideVisual: false, muteAudio: false, hideSubtitles: false, subtitleReplacement: null,
  });
});
