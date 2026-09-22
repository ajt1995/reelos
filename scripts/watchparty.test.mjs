import { test } from "node:test";
import assert from "node:assert/strict";
import { watchPartyService, WatchPartyService } from "./services/watchparty-service.mjs";

test("WatchParty: generates unique 6-character room code", () => {
  const service = new WatchPartyService();
  const code = service.generateRoomCode();
  assert.equal(typeof code, "string");
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);
});

test("WatchParty: creates room and initial host session", () => {
  const service = new WatchPartyService();
  const summary = service.createRoom({
    hostName: "Austin",
    title: "Interstellar",
    titleId: "tmdb-157336",
    customCode: "COUCH1",
  });

  assert.equal(summary.code, "COUCH1");
  assert.equal(summary.title, "Interstellar");
  assert.equal(summary.participants.length, 1);
  assert.equal(summary.participants[0].name, "Austin");
  assert.equal(summary.participants[0].isHost, true);
  assert.equal(summary.playback.isPlaying, false);
  assert.equal(summary.playback.currentTime, 0);
});

test("WatchParty: joins room and handles multi-participant state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "PARTY9" });

  const joinRes = service.joinRoom("PARTY9", { name: "Bob" });
  assert.equal(joinRes.ok, true);
  assert.equal(joinRes.room.participants.length, 2);

  const bob = joinRes.room.participants.find((p) => p.name === "Bob");
  assert.ok(bob);
  assert.equal(bob.isHost, false);
});

test("WatchParty: NTP clock synchronization computes precision window within +-250ms", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "NTPROK" });

  const t0 = Date.now() - 20; // client sent 20ms ago
  const sync = service.handleNtpSync("NTPROK", "user-1", t0);

  assert.equal(sync.type, "pong");
  assert.equal(sync.clientSendTime, t0);
  assert.ok(sync.serverReceiveTime >= t0);
  assert.ok(sync.serverSendTime >= sync.serverReceiveTime);
  assert.equal(sync.precisionWindowMs, 250);

  // Round trip and offset computation verification
  const t3 = Date.now();
  const roundTrip = t3 - t0;
  const offset = ((sync.serverReceiveTime - t0) + (sync.serverSendTime - t3)) / 2;
  assert.ok(Math.abs(offset) <= 250, `Offset ${offset}ms must be within +-250ms window`);
  assert.ok(roundTrip < 250, `Simulated loopback roundtrip ${roundTrip}ms is well under 250ms`);
});

test("WatchParty: updates playback state across play, pause, seek", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "SEEK01" });

  // Play at 42 seconds
  const r1 = service.updatePlayback("SEEK01", "user-1", {
    action: "play",
    currentTime: 42.5,
    playbackRate: 1.0,
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.playback.isPlaying, true);
  assert.equal(r1.playback.currentTime, 42.5);

  // Pause at 84 seconds
  const r2 = service.updatePlayback("SEEK01", "user-1", {
    action: "pause",
    currentTime: 84.0,
  });
  assert.equal(r2.ok, true);
  assert.equal(r2.playback.isPlaying, false);
  assert.equal(r2.playback.currentTime, 84.0);

  // Seek back to 10 seconds
  const r3 = service.updatePlayback("SEEK01", "user-2", {
    action: "seek",
    currentTime: 10.0,
  });
  assert.equal(r3.ok, true);
  assert.equal(r3.playback.currentTime, 10.0);
});

test("WatchParty: registers and buffers floating reactions", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "EMOJI1" });

  const r1 = service.sendReaction("EMOJI1", "user-1", { emoji: "🔥", senderName: "Alice" });
  assert.equal(r1.ok, true);
  assert.equal(r1.reaction.emoji, "🔥");
  assert.equal(r1.reaction.senderName, "Alice");

  const summary = service.getRoomSummary("EMOJI1");
  assert.equal(summary.recentReactions.length, 1);
  assert.equal(summary.recentReactions[0].emoji, "🔥");
});

test("WatchParty: RFC 6455 frame builder and parser handle unmasked/masked text frames", () => {
  const service = new WatchPartyService();
  const testPayload = JSON.stringify({ type: "ping", test: true });

  // 1. Unmasked server text frame
  const serverFrame = service.buildWebSocketFrame(testPayload);
  assert.ok(serverFrame.length > 2);
  assert.equal(serverFrame[0], 0x81); // FIN + Text opcode

  // 2. Parse frame
  const parsed = service.parseWebSocketFrame(serverFrame);
  assert.ok(parsed);
  assert.equal(parsed.opcode, 0x1);
  assert.equal(parsed.payload.toString("utf8"), testPayload);

  // 3. Masked client frame simulation
  const payloadBuf = Buffer.from(testPayload, "utf8");
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const maskedPayload = Buffer.alloc(payloadBuf.length);
  for (let i = 0; i < payloadBuf.length; i++) {
    maskedPayload[i] = payloadBuf[i] ^ mask[i % 4];
  }

  const clientFrame = Buffer.concat([
    Buffer.from([0x81, 0x80 | payloadBuf.length]), // FIN + Text, Masked bit set
    mask,
    maskedPayload,
  ]);

  const clientParsed = service.parseWebSocketFrame(clientFrame);
  assert.ok(clientParsed);
  assert.equal(clientParsed.opcode, 0x1);
  assert.equal(clientParsed.payload.toString("utf8"), testPayload);
});

test("WatchParty: REST HTTP route handlers respond correctly", async () => {
  const service = new WatchPartyService();

  const makeMockRes = () => {
    let statusCode = 200;
    let headers = {};
    let body = "";
    return {
      setHeader: (k, v) => { headers[k] = v; },
      end: (b) => { body = b; },
      get statusCode() { return statusCode; },
      set statusCode(c) { statusCode = c; },
      get body() { return body ? JSON.parse(body) : null; },
    };
  };

  // 1. Create Room via POST /api/watchparty/room
  const createReq = {
    url: "/api/watchparty/room",
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({ hostName: "CouchHost", customCode: "HTTP01" }));
    },
  };
  const createRes = makeMockRes();
  const handledCreate = await service.handleHttp(createReq, createRes);
  assert.equal(handledCreate, true);
  assert.equal(createRes.statusCode, 200);
  assert.equal(createRes.body.ok, true);
  assert.equal(createRes.body.room.code, "HTTP01");

  // 2. Query Room via GET /api/watchparty/room/HTTP01
  const getReq = { url: "/api/watchparty/room/HTTP01", method: "GET" };
  const getRes = makeMockRes();
  await service.handleHttp(getReq, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.room.code, "HTTP01");

  // 3. NTP & State Sync via POST /api/watchparty/sync
  const syncReq = {
    url: "/api/watchparty/sync",
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(
        JSON.stringify({
          code: "HTTP01",
          participantId: "user-test",
          clientSendTime: Date.now(),
          action: "play",
          currentTime: 120,
        })
      );
    },
  };
  const syncRes = makeMockRes();
  await service.handleHttp(syncReq, syncRes);
  assert.equal(syncRes.statusCode, 200);
  assert.ok(syncRes.body.ntp);
  assert.equal(syncRes.body.room.playback.isPlaying, true);

  // 4. Send Reaction via POST /api/watchparty/reaction
  const rxReq = {
    url: "/api/watchparty/reaction",
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(
        JSON.stringify({
          code: "HTTP01",
          participantId: "user-test",
          emoji: "🚀",
          senderName: "SpaceViewer",
        })
      );
    },
  };
  const rxRes = makeMockRes();
  await service.handleHttp(rxReq, rxRes);
  assert.equal(rxRes.statusCode, 200);
  assert.equal(rxRes.body.ok, true);
  assert.equal(rxRes.body.reaction.emoji, "🚀");
});

test("WatchParty: preserves host status when host connects with their participantId", () => {
  const service = new WatchPartyService();
  const created = service.createRoom({ hostName: "Austin", customCode: "HOST01" });
  assert.equal(created.participants[0].isHost, true);

  // When host joins room via WebSocket or joinRoom with hostId
  const joined = service.joinRoom("HOST01", { name: "Austin", participantId: created.hostId });
  assert.equal(joined.ok, true);
  const host = joined.room.participants.find((p) => p.id === created.hostId);
  assert.ok(host);
  assert.equal(host.isHost, true, "Host must retain isHost=true when joining their room");
});

test("WatchParty: reconnecting participant preserves joinedAt and existing state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "RECON1" });

  const join1 = service.joinRoom("RECON1", { name: "Bob", participantId: "user-bob" });
  assert.equal(join1.ok, true);
  const origJoinedAt = join1.room.participants.find((p) => p.id === "user-bob").joinedAt;

  // Reconnect with same ID
  const join2 = service.joinRoom("RECON1", { name: "Bob Reconnected", participantId: "user-bob" });
  assert.equal(join2.ok, true);
  const reconnected = join2.room.participants.find((p) => p.id === "user-bob");
  assert.equal(reconnected.joinedAt, origJoinedAt, "Reconnecting participant preserves original joinedAt");
  assert.equal(reconnected.name, "Bob Reconnected");
});

test("WatchParty: disconnect preserves identity and reports honest connection state", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "AWAY01" });
  service.joinRoom("AWAY01", { name: "Bob", participantId: "user-bob", socket: { destroyed: false } });
  assert.equal(service.getRoomSummary("AWAY01").participants.find((p) => p.id === "user-bob").connected, true);
  const disconnected = service.disconnectParticipant("AWAY01", "user-bob");
  assert.equal(disconnected.ok, true);
  assert.equal(disconnected.room.participants.find((p) => p.id === "user-bob").connected, false);
  const reconnected = service.joinRoom("AWAY01", { name: "Bob", participantId: "user-bob", socket: { destroyed: false } });
  assert.equal(reconnected.room.participants.filter((p) => p.id === "user-bob").length, 1);
  assert.equal(reconnected.room.participants.find((p) => p.id === "user-bob").connected, true);
});

test("WatchParty: REST join rejects a missing room instead of inventing success", async () => {
  const service = new WatchPartyService();
  const req = {
    url: "/api/watchparty/join",
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({ code: "NOPE01", name: "Viewer" }));
    },
  };
  let body = "";
  const res = { statusCode: 200, setHeader() {}, end(value) { body = value; } };
  assert.equal(await service.handleHttp(req, res), true);
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(body).ok, false);
});

test("WatchParty: handleNtpSync handles missing or non-numeric timestamps safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "SAFE01" });

  const pongNull = service.handleNtpSync("SAFE01", "user-1", null);
  assert.equal(pongNull.type, "pong");
  assert.equal(typeof pongNull.clientSendTime, "number");
  assert.ok(!isNaN(pongNull.clientSendTime));

  const pongUndefined = service.handleNtpSync("SAFE01", "user-1", undefined);
  assert.equal(pongUndefined.type, "pong");
  assert.equal(typeof pongUndefined.clientSendTime, "number");
  assert.ok(!isNaN(pongUndefined.clientSendTime));
});
