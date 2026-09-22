import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F9.1 WatchParty Lifecycle Boundary: case-insensitive room code handling", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "abc123" });

  const joinLower = service.joinRoom("abc123", { name: "Bob" });
  assert.equal(joinLower.ok, true);

  const joinUpper = service.joinRoom("ABC123", { name: "Charlie" });
  assert.equal(joinUpper.ok, true);
  assert.equal(joinUpper.room.participants.length, 3);
});

test("Tier 2 - F9.2 WatchParty Lifecycle Boundary: handles extreme length strings in title and hostName", () => {
  const service = new WatchPartyService();
  const giantName = "A".repeat(1000);
  const giantTitle = "Movie-".repeat(500);

  const room = service.createRoom({ hostName: giantName, title: giantTitle, customCode: "GIANT1" });
  assert.ok(room);
  assert.equal(room.code, "GIANT1");
});

test("Tier 2 - F9.3 WatchParty Lifecycle Boundary: handles joining room with empty string name", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Host", customCode: "EMPTYNAME" });

  const joinRes = service.joinRoom("EMPTYNAME", { name: "" });
  assert.equal(joinRes.ok, true);
  // Default name applied
  const p = joinRes.room.participants.find((x) => !x.isHost);
  assert.ok(p.name.length > 0);
});

test("Tier 2 - F9.4 WatchParty Lifecycle Boundary: supports 25+ concurrent participants in a single room", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Host", customCode: "BIGROOM" });

  for (let i = 0; i < 25; i++) {
    const res = service.joinRoom("BIGROOM", { name: `Guest-${i}` });
    assert.equal(res.ok, true);
  }

  const summary = service.getRoomSummary("BIGROOM");
  assert.equal(summary.participants.length, 26); // 1 host + 25 guests
});

test("Tier 2 - F9.5 WatchParty Lifecycle Boundary: double creation of identical room code handles gracefully", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Host1", customCode: "COLLIDE" });
  const room2 = service.createRoom({ hostName: "Host2", customCode: "COLLIDE" });

  // Second creation overwrites or returns valid room state
  assert.ok(room2);
  assert.equal(room2.code, "COLLIDE");
});
