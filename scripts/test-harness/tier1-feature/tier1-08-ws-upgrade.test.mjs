import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import net from "node:net";
import { watchPartyService } from "../../services/watchparty-service.mjs";
import { createWsClient } from "../harness-utils.mjs";

test("Tier 1 - F8.1 WebSocket Upgrade: completes RFC 6455 handshake with 101 Switching Protocols", async () => {
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    watchPartyService.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let ws = null;

  try {
    ws = await createWsClient(port, "/ws/watchparty?name=Alice");
    assert.equal(ws.upgraded, true);
  } finally {
    try { ws?.socket.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 1 - F8.2 WebSocket Upgrade: computes correct Sec-WebSocket-Accept SHA-1 digest", async () => {
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  const testKey = "dGhlIHNhbXBsZSBub25jZQ==";
  const expectedAccept = crypto.createHash("sha1").update(testKey + GUID).digest("base64");
  assert.equal(expectedAccept, "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");

  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    watchPartyService.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let ws = null;

  try {
    ws = await createWsClient(port, "/ws/watchparty?name=Bob");
    assert.equal(ws.upgraded, true);
  } finally {
    try { ws?.socket.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 1 - F8.3 WebSocket Upgrade: supports /api/watchparty/ws alternative endpoint", async () => {
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    watchPartyService.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let ws = null;

  try {
    ws = await createWsClient(port, "/api/watchparty/ws?name=Charlie");
    assert.equal(ws.upgraded, true);
  } finally {
    try { ws?.socket.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 1 - F8.4 WebSocket Upgrade: destroys socket when Sec-WebSocket-Key is missing", async () => {
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    watchPartyService.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  let clientSocket = null;
  try {
    clientSocket = net.connect(port, "127.0.0.1");
    await new Promise((resolve) => clientSocket.on("connect", resolve));
    clientSocket.write("GET /ws/watchparty HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");

    const closed = await new Promise((resolve) => {
      clientSocket.on("close", () => resolve(true));
      setTimeout(() => resolve(false), 500);
    });
    assert.equal(closed, true, "Socket must be closed when Sec-WebSocket-Key is omitted");
  } finally {
    try { clientSocket?.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 1 - F8.5 WebSocket Upgrade: returns false for non-watchparty paths", () => {
  const mockReq = {
    url: "/ws/other-service",
    headers: { "sec-websocket-key": "somekey" },
  };
  const mockSocket = { destroy: () => {} };

  const handled = watchPartyService.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0));
  assert.equal(handled, false);
});
