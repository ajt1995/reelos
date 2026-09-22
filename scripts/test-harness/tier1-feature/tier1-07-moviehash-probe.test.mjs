import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { computeMovieHashFromHttpStream } from "../../services/jit-debrid-service.mjs";

test("Tier 1 - F7.1 Moviehash Probe: computes 16-char hex hash from 64KB head & tail ranges", async () => {
  const FILE_SIZE = 256 * 1024; // 256KB
  const dummyFile = Buffer.alloc(FILE_SIZE, 0x12);
  dummyFile.writeUInt32LE(0x12345678, 0);
  dummyFile.writeUInt32LE(0x87654321, FILE_SIZE - 8);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d+)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        const chunk = dummyFile.subarray(start, end + 1);
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${FILE_SIZE}`,
          "Content-Length": chunk.length,
        });
        res.end(chunk);
        return;
      }
    }
    res.writeHead(200, { "Content-Length": FILE_SIZE });
    res.end(dummyFile);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const result = await computeMovieHashFromHttpStream(`http://127.0.0.1:${port}/test.mp4`, FILE_SIZE);
    assert.ok(result);
    assert.equal(typeof result.hash, "string");
    assert.equal(result.hash.length, 16);
    assert.equal(result.size, FILE_SIZE);
  } finally {
    server.close();
  }
});

test("Tier 1 - F7.2 Moviehash Probe: queries HEAD to discover content-length when knownSize omitted", async () => {
  const FILE_SIZE = 200 * 1024;
  const dummyFile = Buffer.alloc(FILE_SIZE, 0x5a);

  let headQueried = false;
  const server = http.createServer((req, res) => {
    if (req.method === "HEAD") {
      headQueried = true;
      res.writeHead(200, { "Content-Length": String(FILE_SIZE) });
      res.end();
      return;
    }
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d+)/);
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${FILE_SIZE}` });
      res.end(dummyFile.subarray(start, end + 1));
      return;
    }
    res.writeHead(200);
    res.end(dummyFile);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const result = await computeMovieHashFromHttpStream(`http://127.0.0.1:${port}/movie.mkv`);
    assert.equal(headQueried, true);
    assert.ok(result);
    assert.equal(result.size, FILE_SIZE);
  } finally {
    server.close();
  }
});

test("Tier 1 - F7.3 Moviehash Probe: returns null when file size is below minimum 128KB", async () => {
  const SMALL_SIZE = 64 * 1024; // 64KB (less than 128KB required)
  const result = await computeMovieHashFromHttpStream("http://127.0.0.1:9999/small.mp4", SMALL_SIZE);
  assert.equal(result, null);
});

test("Tier 1 - F7.4 Moviehash Probe: returns null when upstream server returns 500 error", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(500);
    res.end("Internal Server Error");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const result = await computeMovieHashFromHttpStream(`http://127.0.0.1:${port}/error.mp4`, 256 * 1024);
    assert.equal(result, null);
  } finally {
    server.close();
  }
});

test("Tier 1 - F7.5 Moviehash Probe: returns null when upstream range response is truncated (<64KB)", async () => {
  const server = http.createServer((req, res) => {
    // Only return 100 bytes instead of required 64KB
    res.writeHead(206, { "Content-Range": "bytes 0-99/262144" });
    res.end(Buffer.alloc(100, 0x01));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const result = await computeMovieHashFromHttpStream(`http://127.0.0.1:${port}/truncated.mp4`, 256 * 1024);
    assert.equal(result, null);
  } finally {
    server.close();
  }
});
