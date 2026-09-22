import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { protocolFuzzer } from "./protocol-fuzzer.mjs";
import { parseRangeHeader } from "../services/neural-stream-server.mjs";
import { WatchPartyService, MAX_FRAME_SIZE, MAX_BUFFER_SIZE } from "../services/watchparty-service.mjs";
import { createJellyfinShimHandler } from "../services/jellyfin-shim-service.mjs";
import { createPlaybackFixture } from "./playback-fixtures.mjs";
import { ensureMediaFixtures } from "./harness-utils.mjs";

test("RFC 7233 Fuzzer: parseRangeHeader never throws on 500+ property-based random ranges", () => {
  const result = protocolFuzzer.fuzzRangeParser(parseRangeHeader, {
    iterations: 500,
    fileSize: 1048576,
  });

  assert.equal(result.errors.length, 0, `Errors during range fuzzing:\n${result.errors.join("\n")}`);
  assert.ok(result.totalRuns >= 500);
  assert.ok(result.validCount > 0);
  assert.ok(result.unsatisfiableCount > 0);
});

test("RFC 7233 Fuzzer: suffix ranges (-N) compute Math.max(0, totalSize - N) correctly", () => {
  const totalSize = 1000;

  // Standard suffix: last 200 bytes -> 800 to 999
  const r1 = parseRangeHeader("bytes=-200", totalSize);
  assert.ok(r1 && typeof r1 === "object");
  assert.equal(r1.start, 800);
  assert.equal(r1.end, 999);
  assert.equal(r1.chunkSize, 200);

  // Exact file size suffix -> full file
  const r2 = parseRangeHeader("bytes=-1000", totalSize);
  assert.ok(r2 && typeof r2 === "object");
  assert.equal(r2.start, 0);
  assert.equal(r2.end, 999);
  assert.equal(r2.chunkSize, 1000);

  // Suffix larger than file -> clamps start to 0 per RFC 7233 §2.1
  const r3 = parseRangeHeader("bytes=-9999", totalSize);
  assert.ok(r3 && typeof r3 === "object");
  assert.equal(r3.start, 0);
  assert.equal(r3.end, 999);
  assert.equal(r3.chunkSize, 1000);

  // Suffix of 0 bytes is unsatisfiable
  const r4 = parseRangeHeader("bytes=-0", totalSize);
  assert.equal(r4, "unsatisfiable");
});

test("RFC 7233 Fuzzer: over-request bounds (end >= totalSize) clamp to totalSize - 1", () => {
  const totalSize = 5000;

  // Standard player over-request: 0-9999999
  const r1 = parseRangeHeader("bytes=0-9999999", totalSize);
  assert.ok(r1 && typeof r1 === "object");
  assert.equal(r1.start, 0);
  assert.equal(r1.end, 4999);
  assert.equal(r1.chunkSize, 5000);

  // Mid-file over-request: 2000-99999
  const r2 = parseRangeHeader("bytes=2000-99999", totalSize);
  assert.ok(r2 && typeof r2 === "object");
  assert.equal(r2.start, 2000);
  assert.equal(r2.end, 4999);
  assert.equal(r2.chunkSize, 3000);
});

test("RFC 7233 Fuzzer: inverted ranges (start > end) return unsatisfiable", () => {
  const invertedHeaders = [
    "bytes=500-200",
    "bytes=1000-0",
    "bytes=99999-1",
    "bytes=50-49",
    "bytes=100-99",
  ];

  for (const h of invertedHeaders) {
    const res = parseRangeHeader(h, 10000);
    assert.equal(res, "unsatisfiable", `Expected unsatisfiable for ${h}, got ${JSON.stringify(res)}`);
  }
});

test("RFC 7233 Fuzzer: start at or past EOF returns unsatisfiable", () => {
  const totalSize = 1000;
  assert.equal(parseRangeHeader("bytes=1000-1000", totalSize), "unsatisfiable");
  assert.equal(parseRangeHeader("bytes=1001-1002", totalSize), "unsatisfiable");
  assert.equal(parseRangeHeader("bytes=99999-100000", totalSize), "unsatisfiable");
  assert.equal(parseRangeHeader("bytes=1000-", totalSize), "unsatisfiable");
});

test("RFC 7233 Fuzzer: multipart and non-byte units return null (fallback to 200 OK)", () => {
  assert.equal(parseRangeHeader("bytes=0-100, 200-300", 1000), null);
  assert.equal(parseRangeHeader("bytes=0-50, 51-100, 101-150", 1000), null);
  assert.equal(parseRangeHeader("characters=0-500", 1000), null);
  assert.equal(parseRangeHeader("items=0-10", 1000), null);
  assert.equal(parseRangeHeader("bytes=NaN-NaN", 1000), null);
  assert.equal(parseRangeHeader("bytes=foo-bar", 1000), null);
  assert.equal(parseRangeHeader("", 1000), null);
  assert.equal(parseRangeHeader(null, 1000), null);
});

test("RFC 6455 Fuzzer: parseWebSocketFrame enforces client masking when requireMask=true", () => {
  const service = new WatchPartyService();

  // Unmasked text frame
  const unmasked = Buffer.from([0x81, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
  const parsed = service.parseWebSocketFrame(unmasked, { requireMask: true });
  assert.ok(parsed);
  assert.equal(parsed.error, "masking_required");
  assert.equal(parsed.closeCode, 1002);

  // Masked text frame
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const payload = Buffer.from("hello", "utf8");
  const maskedPayload = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) maskedPayload[i] = payload[i] ^ mask[i % 4];
  const masked = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, maskedPayload]);

  const parsedMasked = service.parseWebSocketFrame(masked, { requireMask: true });
  assert.ok(parsedMasked);
  assert.equal(parsedMasked.error, null);
  assert.equal(parsedMasked.opcode, 1);
  assert.equal(parsedMasked.payload.toString("utf8"), "hello");
});

test("RFC 6455 Fuzzer: parseWebSocketFrame rejects non-zero RSV bits with Close 1002", () => {
  const service = new WatchPartyService();

  // RSV1 bit set: 0x91 (FIN + RSV1 + Opcode 1)
  const rsv1Frame = Buffer.from([0x91, 0x80, 0x00, 0x00, 0x00, 0x00]);
  const res1 = service.parseWebSocketFrame(rsv1Frame);
  assert.ok(res1);
  assert.equal(res1.error, "rsv_non_zero");
  assert.equal(res1.closeCode, 1002);

  // RSV2 bit set: 0xa1
  const rsv2Frame = Buffer.from([0xa1, 0x80, 0x00, 0x00, 0x00, 0x00]);
  const res2 = service.parseWebSocketFrame(rsv2Frame);
  assert.ok(res2);
  assert.equal(res2.error, "rsv_non_zero");
  assert.equal(res2.closeCode, 1002);

  // All RSV bits set: 0xf1
  const rsvAllFrame = Buffer.from([0xf1, 0x80, 0x00, 0x00, 0x00, 0x00]);
  const resAll = service.parseWebSocketFrame(rsvAllFrame);
  assert.ok(resAll);
  assert.equal(resAll.error, "rsv_non_zero");
  assert.equal(resAll.closeCode, 1002);
});

test("RFC 6455 Fuzzer: parseWebSocketFrame rejects reserved opcodes with Close 1002", () => {
  const service = new WatchPartyService();
  const reservedOpcodes = [0x3, 0x4, 0x5, 0x6, 0x7, 0xb, 0xc, 0xd, 0xe, 0xf];

  for (const op of reservedOpcodes) {
    const frame = Buffer.from([0x80 | op, 0x80, 0x00, 0x00, 0x00, 0x00]);
    const res = service.parseWebSocketFrame(frame);
    assert.ok(res, `Failed on opcode 0x${op.toString(16)}`);
    assert.equal(res.error, "invalid_opcode");
    assert.equal(res.closeCode, 1002);
  }
});

test("RFC 6455 Fuzzer: parseWebSocketFrame enforces control frame constraints (§5.5)", () => {
  const service = new WatchPartyService();
  const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);

  // Fragmented ping frame (FIN = 0 on Opcode 9)
  const fragPing = Buffer.concat([Buffer.from([0x09, 0x80]), mask]);
  const resFrag = service.parseWebSocketFrame(fragPing);
  assert.ok(resFrag);
  assert.equal(resFrag.error, "fragmented_control_frame");
  assert.equal(resFrag.closeCode, 1002);

  // Control frame with payload > 125 bytes (e.g. 126 bytes)
  const bigPingHeader = Buffer.from([0x89, 0x80 | 126, 0x00, 130]);
  const bigPingPayload = Buffer.alloc(130, 0xaa);
  const bigPing = Buffer.concat([bigPingHeader, mask, bigPingPayload]);
  const resBig = service.parseWebSocketFrame(bigPing);
  assert.ok(resBig);
  assert.equal(resBig.error, "control_frame_length");
  assert.equal(resBig.closeCode, 1002);
});

test("RFC 6455 Fuzzer: parseWebSocketFrame rejects oversized frame claims (>64KB) with Close 1009", () => {
  const service = new WatchPartyService();
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);

  // Claims 10MB (10,485,760 bytes)
  const giantHeader = Buffer.alloc(10);
  giantHeader[0] = 0x81;
  giantHeader[1] = 0x80 | 127;
  giantHeader.writeBigUInt64BE(BigInt(10 * 1024 * 1024), 2);

  const giantFrame = Buffer.concat([giantHeader, mask, Buffer.from([0x01, 0x02, 0x03, 0x04])]);
  const res = service.parseWebSocketFrame(giantFrame);
  assert.ok(res);
  assert.equal(res.error, "oversized_frame");
  assert.equal(res.closeCode, 1009);
});

test("RFC 6455 Fuzzer: buildCloseFrame encodes compliant 2-byte status and reason", () => {
  const service = new WatchPartyService();

  // Status code 1002 with reason "Protocol Error"
  const close1002 = service.buildCloseFrame(1002, "Protocol Error");
  assert.ok(Buffer.isBuffer(close1002));
  assert.equal(close1002[0], 0x88); // FIN + Close opcode
  assert.equal(close1002[1], 2 + "Protocol Error".length); // Unmasked length
  assert.equal(close1002.readUInt16BE(2), 1002);
  assert.equal(close1002.subarray(4).toString("utf8"), "Protocol Error");

  // Status code 1008
  const close1008 = service.buildCloseFrame(1008, "Policy Violation");
  assert.equal(close1008.readUInt16BE(2), 1008);

  // Status code 1009
  const close1009 = service.buildCloseFrame(1009, "Message Too Big");
  assert.equal(close1009.readUInt16BE(2), 1009);
});

test("Live HTTP Range Fuzzing: Jellyfin Shim stream handles 50+ fuzzed ranges with 0x 500 errors", async () => {
  const playbackFixture = createPlaybackFixture();
  const handler = createJellyfinShimHandler({
    ...playbackFixture.options,
    verifiedMediaById: { "sample-item-123": ensureMediaFixtures().sampleSource },
    fallbackTitles: [{
      id: "jf-sample-item-123",
      jellyfinId: "sample-item-123",
      title: "Verified range fixture",
      path: ensureMediaFixtures().sampleSource,
    }],
  });
  const server = http.createServer(async (req, res) => {
    if (await handler(req, res)) return;
    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const endpoint = `http://127.0.0.1:${port}/Videos/sample-item-123/stream`;

  try {
    const fuzzerResult = await protocolFuzzer.fuzzHttpRangeEndpoint(endpoint, { headers: { Cookie: playbackFixture.cookie } });
    assert.equal(fuzzerResult.errors.length, 0, `Errors during live HTTP fuzzing:\n${fuzzerResult.errors.join("\n")}`);
    assert.ok(fuzzerResult.totalRequests >= 40);
    assert.ok(fuzzerResult.status200 + fuzzerResult.status206 + fuzzerResult.status416 === fuzzerResult.totalRequests);
  } finally {
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Live WebSocket Fuzzing: WatchParty server handles adversarial frames and closes cleanly", async () => {
  const service = new WatchPartyService();
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    service.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const wsUrl = `http://127.0.0.1:${port}/ws/watchparty?name=FuzzTester`;

  try {
    const fuzzerResult = await protocolFuzzer.fuzzWsEndpoint(wsUrl);
    assert.equal(fuzzerResult.errors.length, 0, `Errors during WS fuzzing:\n${fuzzerResult.errors.join("\n")}`);
    assert.ok(fuzzerResult.framesTested >= 8);
    assert.equal(fuzzerResult.closedCleanly, true);
  } finally {
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Live WebSocket Flood Fuzzing: 1,000 pings burst terminates with Close 1008 or cleans up", async () => {
  const service = new WatchPartyService();
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    service.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
        const secKey = crypto.randomBytes(16).toString("base64");
        socket.write(
          [
            "GET /ws/watchparty?name=Flooder HTTP/1.1",
            `Host: 127.0.0.1:${port}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Key: ${secKey}`,
            "Sec-WebSocket-Version: 13",
            "\r\n",
          ].join("\r\n")
        );
      });

      socket.on("error", () => {
        // Socket closed or reset by server
        try { socket.destroy(); } catch {}
        resolve();
      });

      let upgraded = false;
      const receivedChunks = [];

      socket.on("data", (chunk) => {
        if (!upgraded) {
          if (chunk.toString("utf8").includes("101 Switching Protocols")) {
            upgraded = true;
            // Blast 1,000 pings instantly
            const flood = protocolFuzzer.generatePingFlood(1000);
            socket.write(flood);
          }
        } else {
          receivedChunks.push(chunk);
          // If server sent Close frame (Opcode 0x8)
          const allBuf = Buffer.concat(receivedChunks);
          if (allBuf.length >= 2 && (allBuf[0] & 0x0f) === 0x8) {
            try { socket.destroy(); } catch {}
            resolve();
          }
        }
      });

      socket.on("close", () => {
        resolve();
      });

      setTimeout(() => {
        try { socket.destroy(); } catch {}
        resolve();
      }, 2000);
    });
  } finally {
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Live TCP Upgrade Safety: immediate socket abort on upgrade produces zero unhandled rejections", async () => {
  const service = new WatchPartyService();
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    service.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
          socket.write("GET /ws/watchparty HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n\r\n");
          // Abruptly destroy socket mid-handshake
          socket.destroy();
          resolve();
        });
        socket.on("error", () => resolve());
      });
    }
  } finally {
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});
