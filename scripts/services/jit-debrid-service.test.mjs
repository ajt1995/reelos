import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { matchEpisodeFile, computeMovieHashFromHttpStream } from "./jit-debrid-service.mjs";

describe("jit-debrid-service", () => {
  const sampleFiles = [
    { id: 1, name: "The.Bear.S02E01.2160p.WEB-DL.mkv", size: 2500000000 },
    { id: 2, name: "The.Bear.S02E02.2160p.WEB-DL.mkv", size: 2600000000 },
    { id: 3, name: "The.Bear.S02E03.2160p.WEB-DL.mkv", size: 2400000000 },
    { id: 4, name: "The.Bear.S02E04-E05.2160p.WEB-DL.mkv", size: 4800000000 },
    { id: 5, name: "Sample/the.bear.s02e01.sample.mkv", size: 50000000 },
    { id: 6, name: "The.Bear.S02.nfo", size: 1000 },
  ];

  it("matches standard S02E01 format", () => {
    const f = matchEpisodeFile(sampleFiles, 2, 1);
    assert.ok(f);
    assert.equal(f.id, 1);
  });

  it("matches standard S02E03 format", () => {
    const f = matchEpisodeFile(sampleFiles, 2, 3);
    assert.ok(f);
    assert.equal(f.id, 3);
  });

  it("matches multi-episode range S02E04-E05 for episode 4 and 5", () => {
    const f4 = matchEpisodeFile(sampleFiles, 2, 4);
    assert.ok(f4);
    assert.equal(f4.id, 4);

    const f5 = matchEpisodeFile(sampleFiles, 2, 5);
    assert.ok(f5);
    assert.equal(f5.id, 4);
  });

  it("rejects samples and non-video files", () => {
    const f = matchEpisodeFile([sampleFiles[4], sampleFiles[5]], 2, 1);
    assert.equal(f, null);
  });

  it("matches 1x02 and Season 1 Episode 2 patterns", () => {
    const altFiles = [
      { id: 10, name: "Severance.1x01.Good.News.1080p.mkv" },
      { id: 11, name: "Severance.Season.1.Episode.2.1080p.mkv" },
    ];
    assert.equal(matchEpisodeFile(altFiles, 1, 1)?.id, 10);
    assert.equal(matchEpisodeFile(altFiles, 1, 2)?.id, 11);
  });

  it("computes OpenSubtitles 64-bit moviehash from in-memory HTTP byte-ranges", async () => {
    // Spin up an in-memory HTTP server serving a test 256KB buffer
    const testSize = 262144; // 256 KB
    const dummyBuffer = Buffer.alloc(testSize);
    for (let i = 0; i < testSize; i++) {
      dummyBuffer[i] = i % 256;
    }

    const server = http.createServer((req, res) => {
      const range = req.headers.range;
      if (range) {
        const m = range.match(/bytes=(\d+)-(\d+)/);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = parseInt(m[2], 10);
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${testSize}`,
            "Content-Length": end - start + 1,
            "Content-Type": "video/mp4",
          });
          res.end(dummyBuffer.subarray(start, end + 1));
          return;
        }
      }
      res.writeHead(200, { "Content-Length": testSize });
      res.end(dummyBuffer);
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const testUrl = `http://127.0.0.1:${port}/test.mp4`;

    try {
      const result = await computeMovieHashFromHttpStream(testUrl, testSize);
      assert.ok(result);
      assert.equal(typeof result.hash, "string");
      assert.equal(result.hash.length, 16);
      assert.equal(result.size, testSize);
    } finally {
      server.close();
    }
  });
});
