import { describe, it, before, after, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createJellyfinShimHandler } from "./jellyfin-shim-service.mjs";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";
import { createMockRequest, createMockResponse } from "../test-harness/harness-utils.mjs";
import { revokeAuthorizedDevice } from "./reelos-gate-service.mjs";

const identity = createPlaybackFixture();
const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { cookie: identity.cookie, ...options.headers } });

test("shim bytes require current device/profile, family, source and exact shelf authority", async () => {
  const who = createPlaybackFixture();
  const file = path.join(who.stateDir, "movie.mp4");
  fs.writeFileSync(file, Buffer.alloc(128, 0x45));
  const item = { id: "jf-title", jellyfinId: "title", path: file, sourceKind: "personal_import", OfficialRating: "G" };
  who.writeLibrary([item]);
  const handler = createJellyfinShimHandler({ ...who.options, verifiedMediaById: { unbound: file } });
  const request = async (id = "title", headers = {}, method = "GET") => {
    const req = createMockRequest({ url: `/Videos/${id}/stream.mp4`, method, headers: { cookie: who.cookie, range: "bytes=0-9", ...headers } });
    const res = createMockResponse();
    await handler(req, res);
    await res.waitForEnd();
    return res;
  };
  assert.equal((await request("title", { cookie: "", "x-emby-token": "reelos-shim-token" })).statusCode, 401);
  const range = await request();
  assert.equal(range.statusCode, 206);
  assert.equal(range.body.length, 10);
  assert.equal(range.getHeader("cache-control"), "private, no-store");
  const head = await request("title", {}, "HEAD");
  assert.equal(head.statusCode, 206);
  assert.equal(head.body.length, 0);
  assert.equal((await request("unbound")).statusCode, 404);
  who.writeLibrary([{ ...item, sourceKind: "debrid" }]);
  who.setProvider(true);
  assert.equal((await request()).statusCode, 206);
  who.setProvider(false);
  assert.equal((await request()).json.code, "source_unavailable");
  who.writeLibrary([]);
  assert.equal((await request()).statusCode, 404);
  who.writeLibrary([item]);
  revokeAuthorizedDevice(who.device.id, who.stateDir);
  assert.equal((await request()).statusCode, 401);
});

test("shim cannot use cached or missing maturity data to let a child open raw bytes", async () => {
  const who = createPlaybackFixture({ profile: { id: "kid", name: "Kid", isKids: true, maturity: "little", pin: "2468" } });
  const file = path.join(who.stateDir, "movie.mp4");
  fs.writeFileSync(file, Buffer.alloc(128));
  const item = { id: "film", path: file, sourceKind: "personal_import", OfficialRating: "R" };
  const handler = createJellyfinShimHandler(who.options);
  for (const rating of ["R", "", "G"]) {
    who.writeLibrary([{ ...item, OfficialRating: rating }]);
    const req = createMockRequest({ url: "/Videos/film/stream?sessionId=other", headers: { cookie: who.cookie, range: "bytes=0-0" } });
    const res = createMockResponse();
    await handler(req, res);
    await res.waitForEnd();
    assert.equal(res.statusCode, rating === "G" ? 206 : 403);
  }
});

describe("jellyfin-shim-service", () => {
  let server;
  let baseUrl;
  let tmpDir;

  const mockTitles = [
    {
      id: "tmdb-693134",
      jellyfinId: "3f59dd5efa163df70a05bc2f5c8b5f26",
      title: "Dune: Part Two",
      year: 2024,
      kind: "movie",
      overview: "Paul Atreides unites with Chani and the Fremen.",
      is4k: true,
      videoCodec: "hevc",
      audioCodec: "truehd",
      sourceKind: "personal_import",
      poster: "https://image.tmdb.org/t/p/w500/dune2.jpg",
    },
    {
      id: "tmdb-tv-48866",
      jellyfinId: "982339b2eb34022af92af3ca1422a574",
      title: "The 100",
      year: 2014,
      kind: "tv",
      overview: "A century after a nuclear apocalypse...",
      is4k: false,
      videoCodec: "h264",
      audioCodec: "aac",
      sourceKind: "personal_import",
    },
  ];

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-shim-test-"));
    const handler = createJellyfinShimHandler({
      ...identity.options,
      stateDir: tmpDir,
      fallbackTitles: mockTitles,
    });

    server = http.createServer(async (req, res) => {
      const handled = await handler(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server?.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("GET /System/Info/Public returns server identity and completed wizard", async () => {
    const res = await fetch(`${baseUrl}/System/Info/Public`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ServerName, "ReelOS");
    assert.equal(data.StartupWizardCompleted, true);
    assert.ok(data.Id);
  });

  it("POST /Users/AuthenticateByName authenticates resident and returns UserDto with policy", async () => {
    const res = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: "Primary", Pw: "" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.User.Name, "Primary");
    assert.equal(data.User.Policy.IsAdministrator, true);
    assert.equal(data.User.Policy.EnableMediaPlayback, true);
    assert.equal(data.AccessToken, "reelos-shim-token");
  });

  it("GET /Users/{id}/Views returns standard Movie and TV library views", async () => {
    const res = await fetch(`${baseUrl}/Users/reelos-resident-001/Views`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.TotalRecordCount, 2);
    assert.equal(data.Items[0].CollectionType, "movies");
    assert.equal(data.Items[1].CollectionType, "tvshows");
  });

  it("GET /Items returns library shelf items mapped to Jellyfin Item structure", async () => {
    const res = await fetch(`${baseUrl}/Items`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.TotalRecordCount, 2);

    const dune = data.Items.find((i) => i.Name === "Dune: Part Two");
    assert.ok(dune);
    assert.equal(dune.Type, "Movie");
    assert.equal(dune.ProductionYear, 2024);
    assert.equal(dune.MediaSources.length, 0);
    assert.equal(dune.CommunityRating, 8.6);

    const the100 = data.Items.find((i) => i.Name === "The 100");
    assert.ok(the100);
    assert.equal(the100.Type, "Series");
  });

  it("GET /Items/{id} returns details for a single media item", async () => {
    const res = await fetch(`${baseUrl}/Items/3f59dd5efa163df70a05bc2f5c8b5f26`);
    assert.equal(res.status, 200);
    const item = await res.json();
    assert.equal(item.Name, "Dune: Part Two");
    assert.equal(item.ProductionYear, 2024);
  });

  it("GET /Shows/{id}/Seasons and /Episodes returns hierarchy", async () => {
    const sRes = await fetch(`${baseUrl}/Shows/982339b2eb34022af92af3ca1422a574/Seasons`);
    assert.equal(sRes.status, 200);
    const sData = await sRes.json();
    assert.equal(sData.Items[0].Name, "Season 1");

    const eRes = await fetch(`${baseUrl}/Shows/982339b2eb34022af92af3ca1422a574/Episodes`);
    assert.equal(eRes.status, 200);
    const eData = await eRes.json();
    assert.equal(eData.TotalRecordCount, 0);
    assert.match(eData.UnavailableReason, /no verified/i);
  });

  it("POST /Items/{id}/PlaybackInfo refuses to invent a playable source", async () => {
    const res = await fetch(`${baseUrl}/Items/3f59dd5efa163df70a05bc2f5c8b5f26/PlaybackInfo`, {
      method: "POST",
    });
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.MediaSources.length, 0);
    assert.equal(data.ErrorCode, "MediaUnavailable");
  });

  it("GET /Videos/{id}/stream fails honestly when no media file exists", async () => {
    const res = await fetch(`${baseUrl}/Videos/3f59dd5efa163df70a05bc2f5c8b5f26/stream.mp4`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(res.status, 404);
    const payload = await res.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.available, false);
    assert.match(payload.error, /no verified/i);
  });

  it("POST /Sessions/Playing/Progress records resume ticks", async () => {
    const res = await fetch(`${baseUrl}/Sessions/Playing/Progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ItemId: "3f59dd5efa163df70a05bc2f5c8b5f26",
        PositionTicks: 50000000000,
      }),
    });
    assert.equal(res.status, 204);

    // Verify progress file was written
    const map = JSON.parse(fs.readFileSync(path.join(tmpDir, "playback-progress.json"), "utf8"));
    assert.equal(map["3f59dd5efa163df70a05bc2f5c8b5f26"].positionTicks, 50000000000);
  });

  it("GET /Items/{id}/Images/Primary redirects to external poster URL", async () => {
    const res = await fetch(`${baseUrl}/Items/3f59dd5efa163df70a05bc2f5c8b5f26/Images/Primary`, {
      redirect: "manual",
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://image.tmdb.org/t/p/w500/dune2.jpg");
  });

  it("GET /Playback/BitrateTest returns binary benchmark payload", async () => {
    const res = await fetch(`${baseUrl}/Playback/BitrateTest`);
    assert.equal(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 1048576);
  });

  it("startJellyfinShimServer launches standalone server on arbitrary port", async () => {
    const { startJellyfinShimServer } = await import("./jellyfin-shim-service.mjs");
    const standalone = await startJellyfinShimServer({ port: 0, stateDir: tmpDir });
    const port = standalone.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/System/Info/Public`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ServerName, "ReelOS");
    } finally {
      standalone.close();
    }
  });
});
