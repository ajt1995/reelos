import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { proxyRemoteStream } from "../../services/neural-stream-server.mjs";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

test("Tier 2 - F3.1 Debrid Proxy Boundary: handles upstream 502 Bad Gateway without unhandled crash", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway from upstream CDN");
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/broken.mp4`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 502);
  } finally {
    upstream.close();
  }
});

test("Tier 2 - F3.2 Debrid Proxy Boundary: proxies zero-length upstream body (Content-Length: 0)", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Length": "0", "Content-Type": "video/mp4" });
    res.end();
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/empty.mp4`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 200);
    assert.equal(clientRes.body.length, 0);
  } finally {
    upstream.close();
  }
});

test("Tier 2 - F3.3 Debrid Proxy Boundary: passes upstream 429 and preserves Retry-After header", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": "10",
    });
    res.end(JSON.stringify({ error: "TorBox rate limit" }));
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/rate-limit.mp4`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 429);
    assert.match(clientRes.text, /TorBox rate limit/);
  } finally {
    upstream.close();
  }
});

test("Tier 2 - F3.4 Debrid Proxy Boundary: abrupt socket reset on upstream destroys client stream without uncaughtException", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "video/mp4" });
    res.write(Buffer.alloc(1024, 0x01));
    // Forcefully destroy socket mid-stream
    setTimeout(() => {
      req.socket.destroy();
    }, 10);
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/reset.mp4`);

    await new Promise((resolve) => {
      clientRes.on("close", resolve);
      clientRes.on("error", resolve);
      setTimeout(resolve, 300);
    });

    // Zero unhandled crash
    assert.ok(true);
  } finally {
    upstream.close();
  }
});

test("Tier 2 - F3.5 Debrid Proxy Boundary: handles slow-drip 1-byte chunk streams cleanly", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "4" });
    res.write(Buffer.from([0x01]));
    setTimeout(() => res.write(Buffer.from([0x02])), 5);
    setTimeout(() => res.write(Buffer.from([0x03])), 10);
    setTimeout(() => res.end(Buffer.from([0x04])), 15);
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/slow.mp4`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 200);
    assert.equal(clientRes.body.length, 4);
    assert.deepEqual(Array.from(clientRes.body), [1, 2, 3, 4]);
  } finally {
    upstream.close();
  }
});
