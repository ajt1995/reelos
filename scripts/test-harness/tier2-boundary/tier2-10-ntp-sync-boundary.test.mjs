import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F10.1 NTP Boundary: client timestamp in far past (epoch 0 or negative)", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "NTPB01" });

  const pongZero = service.handleNtpSync("NTPB01", "user-1", 0);
  assert.equal(pongZero.type, "pong");
  assert.ok(pongZero.clientSendTime > 0, "Invalid timestamp <=0 defaults to positive server time");
  assert.ok(pongZero.serverReceiveTime > 0);

  const pongNeg = service.handleNtpSync("NTPB01", "user-1", -5000);
  assert.equal(pongNeg.type, "pong");
  assert.equal(pongNeg.clientSendTime, -5000);
});

test("Tier 2 - F10.2 NTP Boundary: client timestamp in the far future (+1 year)", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "NTPB02" });

  const futureTime = Date.now() + 365 * 24 * 3600 * 1000;
  const pongFuture = service.handleNtpSync("NTPB02", "user-2", futureTime);

  assert.equal(pongFuture.type, "pong");
  assert.equal(pongFuture.clientSendTime, futureTime);
});

test("Tier 2 - F10.3 NTP Boundary: fractional/floating point timestamp (1726590000.1234)", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "NTPB03" });

  const frac = 1726590000.987;
  const pongFrac = service.handleNtpSync("NTPB03", "user-3", frac);
  assert.equal(pongFrac.type, "pong");
  assert.equal(pongFrac.clientSendTime, frac);
});

test("Tier 2 - F10.4 NTP Boundary: rapid 100 NTP pings executed in synchronous loop", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "NTPB04" });

  for (let i = 0; i < 100; i++) {
    const pong = service.handleNtpSync("NTPB04", "user-4", Date.now() + i);
    assert.equal(pong.type, "pong");
    assert.equal(pong.precisionWindowMs, 250);
  }
});

test("Tier 2 - F10.5 NTP Boundary: missing participantId during NTP sync", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Eve", customCode: "NTPB05" });

  const pong = service.handleNtpSync("NTPB05", null, Date.now());
  assert.equal(pong.type, "pong");
});
