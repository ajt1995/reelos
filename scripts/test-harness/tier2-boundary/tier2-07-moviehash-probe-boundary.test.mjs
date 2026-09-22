import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { computeMovieHashFromHttpStream } from "../../services/jit-debrid-service.mjs";

test("Tier 2 - F7.1 Moviehash Boundary: exact 131,072-byte file (2x 64KB) computes valid hash", async () => {
  const EXACT_SIZE = 131072;
  const dummy = Buffer.alloc(EXACT_SIZE, 0x77);

  const server = http.createServer((req, res) => {
    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d+)/);
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${EXACT_SIZE}`,
        "Content-Length": end - start + 1,
      });
      res.end(dummy.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "Content-Length": EXACT_SIZE });
    res.end(dummy);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const res = await computeMovieHashFromHttpStream(`http://127.0.0.1:${port}/exact.mp4`, EXACT_SIZE);
    assert.ok(res);
    assert.equal(res.size, EXACT_SIZE);
    assert.equal(res.hash.length, 16);
  } finally {
    server.close();
  }
});

test("Tier 2 - F7.2 Moviehash Boundary: 131,071 bytes (1 byte below 128KB) returns null", async () => {
  const BELOW_MIN = 131071;
  const res = await computeMovieHashFromHttpStream("http://127.0.0.1:9999/below.mp4", BELOW_MIN);
  assert.equal(res, null);
});

test("Tier 2 - F7.3 Moviehash Boundary: 0 bytes file size returns null", async () => {
  const res = await computeMovieHashFromHttpStream("http://127.0.0.1:9999/zero.mp4", 0);
  assert.equal(res, null);
});

test("Tier 2 - F7.4 Moviehash Boundary: negative file size returns null", async () => {
  const res = await computeMovieHashFromHttpStream("http://127.0.0.1:9999/neg.mp4", -500);
  assert.equal(res, null);
});

test("Tier 2 - F7.5 Moviehash Boundary: handles connection refused safely without throwing", async () => {
  // Port 1 is reserved and closed
  const res = await computeMovieHashFromHttpStream("http://127.0.0.1:1/nonexistent.mp4", 200000);
  assert.equal(res, null);
});
