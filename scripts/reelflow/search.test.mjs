import test from "node:test";
import assert from "node:assert/strict";
import {
  circuitBreaker,
  recordFailure,
  recordSuccess,
  isPrimaryAvailable,
  searchAndScoreReleases,
  scrapePublicIndexers,
  scrapeTorBoxSearch,
  TORBOX_SEARCH_BASE,
} from "./search.mjs";

const TEST_OWNER_ROSTER = [
  { id: "torrents-csv", name: "ReelOS-torrentcsv", role: "both", type: "search", mirrors: ["https://torrents-csv.com"], activeMirror: "https://torrents-csv.com" },
  { id: "yts", name: "ReelOS-yts", role: "movie", type: "search", mirrors: ["https://yts.mx"], activeMirror: "https://yts.mx" },
  { id: "the-pirate-bay", name: "ReelOS-tpb", role: "both", type: "search", mirrors: ["https://thepiratebay.org"], activeMirror: "https://thepiratebay.org" },
  { id: "knaben", name: "ReelOS-knaben", role: "both", type: "search", mirrors: ["https://knaben.net", "https://knaben.org"], activeMirror: "https://knaben.net" },
  { id: "eztv", name: "ReelOS-eztv", role: "tv", type: "rss", mirrors: ["https://eztvx.to/ezrss.xml"], activeMirror: "https://eztvx.to/ezrss.xml" },
  { id: "showrss", name: "ReelOS-showrss", role: "tv", type: "rss", mirrors: ["https://showrss.info/other/all.rss"], activeMirror: "https://showrss.info/other/all.rss" },
];

test("circuit breaker: trips to OPEN on 3 consecutive failures", () => {
  recordSuccess();
  assert.equal(circuitBreaker.state, "CLOSED");
  assert.equal(isPrimaryAvailable(), true);

  recordFailure();
  assert.equal(circuitBreaker.state, "CLOSED");

  recordFailure();
  assert.equal(circuitBreaker.state, "CLOSED");

  recordFailure();
  assert.equal(circuitBreaker.state, "OPEN");
  assert.equal(isPrimaryAvailable(), false);

  recordSuccess();
  assert.equal(circuitBreaker.state, "CLOSED");
  assert.equal(isPrimaryAvailable(), true);
});

test("search: filters poison pills and ranks cached releases at the top", async () => {
  const mockFetch = async (url) => {
    // Mock Torrentio
    if (url.includes("torrentio.strem.fun")) {
      return {
        ok: true,
        json: async () => ({
          streams: [
            {
              title: "Inception.2010.CAM.x264\nSize: 700MB",
              infoHash: "1111111111111111111111111111111111111111",
            },
            {
              title: "Inception.2010.2160p.Remux.HEVC.DV-Framestor\nSize: 55GB",
              infoHash: "2222222222222222222222222222222222222222",
            },
            {
              title: "Inception.2010.1080p.BluRay.x264-SPARKS\nSize: 10GB",
              infoHash: "3333333333333333333333333333333333333333",
            },
          ],
        }),
      };
    }

    // Mock TorBox CheckCached
    if (url.includes("checkcached")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            // The 2160p release is cached!
            "2222222222222222222222222222222222222222": {
              name: "Inception.2010.2160p.Remux.HEVC.DV-Framestor",
              size: 55 * 1024 * 1024 * 1024,
            },
            "3333333333333333333333333333333333333333": false,
          },
        }),
      };
    }

    return { ok: false, status: 404 };
  };

  const results = await searchAndScoreReleases(
    { title: "Inception", imdbId: "tt1375666", year: 2010 },
    { fetchImpl: mockFetch, apiKey: "dummy-key", qualityFloor: "1080p" }
  );

  // CAM release should be completely filtered out
  assert.equal(results.length, 2);
  assert.ok(!results.some((r) => r.infoHash === "1111111111111111111111111111111111111111"));

  // Top result must be the cached 4K Remux
  const top = results[0];
  assert.equal(top.infoHash, "2222222222222222222222222222222222222222");
  assert.equal(top.isCached, true);
  assert.ok(top.score > results[1].score);
});

test("search: falls back to public indexers when primary and TorBox search miss", async () => {
  const mockFetch = async (url) => {
    if (url.includes("torrents-csv.com")) {
      return {
        ok: true,
        json: async () => [
          {
            name: "Dune.Part.Two.2024.1080p.WEBRip.x264-FLUX",
            infohash: "4444444444444444444444444444444444444444",
            size_bytes: 5 * 1024 * 1024 * 1024,
          },
        ],
      };
    }
    if (url.includes("checkcached")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            "4444444444444444444444444444444444444444": {
              name: "Dune.Part.Two.2024.1080p.WEBRip.x264-FLUX",
              size: 5 * 1024 * 1024 * 1024,
            },
          },
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const results = await searchAndScoreReleases(
    { title: "Dune Part Two", year: 2024 },
    {
      fetchImpl: mockFetch,
      apiKey: "dummy-key",
      enabledIndexerIds: ["torrents-csv"],
      indexerRoster: TEST_OWNER_ROSTER,
    }
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].infoHash, "4444444444444444444444444444444444444444");
  assert.equal(results[0].source, "ReelOS-torrentcsv");
  assert.equal(results[0].isCached, true);
});

test("search: bundled public indexers remain off until explicitly enabled", async () => {
  let publicCalls = 0;
  const mockFetch = async (url) => {
    if (/torrents-csv|yts|eztv|showrss|knaben|piratebay|1337x/.test(String(url))) {
      publicCalls += 1;
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const results = await searchAndScoreReleases(
    { title: "Dune Part Two", year: 2024 },
    { fetchImpl: mockFetch, apiKey: "dummy-key", enabledIndexerIds: [] },
  );
  assert.deepEqual(results, []);
  assert.equal(publicCalls, 0);
});

test("scrapePublicIndexers: extracts releases across YTS, TPB, Knaben and triggers mirror repair on fault", async () => {
  const mockFetch = async (url) => {
    if (url.includes("yts.mx")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            movies: [
              {
                title: "Oppenheimer",
                year: 2023,
                torrents: [
                  {
                    hash: "5555555555555555555555555555555555555555",
                    quality: "2160p",
                    type: "bluray",
                    size_bytes: 25000000000,
                  },
                ],
              },
            ],
          },
        }),
      };
    }
    if (url.includes("thepiratebay.org")) {
      return {
        ok: true,
        json: async () => [
          {
            name: "Oppenheimer.2023.1080p.BluRay.x264",
            info_hash: "6666666666666666666666666666666666666666",
            size: "12000000000",
          },
        ],
      };
    }
    if (url.includes("knaben.net")) {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              title: "Oppenheimer.2023.720p.HD",
              hash: "7777777777777777777777777777777777777777",
              size: 4000000000,
            },
          ],
        }),
      };
    }
    // Simulate failure on another indexer to trigger auto-repair
    return { ok: false, status: 503 };
  };

  const releases = await scrapePublicIndexers("Oppenheimer", {
    role: "movie",
    fetchImpl: mockFetch,
    indexerRoster: TEST_OWNER_ROSTER,
  });

  const hashes = releases.map((r) => r.infoHash);
  assert.ok(hashes.includes("5555555555555555555555555555555555555555"));
  assert.ok(hashes.includes("6666666666666666666666666666666666666666"));
  assert.ok(hashes.includes("7777777777777777777777777777777777777777"));
  assert.ok(releases.some((r) => r.source === "ReelOS-yts"));
  assert.ok(releases.some((r) => r.source === "ReelOS-tpb"));
  assert.ok(releases.some((r) => r.source === "ReelOS-knaben"));
});

test("searchAndScoreReleases: cleanly searches movies without SundefinedEundefined", async () => {
  const recordedUrls = [];
  const mockFetch = async (url) => {
    recordedUrls.push(url);
    if (url.includes("yts.mx")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            movies: [
              {
                title: "Dune: Part Two",
                year: 2024,
                torrents: [
                  {
                    hash: "8888888888888888888888888888888888888888",
                    quality: "1080p",
                    type: "bluray",
                    size_bytes: 3000000000,
                  },
                ],
              },
            ],
          },
        }),
      };
    }
    if (url.includes("checkcached")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            "8888888888888888888888888888888888888888": {
              name: "Dune: Part Two 2024 1080p",
              size: 3000000000,
            },
          },
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const results = await searchAndScoreReleases(
    { title: "Dune Part Two", year: 2024 },
    { fetchImpl: mockFetch, apiKey: "dummy-key", enabledIndexerIds: ["yts"], indexerRoster: TEST_OWNER_ROSTER }
  );

  // Verify none of the requested URLs contain 'undefined'
  assert.ok(!recordedUrls.some((u) => u.includes("undefined")), "No URL should contain SundefinedEundefined");
  // Verify YTS (movie indexer) was queried
  assert.ok(recordedUrls.some((u) => u.includes("yts.mx")), "Movie search must query YTS");
  // Verify TV-only indexers (EZTV, ShowRSS) were NOT queried
  assert.ok(!recordedUrls.some((u) => u.includes("ezrss") || u.includes("showrss")), "Movie search must not query TV RSS");

  assert.equal(results.length, 1);
  assert.equal(results[0].infoHash, "8888888888888888888888888888888888888888");
});

test("scrapePublicIndexers: RSS feeds filter out unrelated titles by keywords", async () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>EZTV RSS</title>
    <item>
      <title>Survivor.S46E03.720p.HDTV.x264</title>
      <link>magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&amp;dn=Survivor+S46E03</link>
    </item>
    <item>
      <title>Severance.S01E02.1080p.WEB-DL.x264</title>
      <link>magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb&amp;dn=Severance+S01E02</link>
    </item>
  </channel>
</rss>`;

  const mockFetch = async (url) => {
    if (url.includes("ezrss.xml")) {
      return {
        ok: true,
        text: async () => rssXml,
      };
    }
    return { ok: false, status: 404 };
  };

  const results = await scrapePublicIndexers("Severance S01E02", {
    role: "tv",
    fetchImpl: mockFetch,
    indexerRoster: TEST_OWNER_ROSTER,
  });

  // Must only match Severance, not Survivor
  assert.ok(results.some((r) => r.infoHash === "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
  assert.ok(!results.some((r) => r.infoHash === "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
});

test("scrapeTorBoxSearch hits search-api, not the removed main-API path", async () => {
  let called;
  const fetchImpl = async (url, opts) => {
    called = { url: String(url), auth: opts?.headers?.Authorization };
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          torrents: [
            { name: "Example 1080p", hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", size: 123 },
          ],
        },
      }),
    };
  };
  const hits = await scrapeTorBoxSearch("The Expanse", "test-key-12345", fetchImpl);
  assert.match(called.url, /^https:\/\/search-api\.torbox\.app\/torrents\/search\//);
  assert.doesNotMatch(called.url, /api\.torbox\.app\/v1\/api\/torrents\/search/);
  assert.equal(called.url.startsWith(`${TORBOX_SEARCH_BASE}/`), true);
  assert.equal(called.auth, "Bearer test-key-12345");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].infoHash, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(hits[0].source, "torbox_native");
});

test("scrapeTorBoxSearch returns [] on 404 instead of throwing", async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const hits = await scrapeTorBoxSearch("nope", "test-key-12345", fetchImpl);
  assert.deepEqual(hits, []);
});
