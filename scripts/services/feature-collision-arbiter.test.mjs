import test from "node:test";
import assert from "node:assert";
import EventEmitter from "node:events";
import { FeatureCollisionArbiter, ARBITER_STATES } from "./feature-collision-arbiter.mjs";

test("FeatureCollisionArbiter: transitions into ACTIVE_PLAYBACK when video starts", () => {
  const arbiter = new FeatureCollisionArbiter({ isDedicated: false });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.IDLE);

  arbiter.notifyPlaybackStart("session-1", { itemId: "movie-1" });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.PLAYBACK);

  const perms = arbiter.getFeaturePermissions();
  assert.strictEqual(perms.canStreamVideo, true);
  assert.strictEqual(perms.canUseAudioDsp, true);
  assert.strictEqual(perms.canPreWarmNextEpisode, false);
  assert.strictEqual(perms.canRunGossipMesh, false);
});

test("FeatureCollisionArbiter: activates BINGE_PREWARM only at >85% completion with healthy buffer", () => {
  const arbiter = new FeatureCollisionArbiter({ isDedicated: false });
  arbiter.notifyPlaybackStart("session-2", { itemId: "series-ep-1", isSeries: true });

  arbiter.notifyPlaybackProgress("session-2", { positionMs: 50000, durationMs: 100000, bufferedMs: 10000 });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.PLAYBACK);
  assert.strictEqual(arbiter.requestPermission("canPreWarmNextEpisode"), false);

  arbiter.notifyPlaybackProgress("session-2", { positionMs: 86000, durationMs: 100000, bufferedMs: 12000 });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.BINGE_PREWARM);
  assert.strictEqual(arbiter.requestPermission("canPreWarmNextEpisode"), true);
});

test("FeatureCollisionArbiter: GAMING_YIELD takes absolute precedence and suppresses background networking", () => {
  const mockSentinel = new EventEmitter();
  const arbiter = new FeatureCollisionArbiter({ isDedicated: false, consoleSentinel: mockSentinel });

  arbiter.notifyPlaybackStart("session-3", { itemId: "series-ep-2" });
  arbiter.notifyPlaybackProgress("session-3", { positionMs: 90000, durationMs: 100000, bufferedMs: 15000 });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.BINGE_PREWARM);

  // Gaming traffic begins on PS5
  mockSentinel.emit("CONSOLES_GAMING_YIELD", { reason: "ping_spike_25ms" });
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.GAMING_YIELD);

  const perms = arbiter.getFeaturePermissions();
  assert.strictEqual(perms.canPreWarmNextEpisode, false);
  assert.strictEqual(perms.canRunGossipMesh, false);
  assert.strictEqual(perms.stealthMemoryFloorActive, true);
  assert.strictEqual(perms.stealthMemoryMb, 48); // Safe 32MB–64MB floor

  // Gaming resumes normal state
  mockSentinel.emit("CONSOLES_GAMING_RESUME");
  assert.strictEqual(arbiter.activeState, ARBITER_STATES.BINGE_PREWARM);
  assert.strictEqual(arbiter.requestPermission("canPreWarmNextEpisode"), true);
});
