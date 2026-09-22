import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F11.1 Playback Boundary: negative currentTime (-15) clamped to 0", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "PLAYB1" });

  const res = service.updatePlayback("PLAYB1", "user-1", {
    action: "seek",
    currentTime: -15,
  });

  assert.equal(res.ok, true);
  assert.ok(res.playback.currentTime >= 0);
});

test("Tier 2 - F11.2 Playback Boundary: astronomical currentTime (999999999) handled safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "PLAYB2" });

  const res = service.updatePlayback("PLAYB2", "user-2", {
    action: "seek",
    currentTime: 999999999,
  });

  assert.equal(res.ok, true);
  assert.equal(res.playback.currentTime, 999999999);
});

test("Tier 2 - F11.3 Playback Boundary: zero and negative playbackRate handled safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "PLAYB3" });

  const resZero = service.updatePlayback("PLAYB3", "user-3", {
    action: "play",
    currentTime: 10,
    playbackRate: 0,
  });
  assert.equal(resZero.ok, true);

  const resNeg = service.updatePlayback("PLAYB3", "user-3", {
    action: "play",
    currentTime: 10,
    playbackRate: -1.0,
  });
  assert.equal(resNeg.ok, true);
});

test("Tier 2 - F11.4 Playback Boundary: rapid seek oscillations back and forth", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "PLAYB4" });

  for (let i = 0; i < 50; i++) {
    const targetTime = i % 2 === 0 ? 0 : 500;
    const res = service.updatePlayback("PLAYB4", "user-4", { action: "seek", currentTime: targetTime });
    assert.equal(res.ok, true);
    assert.equal(res.playback.currentTime, targetTime);
  }
});

test("Tier 2 - F11.5 Playback Boundary: unknown action string (custom_buffering)", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Eve", customCode: "PLAYB5" });

  const res = service.updatePlayback("PLAYB5", "user-5", {
    action: "custom_buffering",
    currentTime: 42,
  });

  assert.equal(res.ok, true);
  assert.equal(res.playback.currentTime, 42);
});
