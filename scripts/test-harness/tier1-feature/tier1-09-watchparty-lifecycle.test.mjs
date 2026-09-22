import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F9.1 WatchParty Lifecycle: generates unique 6-character alphanumeric room codes", () => {
  const service = new WatchPartyService();
  const code1 = service.generateRoomCode();
  const code2 = service.generateRoomCode();

  assert.equal(typeof code1, "string");
  assert.equal(code1.length, 6);
  assert.match(code1, /^[A-Z0-9]{6}$/);
  assert.notEqual(code1, code2);
});

test("Tier 1 - F9.2 WatchParty Lifecycle: creates room with host session and initial playback state", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({
    hostName: "Austin",
    title: "Inception",
    titleId: "tmdb-27205",
    customCode: "INCP01",
  });

  assert.equal(room.code, "INCP01");
  assert.equal(room.title, "Inception");
  assert.equal(room.participants.length, 1);
  assert.equal(room.participants[0].name, "Austin");
  assert.equal(room.participants[0].isHost, true);
  assert.equal(room.playback.isPlaying, false);
  assert.equal(room.playback.currentTime, 0);
});

test("Tier 1 - F9.3 WatchParty Lifecycle: joins room and updates multi-participant list", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "HostUser", customCode: "ROOM02" });

  const joinRes = service.joinRoom("ROOM02", { name: "GuestUser" });
  assert.equal(joinRes.ok, true);
  assert.equal(joinRes.room.participants.length, 2);

  const guest = joinRes.room.participants.find((p) => p.name === "GuestUser");
  assert.ok(guest);
  assert.equal(guest.isHost, false);
});

test("Tier 1 - F9.4 WatchParty Lifecycle: getRoomSummary returns complete room state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Viewer1", customCode: "SUMM01", title: "Dune" });

  const summary = service.getRoomSummary("SUMM01");
  assert.ok(summary);
  assert.equal(summary.code, "SUMM01");
  assert.equal(summary.title, "Dune");
  assert.equal(summary.participants.length, 1);
  assert.ok(summary.playback);
  assert.ok(Array.isArray(summary.recentReactions));
});

test("Tier 1 - F9.5 WatchParty Lifecycle: leaveRoom removes participant and destroys empty rooms", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "SoleUser", customCode: "EMPTY1" });
  const participantId = room.participants[0].id;

  assert.ok(service.getRoomSummary("EMPTY1"));
  service.leaveRoom("EMPTY1", participantId);

  // Room should be destroyed when last participant departs
  assert.equal(service.getRoomSummary("EMPTY1"), null);
});
