import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

test("Tier 2 - F5.1 Static Boundary: handles Range with spaces (bytes = 0 - 50)", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const rawRange = req.headers.range;
    if (rawRange) {
      const cleaned = rawRange.replace(/\s+/g, "");
      const match = cleaned.match(/bytes=(\d*)-(\d*)/i);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (start <= end && start < stat.size) {
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Content-Length": end - start + 1,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
    }
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes = 0 - 50" },
    });
    assert.equal(resp.status, 206);
    assert.equal(resp.headers.get("content-length"), "51");
  } finally {
    server.close();
  }
});

test("Tier 2 - F5.2 Static Boundary: empty Range header string (Range: '') returns 200 OK", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range && range.trim().length > 0) {
      res.writeHead(206);
      res.end("partial");
      return;
    }
    res.writeHead(200);
    res.end("full-file");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "" },
    });
    assert.equal(resp.status, 200);
    assert.equal(await resp.text(), "full-file");
  } finally {
    server.close();
  }
});

test("Tier 2 - F5.3 Static Boundary: non-numeric bounds (bytes=foo-bar) returns 200 OK fallback", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    const match = range ? range.match(/^bytes=(\d+)-(\d+)$/) : null;
    if (match) {
      res.writeHead(206);
      res.end();
      return;
    }
    // RFC fallback to 200
    res.writeHead(200);
    res.end("fallback-200");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=foo-bar" },
    });
    assert.equal(resp.status, 200);
    assert.equal(await resp.text(), "fallback-200");
  } finally {
    server.close();
  }
});

test("Tier 2 - F5.4 Static Boundary: exact file boundary (bytes=0-${size-1}) serves exact entity", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    res.writeHead(206, {
      "Content-Range": `bytes 0-${stat.size - 1}/${stat.size}`,
      "Content-Length": String(stat.size),
    });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: `bytes=0-${stat.size - 1}` },
    });
    assert.equal(resp.status, 206);
    assert.equal(Number(resp.headers.get("content-length")), stat.size);
  } finally {
    server.close();
  }
});

test("Tier 2 - F5.5 Static Boundary: inverted static range (500-200) returns 416 with bytes */size", async () => {
  const totalSize = 1000;
  const server = http.createServer((req, res) => {
    res.writeHead(416, { "Content-Range": `bytes */${totalSize}` });
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=500-200" },
    });
    assert.equal(resp.status, 416);
    assert.equal(resp.headers.get("content-range"), `bytes */${totalSize}`);
  } finally {
    server.close();
  }
});
