import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F13.1 Participant Migration: migrates host role to next participant when host leaves", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "HostAlice", customCode: "MIGR01" });
  const hostId = room.participants[0].id;

  const joinRes = service.joinRoom("MIGR01", { name: "GuestBob" });
  const guestId = joinRes.participantId;

  // Host Alice leaves
  service.leaveRoom("MIGR01", hostId);

  const summary = service.getRoomSummary("MIGR01");
  assert.ok(summary);
  assert.equal(summary.participants.length, 1);
  assert.equal(summary.participants[0].id, guestId);
  assert.equal(summary.participants[0].isHost, true, "GuestBob must become the new host");
});

test("Tier 1 - F13.2 Participant Migration: reconnecting participant preserves joinedAt timestamp", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "RECON0" });

  const join1 = service.joinRoom("RECON0", { name: "Bob", participantId: "user-bob" });
  const originalJoinedAt = join1.room.participants.find((p) => p.id === "user-bob").joinedAt;

  // Reconnect with same participantId
  const join2 = service.joinRoom("RECON0", { name: "Bob Reconnected", participantId: "user-bob" });
  assert.equal(join2.ok, true);
  const reconnected = join2.room.participants.find((p) => p.id === "user-bob");
  assert.equal(reconnected.joinedAt, originalJoinedAt);
  assert.equal(reconnected.name, "Bob Reconnected");
});

test("Tier 1 - F13.3 Participant Migration: host retains isHost=true when rejoining with hostId", () => {
  const service = new WatchPartyService();
  const created = service.createRoom({ hostName: "AliceHost", customCode: "HOST02" });
  const hostId = created.hostId;

  const rejoined = service.joinRoom("HOST02", { name: "AliceHost", participantId: hostId });
  assert.equal(rejoined.ok, true);
  const host = rejoined.room.participants.find((p) => p.id === hostId);
  assert.ok(host);
  assert.equal(host.isHost, true);
});

test("Tier 1 - F13.4 Participant Migration: completely destroys room when last participant leaves", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "SoloViewer", customCode: "DESTROY" });
  const pId = room.participants[0].id;

  assert.ok(service.getRoomSummary("DESTROY"));
  service.leaveRoom("DESTROY", pId);
  assert.equal(service.getRoomSummary("DESTROY"), null);
});

test("Tier 1 - F13.5 Participant Migration: handles leaveRoom with invalid room or participant safely", () => {
  const service = new WatchPartyService();
  assert.doesNotThrow(() => {
    service.leaveRoom("NONEXISTENT", "invalid-id");
  });
});
