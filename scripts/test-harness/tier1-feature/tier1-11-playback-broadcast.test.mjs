import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F11.1 Playback Broadcast: handles play action and updates room state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "PLAY01" });

  const res = service.updatePlayback("PLAY01", "user-1", {
    action: "play",
    currentTime: 10.5,
    playbackRate: 1.0,
  });

  assert.equal(res.ok, true);
  assert.equal(res.playback.isPlaying, true);
  assert.equal(res.playback.currentTime, 10.5);
  assert.equal(res.playback.playbackRate, 1.0);
});

test("Tier 1 - F11.2 Playback Broadcast: handles pause action and updates room state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "PLAY02" });

  service.updatePlayback("PLAY02", "user-1", { action: "play", currentTime: 20 });
  const pauseRes = service.updatePlayback("PLAY02", "user-1", { action: "pause", currentTime: 45.2 });

  assert.equal(pauseRes.ok, true);
  assert.equal(pauseRes.playback.isPlaying, false);
  assert.equal(pauseRes.playback.currentTime, 45.2);
});

test("Tier 1 - F11.3 Playback Broadcast: handles seek action to arbitrary timestamp", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "PLAY03" });

  const seekRes = service.updatePlayback("PLAY03", "user-2", {
    action: "seek",
    currentTime: 120.0,
  });

  assert.equal(seekRes.ok, true);
  assert.equal(seekRes.playback.currentTime, 120.0);
});

test("Tier 1 - F11.4 Playback Broadcast: updates custom playback rate (e.g. 1.5x)", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "PLAY04" });

  const rateRes = service.updatePlayback("PLAY04", "user-1", {
    action: "play",
    currentTime: 0,
    playbackRate: 1.5,
  });

  assert.equal(rateRes.ok, true);
  assert.equal(rateRes.playback.playbackRate, 1.5);
});

test("Tier 1 - F11.5 Playback Broadcast: returns ok: false for non-existent room code", () => {
  const service = new WatchPartyService();
  const res = service.updatePlayback("NONEXIST", "user-1", { action: "play", currentTime: 10 });
  assert.equal(res.ok, false);
  assert.match(res.error, /Room not found/);
});
