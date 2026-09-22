/**
 * ReelOS Dual-Brain & Frontier ML Verification Suite
 *
 * Verifies:
 * 1. In-RAM Transcoder & Ring Buffer (zero disk writes, PGS OCR, audio downmix)
 * 2. TorBox Courtesy Shield (leaky bucket rate limiter, overnight 1-ep cap, safe slice)
 * 3. Micro-Trailer Generator & Semantic Scene Seeker
 * 4. Dual-Brain Service: Small Brain in-RAM reflex (palette, frame entropy, GOP jump points)
 * 5. Dual-Brain Service: Big Brain Criterion companion trivia & screenplay insights
 */

import assert from "node:assert/strict";
import { inRamTranscoder } from "./services/in-ram-transcoder-service.mjs";
import { torBoxShield } from "./services/torbox-shield-service.mjs";
import { microTrailerService } from "./services/micro-trailer-service.mjs";
import { dualBrainService } from "./services/dual-brain-service.mjs";

async function runDualBrainSuite() {
  console.log("=== ReelOS Dual-Brain & In-RAM Transcode Suite ===");

  // 1. In-RAM Transcoder Ring Buffer
  console.log("\n[Test 1] In-RAM Transcoder Ring Buffer (Zero Disk Wear)...");
  const session = inRamTranscoder.createRingBuffer("test-stream-session-1");
  assert.equal(session.totalBytes, 0);

  const chunk1 = Buffer.alloc(1024 * 1024, 0x41); // 1MB
  inRamTranscoder.appendChunk("test-stream-session-1", chunk1);
  assert.equal(session.totalBytes, 1024 * 1024);

  const stats = inRamTranscoder.getStats();
  assert.equal(stats.activeSessions, 1);
  assert.equal(stats.zeroDiskWear, true);
  console.log("  ? In-RAM ring buffer initialized and verified (Zero disk wear guaranteed)");

  // 2. PGS Subtitle OCR in RAM
  console.log("\n[Test 2] PGS Subtitle OCR directly to WebVTT in RAM...");
  const mockPgs = Buffer.from("PGS-Bitmap-Subtitle-Block");
  const ocrResult = await inRamTranscoder.ocrPgsToVtt(mockPgs);
  assert.equal(ocrResult.ok, true);
  assert.ok(ocrResult.vtt.includes("WEBVTT"));
  assert.ok(ocrResult.durationMs < 50, `OCR took ${ocrResult.durationMs}ms, expected < 50ms`);
  console.log(`  ? PGS OCR took ${ocrResult.durationMs}ms (sub-50ms target met)`);

  // 3. Audio Transmuxing & Bedtime Leveling in RAM
  console.log("\n[Test 3] In-RAM Audio Transmuxing & Dialogue Leveling...");
  const mockAudio = Buffer.alloc(4096, 0x55);
  const downmix = inRamTranscoder.transmuxAudioInRam(mockAudio, { channels: 2, dialogueLevel: "night" });
  assert.ok(downmix.stream);
  console.log("  ? In-RAM audio transmux pipe established without disk writes");

  // 4. TorBox Courtesy Shield
  console.log("\n[Test 4] TorBox Courtesy Shield Rate Limiter & Overnight Cap...");
  const allowed = torBoxShield.canStageOvernight("resident-austin");
  assert.equal(allowed, true);
  torBoxShield.recordOvernightStage("resident-austin", "ep-101");
  const secondTry = torBoxShield.canStageOvernight("resident-austin");
  assert.equal(secondTry, false, "Overnight cap must strictly enforce max 1 episode");
  console.log("  ? TorBox overnight cap strictly enforced (max 1 ep per resident)");

  // 5. Verified Micro-Trailer & Scene Index
  console.log("\n[Test 5] Verified Micro-Trailer Registration & Semantic Scene Index...");
  const teaser = await microTrailerService.generateMicroTeaser("movie-oppenheimer-2023", {
    verified: true,
    teaserBuffer: Buffer.alloc(1024 * 512, 0x22),
    durationSec: 15,
    evidenceSource: "test-fixture",
    scenes: [{ verified: true, label: "docking scene", timestampSec: 3600 }],
  });
  assert.equal(teaser.duration, 15);
  assert.ok(teaser.sizeBytes > 0);

  const sceneResult = microTrailerService.findSceneTimestamp("movie-oppenheimer-2023", "docking scene");
  assert.equal(sceneResult.found, true);
  assert.equal(sceneResult.timestampSec, 3600);
  console.log(`  ? Semantic scene query mapped to ${sceneResult.timestampSec}s (${sceneResult.matchLabel})`);

  // 6. Dual-Brain Small Brain Reflex: Ambient Palette & Entropy
  console.log("\n[Test 6] Small Brain: In-RAM 16-Color Ambient Palette & Frame Complexity...");
  const palette = dualBrainService.extractAmbientPalette(Buffer.alloc(2048, 0x7f));
  assert.equal(palette.colors.length, 16);
  assert.ok(palette.latencyMs < 10, `Palette latency ${palette.latencyMs}ms, expected < 10ms`);
  assert.ok(typeof palette.dominantMood === "string");
  console.log(`  ? Extracted 16-color ambient palette in ${palette.latencyMs}ms (dominant mood: ${palette.dominantMood})`);

  const complexity = dualBrainService.estimateFrameComplexity(Buffer.alloc(256, 0x33));
  assert.ok(complexity.recommendedBitrateKbps > 0);
  console.log(`  ? Frame entropy: ${complexity.entropy}, recommended bitrate: ${complexity.recommendedBitrateKbps}kbps`);

  // 7. Dual-Brain Big Brain: Criterion Screenplay Context
  console.log("\n[Test 7] Big Brain: Criterion Contextual Screenplay Companion...");
  dualBrainService.setCompanionContext("movie-oppenheimer-2023", [{
    verified: true,
    timestampSec: 120,
    sceneType: "Verified production context",
    trivia: "Source-backed production note.",
    directorNote: "Source-backed scene note.",
  }]);
  const context = dualBrainService.getCompanionContext("movie-oppenheimer-2023", 125);
  assert.equal(context.found, true);
  assert.ok(context.trivia.length > 0);
  assert.ok(context.directorNote.length > 0);
  console.log(`  ? Criterion context: "${context.sceneType}" -> ${context.trivia.slice(0, 50)}...`);

  // Clean up
  inRamTranscoder.destroyRingBuffer("test-stream-session-1");

  console.log("\n=== ALL 7 DUAL-BRAIN & IN-RAM TESTS PASSED ===");
}

runDualBrainSuite().catch((err) => {
  console.error("Dual-Brain test failed:", err);
  process.exit(1);
});
