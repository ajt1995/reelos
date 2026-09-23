import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AmbientPlaybackService, DEFAULT_AMBIENT_CHANNELS } from "./ambient-playback-service.mjs";

test("AmbientPlaybackService exposes default curator channels and supports D-pad flipping", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-ambient-test-"));
  const service = new AmbientPlaybackService({ stateDir: tmpDir });

  const channels = service.getChannels();
  assert.equal(channels.length, DEFAULT_AMBIENT_CHANNELS.length);
  assert.equal(channels[0].name, "Comfort Sitcoms");
  assert.equal(channels[0].isCurrent, true);

  // Flip next
  const next = service.flipChannel("next");
  assert.equal(next.id, "nature-slow-cinema");
  assert.equal(service.getCurrentChannel().id, "nature-slow-cinema");

  // Flip prev
  const prev = service.flipChannel("prev");
  assert.equal(prev.id, "comfort-sitcoms");

  // Wraparound prev
  const wrap = service.flipChannel("prev");
  assert.equal(wrap.id, "resident-cinema-radio");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AmbientPlaybackService enforces Watch History Isolation", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-ambient-test-"));
  const service = new AmbientPlaybackService({ stateDir: tmpDir });

  const session = service.startAmbientSession({
    titleId: "seinfeld-s04e11",
    titleName: "The Contest",
    channelId: "comfort-sitcoms",
  });

  assert.equal(session.ambient, true);
  assert.equal(session.isolatedWatchHistory, true);
  assert.equal(session.titleId, "seinfeld-s04e11");

  // Heartbeat updates position in isolated state
  service.heartbeatAmbientSession(120000);
  assert.equal(service.activeSession.positionMs, 120000);

  // Presence check confirms ambient policy
  const presence = service.evaluatePresence();
  assert.equal(presence.isAmbient, true);
  assert.equal(presence.watchHistoryPolicy, "isolated");
  assert.equal(presence.recommendedProfile, "720p-low-bitrate");

  // Stop session
  const ended = service.stopAmbientSession();
  assert.equal(ended.titleId, "seinfeld-s04e11");
  assert.equal(service.activeSession, null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AmbientPlaybackService detects idle low attention and switches profile recommendation", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-ambient-test-"));
  const service = new AmbientPlaybackService({ stateDir: tmpDir });

  // Simulate idle for > 45 minutes
  service.presenceState.lastInteractionAt = Date.now() - 50 * 60 * 1000;

  const evaluation = service.evaluatePresence(45 * 60 * 1000);
  assert.equal(evaluation.lowAttentionDetected, true);
  assert.equal(evaluation.recommendedProfile, "720p-low-bitrate");
  assert.equal(evaluation.watchHistoryPolicy, "isolated");

  // User interacts with remote/player
  service.recordInteraction();
  const freshEvaluation = service.evaluatePresence(45 * 60 * 1000);
  assert.equal(freshEvaluation.lowAttentionDetected, false);
  assert.equal(freshEvaluation.recommendedProfile, "source-max");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
