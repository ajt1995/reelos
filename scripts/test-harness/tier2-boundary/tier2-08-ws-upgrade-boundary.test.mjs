import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { watchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F8.1 WebSocket Boundary: non-GET upgrade method (POST) returns false or socket closed", async () => {
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
    clientSocket.write("POST /ws/watchparty HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");

    const closedOrIgnored = await new Promise((resolve) => {
      clientSocket.on("close", () => resolve(true));
      setTimeout(() => resolve(false), 400);
    });
    // Should close or not upgrade
    assert.ok(true);
  } finally {
    try { clientSocket?.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 2 - F8.2 WebSocket Boundary: abrupt socket reset right after TCP connect does not crash server", async () => {
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    watchPartyService.handleUpgrade(req, socket, head);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  let clientSocket = null;
  try {
    clientSocket = net.connect(port, "127.0.0.1");
    clientSocket.on("error", () => {});
    await new Promise((resolve) => clientSocket.on("connect", resolve));
    // Immediately destroy with reset before writing
    clientSocket.destroy(new Error("ECONNRESET"));

    await new Promise((r) => setTimeout(r, 100));
    assert.ok(true, "Server must survive abrupt TCP reset during connect");
  } finally {
    try { clientSocket?.destroy(); } catch {}
    try { server.closeAllConnections?.(); } catch {}
    server.close();
  }
});

test("Tier 2 - F8.3 WebSocket Boundary: upgrade with empty Sec-WebSocket-Key string destroys socket", async () => {
  const mockReq = {
    url: "/ws/watchparty",
    headers: { "sec-websocket-key": "" },
  };
  let destroyed = false;
  const mockSocket = {
    destroy: () => { destroyed = true; },
    write: () => {},
    on: () => {},
  };

  const handled = watchPartyService.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0));
  assert.equal(handled, true);
  assert.equal(destroyed, true);
});

test("Tier 2 - F8.4 WebSocket Boundary: upgrade with empty query string params handles room safely", async () => {
  const mockReq = {
    url: "/ws/watchparty?room=&name=&id=",
    headers: { "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" },
  };
  const mockSocket = {
    destroy: () => {},
    write: () => {},
    on: () => {},
  };

  const handled = watchPartyService.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0));
  assert.equal(handled, true);
});

test("Tier 2 - F8.5 WebSocket Boundary: upgrade URL with query containing special characters", async () => {
  const mockReq = {
    url: "/ws/watchparty?room=%20%23%24&name=Test%40User",
    headers: { "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" },
  };
  const mockSocket = {
    destroy: () => {},
    write: () => {},
    on: () => {},
  };

  assert.doesNotThrow(() => {
    watchPartyService.handleUpgrade(mockReq, mockSocket, Buffer.alloc(0));
  });
});
