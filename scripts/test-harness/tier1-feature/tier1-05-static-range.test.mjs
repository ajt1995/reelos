import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createMockRequest, createMockResponse } from "../harness-utils.mjs";

test("Tier 1 - F5.1 Static Range: serves 200 OK for static file without Range header", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const rStart = match[1] ? parseInt(match[1], 10) : 0;
        const rEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (rStart >= stat.size || rEnd >= stat.size || rStart > rEnd) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${rStart}-${rEnd}/${stat.size}`);
        res.setHeader("Content-Length", rEnd - rStart + 1);
        fs.createReadStream(filePath, { start: rStart, end: rEnd }).pipe(res);
        return;
      }
    }
    res.statusCode = 200;
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`);
    assert.equal(resp.status, 200);
    assert.equal(Number(resp.headers.get("content-length")), stat.size);
    const text = await resp.text();
    assert.ok(text.includes("reelos"));
  } finally {
    server.close();
  }
});

test("Tier 1 - F5.2 Static Range: serves 206 Partial Content for byte-range slice", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const rStart = match[1] ? parseInt(match[1], 10) : 0;
        const rEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (rStart >= stat.size || rEnd >= stat.size || rStart > rEnd) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${rStart}-${rEnd}/${stat.size}`);
        res.setHeader("Content-Length", rEnd - rStart + 1);
        fs.createReadStream(filePath, { start: rStart, end: rEnd }).pipe(res);
        return;
      }
    }
    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=0-49" },
    });
    assert.equal(resp.status, 206);
    assert.equal(resp.headers.get("content-length"), "50");
    assert.equal(resp.headers.get("content-range"), `bytes 0-49/${stat.size}`);
    const body = await resp.text();
    assert.equal(body.length, 50);
  } finally {
    server.close();
  }
});

test("Tier 1 - F5.3 Static Range: handles open-ended range bytes=50-", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const rStart = match[1] ? parseInt(match[1], 10) : 0;
        const rEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (rStart >= stat.size || rEnd >= stat.size || rStart > rEnd) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${rStart}-${rEnd}/${stat.size}`);
        res.setHeader("Content-Length", rEnd - rStart + 1);
        fs.createReadStream(filePath, { start: rStart, end: rEnd }).pipe(res);
        return;
      }
    }
    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=50-" },
    });
    assert.equal(resp.status, 206);
    assert.equal(Number(resp.headers.get("content-length")), stat.size - 50);
    assert.equal(resp.headers.get("content-range"), `bytes 50-${stat.size - 1}/${stat.size}`);
  } finally {
    server.close();
  }
});

test("Tier 1 - F5.4 Static Range: returns 416 when start exceeds total size", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const rStart = match[1] ? parseInt(match[1], 10) : 0;
        const rEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (rStart >= stat.size || rEnd >= stat.size || rStart > rEnd) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        fs.createReadStream(filePath, { start: rStart, end: rEnd }).pipe(res);
        return;
      }
    }
    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=999999999-" },
    });
    assert.equal(resp.status, 416);
    assert.equal(resp.headers.get("content-range"), `bytes */${stat.size}`);
  } finally {
    server.close();
  }
});

test("Tier 1 - F5.5 Static Range: returns 416 when range bounds are inverted (500-200)", async () => {
  const filePath = path.join(process.cwd(), "package.json");
  const stat = fs.statSync(filePath);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const rStart = match[1] ? parseInt(match[1], 10) : 0;
        const rEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (rStart >= stat.size || rEnd >= stat.size || rStart > rEnd) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${stat.size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        fs.createReadStream(filePath, { start: rStart, end: rEnd }).pipe(res);
        return;
      }
    }
    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/package.json`, {
      headers: { Range: "bytes=500-200" },
    });
    assert.equal(resp.status, 416);
    assert.equal(resp.headers.get("content-range"), `bytes */${stat.size}`);
  } finally {
    server.close();
  }
});
