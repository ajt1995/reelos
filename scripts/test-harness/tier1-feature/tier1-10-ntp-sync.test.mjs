import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F10.1 NTP Sync: handleNtpSync returns pong with timing fields and 250ms precision window", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "NTP001" });

  const t0 = Date.now() - 15;
  const sync = service.handleNtpSync("NTP001", "user-1", t0);

  assert.equal(sync.type, "pong");
  assert.equal(sync.clientSendTime, t0);
  assert.ok(sync.serverReceiveTime >= t0);
  assert.ok(sync.serverSendTime >= sync.serverReceiveTime);
  assert.equal(sync.precisionWindowMs, 250);
});

test("Tier 1 - F10.2 NTP Sync: computed clock offset is strictly within +-250ms target window", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "NTP002" });

  const t0 = Date.now() - 25;
  const sync = service.handleNtpSync("NTP002", "user-2", t0);
  const t3 = Date.now();

  const roundTrip = t3 - t0;
  const offset = ((sync.serverReceiveTime - t0) + (sync.serverSendTime - t3)) / 2;

  assert.ok(Math.abs(offset) <= 250, `Offset ${offset}ms must be within +-250ms window`);
  assert.ok(roundTrip < 250, `Round trip ${roundTrip}ms must be under 250ms`);
});

test("Tier 1 - F10.3 NTP Sync: handles missing (null/undefined) clientSendTime safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "NTP003" });

  const syncNull = service.handleNtpSync("NTP003", "user-3", null);
  assert.equal(syncNull.type, "pong");
  assert.ok(typeof syncNull.clientSendTime === "number" && !isNaN(syncNull.clientSendTime));

  const syncUndef = service.handleNtpSync("NTP003", "user-3", undefined);
  assert.equal(syncUndef.type, "pong");
  assert.ok(typeof syncUndef.clientSendTime === "number" && !isNaN(syncUndef.clientSendTime));
});

test("Tier 1 - F10.4 NTP Sync: handles string and NaN clientSendTime safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "NTP004" });

  const syncStr = service.handleNtpSync("NTP004", "user-4", "invalid-time");
  assert.equal(syncStr.type, "pong");
  assert.ok(typeof syncStr.clientSendTime === "number" && !isNaN(syncStr.clientSendTime));

  const syncNaN = service.handleNtpSync("NTP004", "user-4", NaN);
  assert.equal(syncNaN.type, "pong");
  assert.ok(typeof syncNaN.clientSendTime === "number" && !isNaN(syncNaN.clientSendTime));
});

test("Tier 1 - F10.5 NTP Sync: handles non-existent room code safely without crashing", () => {
  const service = new WatchPartyService();
  const sync = service.handleNtpSync("NOTFOUND", "user-x", Date.now());
  assert.equal(sync.type, "pong");
  assert.equal(sync.precisionWindowMs, 250);
});
