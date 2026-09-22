import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F13.1 Cleanup Boundary: non-host leaving preserves original host status", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "HostAlice", customCode: "CLEAN01" });
  const hostId = room.participants[0].id;

  const join1 = service.joinRoom("CLEAN01", { name: "GuestBob" });
  const join2 = service.joinRoom("CLEAN01", { name: "GuestCharlie" });

  // GuestBob leaves
  service.leaveRoom("CLEAN01", join1.participantId);

  const summary = service.getRoomSummary("CLEAN01");
  assert.equal(summary.participants.length, 2);
  const host = summary.participants.find((p) => p.id === hostId);
  assert.ok(host);
  assert.equal(host.isHost, true, "Host status must remain unchanged when non-host leaves");
});

test("Tier 2 - F13.2 Cleanup Boundary: host leaves when 1 guest remains makes that guest host", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "HostAlice", customCode: "CLEAN02" });
  const hostId = room.participants[0].id;

  const join1 = service.joinRoom("CLEAN02", { name: "SoleGuest" });
  const guestId = join1.participantId;

  service.leaveRoom("CLEAN02", hostId);

  const summary = service.getRoomSummary("CLEAN02");
  assert.equal(summary.participants.length, 1);
  assert.equal(summary.participants[0].id, guestId);
  assert.equal(summary.participants[0].isHost, true);
});

test("Tier 2 - F13.3 Cleanup Boundary: multiple participants leave simultaneously", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Host", customCode: "CLEAN03" });
  const pIds = [room.participants[0].id];

  for (let i = 0; i < 5; i++) {
    const res = service.joinRoom("CLEAN03", { name: `User-${i}` });
    pIds.push(res.participantId);
  }

  // Remove all
  for (const id of pIds) {
    service.leaveRoom("CLEAN03", id);
  }

  assert.equal(service.getRoomSummary("CLEAN03"), null, "Room must be destroyed when all leave");
});

test("Tier 2 - F13.4 Cleanup Boundary: rejoining room after it was destroyed returns ok: false", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Host", customCode: "CLEAN04" });
  service.leaveRoom("CLEAN04", room.participants[0].id);

  const joinRes = service.joinRoom("CLEAN04", { name: "LateGuest" });
  assert.equal(joinRes.ok, false);
  assert.match(joinRes.error, /Room not found/);
});

test("Tier 2 - F13.5 Cleanup Boundary: calling leaveRoom repeatedly with same participant is idempotent", () => {
  const service = new WatchPartyService();
  const room = service.createRoom({ hostName: "Host", customCode: "CLEAN05" });
  const join1 = service.joinRoom("CLEAN05", { name: "Guest" });

  assert.doesNotThrow(() => {
    service.leaveRoom("CLEAN05", join1.participantId);
    service.leaveRoom("CLEAN05", join1.participantId);
    service.leaveRoom("CLEAN05", join1.participantId);
  });
});
