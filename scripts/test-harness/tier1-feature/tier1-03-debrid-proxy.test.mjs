import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { proxyRemoteStream } from "../../services/neural-stream-server.mjs";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

test("Tier 1 - F3.1 Debrid Proxy Stream: proxies 200 OK remote stream with zero-transcode headers", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": "100",
      "Accept-Ranges": "bytes",
    });
    res.end(Buffer.alloc(100, 0x42));
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/video.mp4`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 200);
    assert.equal(clientRes.getHeader("x-reelos-directplay"), "true");
    assert.equal(clientRes.getHeader("x-reelos-zerotranscode"), "100%");
    assert.equal(clientRes.body.length, 100);
  } finally {
    upstream.close();
  }
});

test("Tier 1 - F3.2 Debrid Proxy Stream: forwards Range headers and proxies 206 Partial Content", async () => {
  let receivedRange = null;
  const upstream = http.createServer((req, res) => {
    receivedRange = req.headers.range;
    res.writeHead(206, {
      "Content-Type": "video/mp4",
      "Content-Range": "bytes 0-49/100",
      "Content-Length": "50",
    });
    res.end(Buffer.alloc(50, 0x55));
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({
      url: "/api/stream/mock",
      method: "GET",
      headers: { range: "bytes=0-49" },
    });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/video.mp4`);
    await clientRes.waitForEnd();

    assert.equal(receivedRange, "bytes=0-49");
    assert.equal(clientRes.statusCode, 206);
    assert.equal(clientRes.getHeader("content-range"), "bytes 0-49/100");
    assert.equal(clientRes.body.length, 50);
  } finally {
    upstream.close();
  }
});

test("Tier 1 - F3.3 Debrid Proxy Stream: seamlessly follows single 302 redirect to CDN URL", async () => {
  const upstream = http.createServer((req, res) => {
    if (req.url === "/initial") {
      res.writeHead(302, { Location: "/cdn-destination" });
      res.end();
    } else if (req.url === "/cdn-destination") {
      res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "64" });
      res.end(Buffer.alloc(64, 0xaa));
    }
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/initial`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 200);
    assert.equal(clientRes.body.length, 64);
  } finally {
    upstream.close();
  }
});

test("Tier 1 - F3.4 Debrid Proxy Stream: follows multi-hop 302 redirects (3 hops) successfully", async () => {
  const upstream = http.createServer((req, res) => {
    if (req.url === "/hop1") {
      res.writeHead(302, { Location: "/hop2" });
      res.end();
    } else if (req.url === "/hop2") {
      res.writeHead(302, { Location: "/hop3" });
      res.end();
    } else if (req.url === "/hop3") {
      res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "32" });
      res.end(Buffer.alloc(32, 0xbb));
    }
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/hop1`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 200);
    assert.equal(clientRes.body.length, 32);
  } finally {
    upstream.close();
  }
});

test("Tier 1 - F3.5 Debrid Proxy Stream: detects redirect loop (>5 hops) and returns 508 Loop Detected", async () => {
  const upstream = http.createServer((req, res) => {
    // Infinite loop
    res.writeHead(302, { Location: "/loop" });
    res.end();
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const port = upstream.address().port;

  try {
    const clientReq = createMockRequest({ url: "/api/stream/mock", method: "GET" });
    const clientRes = createMockResponse();

    proxyRemoteStream(clientReq, clientRes, `http://127.0.0.1:${port}/loop`);
    await clientRes.waitForEnd();

    assert.equal(clientRes.statusCode, 508);
    assert.match(clientRes.text, /Too many redirects/);
  } finally {
    upstream.close();
  }
});
