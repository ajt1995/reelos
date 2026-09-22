import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeMediaSource, queryMediaSources, handleMediaSourcesRoute, resolveItemJellyfinId, recommendStreamsForClient, detectHardwareTier } from "./media-sources-service.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("media-sources-service", () => {
  it("normalizes a 4K MKV HEVC media source", () => {
    const raw = {
      Id: "source-4k-1",
      Path: "/movies/Dune (2024)/Dune.2024.2160p.UHD.Remux.mkv",
      Container: "mkv",
      Size: 50000000000,
      Bitrate: 65000000,
      MediaStreams: [
        { Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 },
        { Type: "Audio", Codec: "truehd", Channels: 8 },
      ],
    };
    const norm = normalizeMediaSource(raw, "item-123");
    assert.equal(norm.id, "source-4k-1");
    assert.equal(norm.quality, "4k");
    assert.equal(norm.is4k, true);
    assert.equal(norm.container, "mkv");
    assert.equal(norm.videoCodec, "hevc");
    assert.equal(norm.isDirectPlayableInBrowser, false);
    assert.match(norm.directStreamUrl, /stream\.mp4/);
    assert.match(norm.directStreamUrl, /MediaSourceId=source-4k-1/);
  });

  it("extracts and normalizes subtitle streams with VTT endpoints", () => {
    const raw = {
      Id: "source-sub-1",
      Path: "/movies/Dune (2024)/Dune.mkv",
      MediaStreams: [
        { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
        { Type: "Audio", Codec: "aac", Channels: 2 },
        { Type: "Subtitle", Codec: "subrip", Language: "eng", DisplayTitle: "English [SDH]", IsDefault: true, Index: 2 },
        { Type: "Subtitle", Codec: "subrip", Language: "spa", DisplayTitle: "Spanish", IsDefault: false, Index: 3 },
      ],
    };
    const norm = normalizeMediaSource(raw, "item-123");
    assert.equal(norm.subtitles.length, 2);
    assert.equal(norm.subtitles[0].label, "English [SDH]");
    assert.equal(norm.subtitles[0].language, "eng");
    assert.equal(norm.subtitles[0].isDefault, true);
    assert.equal(norm.subtitles[0].vttUrl, "/Videos/item-123/source-sub-1/Subtitles/2/Stream.vtt");
    assert.equal(norm.subtitles[1].label, "Spanish");
    assert.equal(norm.subtitles[1].language, "spa");
  });

  it("normalizes a 1080p MP4 H264 AAC media source as direct browser playable", () => {
    const raw = {
      Id: "source-1080-1",
      Path: "/movies/Dune (2024)/Dune.2024.1080p.mp4",
      Container: "mp4",
      Size: 3000000000,
      Bitrate: 4500000,
      MediaStreams: [
        { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
        { Type: "Audio", Codec: "aac", Channels: 2 },
      ],
    };
    const norm = normalizeMediaSource(raw, "item-123");
    assert.equal(norm.quality, "1080p");
    assert.equal(norm.is4k, false);
    assert.equal(norm.container, "mp4");
    assert.equal(norm.isDirectPlayableInBrowser, true);
  });

  it("correctly routes 1080p to browser and 4K to TV on dual-version item", async () => {
    // Mock fetch for Jellyfin item
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              Id: "item-dual-1",
              MediaSources: [
                {
                  Id: "4k-mkv",
                  Path: "Sonic.3.2160p.mkv",
                  Container: "mkv",
                  Bitrate: 50000000,
                  MediaStreams: [{ Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 }],
                },
                {
                  Id: "1080p-mp4",
                  Path: "Sonic.3.1080p.mp4",
                  Container: "mp4",
                  Bitrate: 5000000,
                  MediaStreams: [
                    { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
                    { Type: "Audio", Codec: "aac", Channels: 2 },
                  ],
                },
              ],
            },
          ],
        }),
      });

      const res = await queryMediaSources("item-dual-1");
      assert.equal(res.ok, true);
      assert.equal(res.hasMultipleVersions, true);
      assert.equal(res.sources.length, 2);
      assert.equal(res.recommendedForBrowser.id, "1080p-mp4");
      assert.equal(res.recommendedForBrowser.quality, "1080p");
      assert.equal(res.recommendedForTv.id, "4k-mkv");
      assert.equal(res.recommendedForTv.quality, "4k");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("resolves Jellyfin ID from bare GUID, jf- prefix, custom callback, and shelf file", () => {
    // 32-hex GUID
    assert.equal(resolveItemJellyfinId("ec05072fe8a34ca2849140f20a17990c"), "ec05072fe8a34ca2849140f20a17990c");
    // jf- prefix
    assert.equal(resolveItemJellyfinId("jf-ec05072fe8a34ca2849140f20a17990c"), "ec05072fe8a34ca2849140f20a17990c");

    // Custom resolver
    const mockResolver = (id) => (id === "tmdb-939243" ? "ec05072fe8a34ca2849140f20a17990c" : null);
    assert.equal(
      resolveItemJellyfinId("tmdb-939243", { resolveJellyfinId: mockResolver }),
      "ec05072fe8a34ca2849140f20a17990c"
    );

    // Fallback to library-shelf.json in temp state dir
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-test-"));
    try {
      const shelfData = {
        titles: [
          {
            id: "tmdb-99999",
            jellyfinId: "abcdef1234567890abcdef1234567890",
            ids: ["tmdb-99999", "jf-abcdef1234567890abcdef1234567890"],
          },
        ],
      };
      fs.writeFileSync(path.join(tmpDir, "library-shelf.json"), JSON.stringify(shelfData));
      assert.equal(
        resolveItemJellyfinId("tmdb-99999", { stateDir: tmpDir }),
        "abcdef1234567890abcdef1234567890"
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("prioritizes 1080p H264 over 1080p HEVC for browser direct stream", async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              Id: "sonic-jf-guid",
              MediaSources: [
                {
                  Id: "src-4k",
                  Path: "Sonic.3.2160p.mkv",
                  Container: "mkv",
                  Bitrate: 60000000,
                  MediaStreams: [{ Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 }],
                },
                {
                  Id: "src-1080p-hevc",
                  Path: "Sonic.3.1080p.x265.mkv",
                  Container: "mkv",
                  Bitrate: 5000000,
                  MediaStreams: [{ Type: "Video", Codec: "hevc", Width: 1920, Height: 1080 }],
                },
                {
                  Id: "src-1080p-h264",
                  Path: "Sonic.3.1080p.h264.mkv",
                  Container: "mkv",
                  Bitrate: 4500000,
                  MediaStreams: [
                    { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
                    { Type: "Audio", Codec: "eac3", Channels: 6 },
                  ],
                },
              ],
            },
          ],
        }),
      });

      const res = await queryMediaSources("tmdb-939243", {
        resolveJellyfinId: () => "sonic-jf-guid",
      });
      assert.equal(res.ok, true);
      assert.equal(res.jellyfinId, "sonic-jf-guid");
      assert.equal(res.recommendedForBrowser.id, "src-1080p-h264");
      assert.equal(res.recommendedForBrowser.deliveryMethod, "direct_stream");
      assert.match(res.recommendedForBrowser.url, /Videos\/sonic-jf-guid\/stream\.mp4/);
      assert.match(res.recommendedForBrowser.url, /MediaSourceId=src-1080p-h264/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("handles HTTP /api/media/:id/sources route", async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              Id: "test-ep-1",
              MediaSources: [
                {
                  Id: "src-ep-1",
                  Path: "Severance.S01E01.1080p.mkv",
                  Container: "mkv",
                  MediaStreams: [
                    { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
                    { Type: "Audio", Codec: "eac3", Channels: 6 },
                  ],
                },
              ],
            },
          ],
        }),
      });

      let writtenStatus = 0;
      let writtenHeaders = {};
      let writtenBody = "";

      const req = { url: "/api/media/test-ep-1/sources", method: "GET" };
      const res = {
        writeHead: (status, headers) => {
          writtenStatus = status;
          writtenHeaders = headers;
        },
        end: (body) => {
          writtenBody = body;
        },
      };

      const handled = await handleMediaSourcesRoute(req, res);
      assert.equal(handled, true);
      assert.equal(writtenStatus, 200);
      const parsed = JSON.parse(writtenBody);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.itemId, "test-ep-1");
      assert.equal(parsed.jellyfinId, "test-ep-1");
      assert.equal(parsed.recommendedForBrowser.id, "src-ep-1");
      assert.equal(parsed.recommendedForBrowser.deliveryMethod, "direct_stream");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("routes 4K source to hardware transcode for browser & mobile on GPU-capable server", async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              Id: "dune-4k-item",
              MediaSources: [
                {
                  Id: "dune-4k-remux",
                  Path: "Dune.Part.Two.2024.2160p.UHD.Remux.mkv",
                  Container: "mkv",
                  Bitrate: 75000000,
                  MediaStreams: [
                    { Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 },
                    { Type: "Audio", Codec: "truehd", Channels: 8 },
                  ],
                },
              ],
            },
          ],
        }),
      });

      // Query on workhorse (GPU enabled, e.g. QSV /dev/dri/renderD128)
      const resWorkhorse = await queryMediaSources("dune-4k-item", {
        hardwareTier: "workhorse",
      });
      assert.equal(resWorkhorse.ok, true);
      assert.equal(resWorkhorse.hardwareTier, "workhorse");

      // TV gets highest visual quality (4K HDR Remux / DirectPlay)
      assert.equal(resWorkhorse.recommendedForTv.id, "dune-4k-remux");
      assert.equal(resWorkhorse.recommendedForTv.deliveryMethod, "direct_play");
      assert.match(resWorkhorse.recommendedForTv.reason, /4K HDR Remux \(DirectPlay\)/);

      // Browser gets hardware transcode instead of failing or getting locked out
      assert.equal(resWorkhorse.recommendedForBrowser.id, "dune-4k-remux");
      assert.equal(resWorkhorse.recommendedForBrowser.deliveryMethod, "hardware_transcode");
      assert.match(resWorkhorse.recommendedForBrowser.url, /VideoCodec=h264/);
      assert.match(resWorkhorse.recommendedForBrowser.reason, /Dynamic 4K Hardware Transcode/);

      // Mobile gets hardware transcode
      assert.equal(resWorkhorse.recommendedForMobile.id, "dune-4k-remux");
      assert.equal(resWorkhorse.recommendedForMobile.deliveryMethod, "hardware_transcode");
      assert.match(resWorkhorse.recommendedForMobile.url, /VideoCodec=h264/);
      assert.match(resWorkhorse.recommendedForMobile.reason, /Dynamic 4K Hardware Transcode/);

      // Query on beast (NVIDIA NVENC)
      const resBeast = await queryMediaSources("dune-4k-item", {
        hardwareTier: "beast",
      });
      assert.equal(resBeast.recommendedForBrowser.deliveryMethod, "hardware_transcode");
      assert.equal(resBeast.recommendedForMobile.deliveryMethod, "hardware_transcode");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("preserves DirectPlay / DirectStream remux on potato boxes to prevent server CPU overload", async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              Id: "dune-4k-item",
              MediaSources: [
                {
                  Id: "dune-4k-remux",
                  Path: "Dune.Part.Two.2024.2160p.UHD.Remux.mkv",
                  Container: "mkv",
                  Bitrate: 75000000,
                  MediaStreams: [
                    { Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 },
                    { Type: "Audio", Codec: "truehd", Channels: 8 },
                  ],
                },
              ],
            },
          ],
        }),
      });

      // Query on potato box (<= 4.5 GB RAM, Pentium N3710 without capable GPU)
      const resPotato = await queryMediaSources("dune-4k-item", {
        hardwareTier: "potato",
      });
      assert.equal(resPotato.ok, true);
      assert.equal(resPotato.hardwareTier, "potato");

      // TV still gets DirectPlay
      assert.equal(resPotato.recommendedForTv.id, "dune-4k-remux");
      assert.equal(resPotato.recommendedForTv.deliveryMethod, "direct_play");

      // Browser must NOT trigger CPU video transcode (preserves DirectStream remux)
      assert.equal(resPotato.recommendedForBrowser.id, "dune-4k-remux");
      assert.equal(resPotato.recommendedForBrowser.deliveryMethod, "direct_stream");
      assert.match(resPotato.recommendedForBrowser.url, /VideoCodec=copy/);
      assert.match(resPotato.recommendedForBrowser.reason, /audio transcode only/);

      // Mobile must NOT trigger CPU video transcode
      assert.equal(resPotato.recommendedForMobile.deliveryMethod, "direct_stream");
      assert.match(resPotato.recommendedForMobile.url, /VideoCodec=copy/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("recommendStreamsForClient handles various client and hardware tier inputs", () => {
    const sources = [
      normalizeMediaSource(
        {
          Id: "s-4k",
          Path: "Movie.2160p.mkv",
          Container: "mkv",
          Bitrate: 60000000,
          MediaStreams: [{ Type: "Video", Codec: "hevc", Width: 3840, Height: 2160 }],
        },
        "item-1"
      ),
      normalizeMediaSource(
        {
          Id: "s-1080p",
          Path: "Movie.1080p.mp4",
          Container: "mp4",
          Bitrate: 4000000,
          MediaStreams: [
            { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
            { Type: "Audio", Codec: "aac" },
          ],
        },
        "item-1"
      ),
    ];

    // TV: always picks 4K
    const tvRec = recommendStreamsForClient(sources, "tv", "workhorse");
    assert.equal(tvRec.id, "s-4k");
    assert.equal(tvRec.deliveryMethod, "direct_play");

    // Browser with dual versions: prefers 1080p MP4 instant start
    const browserDual = recommendStreamsForClient(sources, "browser", "workhorse");
    assert.equal(browserDual.id, "s-1080p");
    assert.equal(browserDual.deliveryMethod, "direct_play");

    // Browser with 4K-only on GPU server: dynamic 4K hardware transcode
    const browser4kOnly = recommendStreamsForClient([sources[0]], "browser", "workhorse");
    assert.equal(browser4kOnly.id, "s-4k");
    assert.equal(browser4kOnly.deliveryMethod, "hardware_transcode");
    assert.match(browser4kOnly.url, /VideoCodec=h264/);

    // Browser with 4K-only on potato server: direct stream remux (no CPU transcode)
    const browserPotato = recommendStreamsForClient([sources[0]], "browser", "potato");
    assert.equal(browserPotato.id, "s-4k");
    assert.equal(browserPotato.deliveryMethod, "direct_stream");
    assert.match(browserPotato.url, /VideoCodec=copy/);

    // Empty sources returns null
    assert.equal(recommendStreamsForClient([]), null);
  });

  it("detectHardwareTier identifies GPU tiers from transcode.json and hardware.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-tier-test-"));
    try {
      // 1. transcode.json with NVENC -> beast
      fs.writeFileSync(
        path.join(tmpDir, "transcode.json"),
        JSON.stringify({ dri: true, mode: "nvenc", gpuType: "nvenc", videoTranscoding: true })
      );
      assert.equal(detectHardwareTier(tmpDir), "beast");

      // 2. transcode.json with QSV -> workhorse
      fs.writeFileSync(
        path.join(tmpDir, "transcode.json"),
        JSON.stringify({ dri: true, mode: "qsv", gpuType: "qsv", videoTranscoding: true })
      );
      assert.equal(detectHardwareTier(tmpDir), "workhorse");

      // 3. transcode.json with Potato mode (direct, no videoTranscoding) -> potato
      fs.writeFileSync(
        path.join(tmpDir, "transcode.json"),
        JSON.stringify({ dri: false, mode: "direct", gpuType: "none", videoTranscoding: false })
      );
      assert.equal(detectHardwareTier(tmpDir), "potato");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
