import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import {
  parseRangeHeader,
  getSampleVideoPath,
  handleStreamRequest as rawStreamRequest,
  proxyRemoteStream,
} from "./neural-stream-server.mjs";
import { dispatchBoxApi } from "../reelos-box.mjs";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";
import { createMockRequest, createMockResponse } from "../test-harness/harness-utils.mjs";
import { revokeAuthorizedDevice } from "./reelos-gate-service.mjs";
import { saveProfile } from "./profile-service.mjs";
import { replaceProfileSession } from "./profile-session-service.mjs";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { NativeMediaRegistry } from "./native-media-registry.mjs";
import { createProviderValidation, writeProviderValidation } from "./source-access-policy.mjs";

const identity = createPlaybackFixture();
const handleStreamRequest = (req, res, options = {}) => rawStreamRequest(req, res, { ...identity.options, ...options });
const fetch = (url, options = {}) => globalThis.fetch(url, { ...options, headers: { cookie: identity.cookie, ...options.headers } });

async function byteRequest(who, url, { authenticated = true, method = "GET", headers = {}, options = {} } = {}) {
  const req = createMockRequest({ url, method, headers: { ...(authenticated ? { cookie: who.cookie } : {}), ...headers } });
  const res = createMockResponse();
  await rawStreamRequest(req, res, { ...who.options, ...options });
  await res.waitForEnd();
  return res;
}

async function providerProxyRequest(remoteUrl, options = {}, { method = "GET", headers = {} } = {}) {
  const req = createMockRequest({ method, headers });
  const res = createMockResponse();
  proxyRemoteStream(req, res, remoteUrl, 5, { remotePolicy: "provider", ...options });
  await res.waitForEnd();
  return res;
}

test("byte authorization rejects anonymous, device-only, mismatched, rotated and revoked profile credentials", async () => {
  const who = createPlaybackFixture();
  for (const route of ["sample", "public/night-of-the-living-dead-1968", "0123456789abcdef0123456789abcdef01234567"]) {
    for (const method of ["GET", "HEAD"]) {
      const res = await byteRequest(who, `/api/stream/${route}`, { authenticated: false, method, headers: { range: "bytes=0-0" } });
      assert.equal(res.statusCode, 401);
      assert.equal(res.getHeader("content-range"), undefined);
    }
  }
  const deviceOnly = who.cookie.split(";")[0];
  assert.equal((await byteRequest(who, "/api/stream/sample", { headers: { cookie: deviceOnly } })).statusCode, 401);
  const other = createPlaybackFixture();
  const mixed = `${other.cookie.split(";")[0]}; ${who.cookie.split(";")[1]}`;
  assert.equal((await byteRequest(who, "/api/stream/sample", { headers: { cookie: mixed } })).statusCode, 401);
  replaceProfileSession({ headers: { cookie: who.cookie } }, who.profilesDir, "adult", who.device.id);
  assert.equal((await byteRequest(who, "/api/stream/sample")).statusCode, 401);
  revokeAuthorizedDevice(other.device.id, other.stateDir);
  assert.equal((await byteRequest(other, "/api/stream/sample")).statusCode, 401);
});

test("mapped personal and public local bytes retain Range and HEAD while removed and ambiguous identities fail closed", async () => {
  const who = createPlaybackFixture();
  const file = path.join(who.stateDir, "personal.mp4");
  fs.writeFileSync(file, Buffer.alloc(512, 0x35));
  const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const item = { id: "local-title", infohash: hash, path: file, sourceKind: "personal_import", OfficialRating: "G" };
  for (const sourceKind of ["personal_import", "public_domain"]) {
    who.writeLibrary([{ ...item, sourceKind }]);
    for (const route of [hash, "item/local-title"]) {
      const result = await byteRequest(who, `/api/stream/${route}`, { headers: { range: "bytes=10-19" } });
      assert.equal(result.statusCode, 206);
      assert.equal(result.body.length, 10);
      assert.equal(result.getHeader("cache-control"), "private, no-store");
      const head = await byteRequest(who, `/api/stream/${route}`, { method: "HEAD", headers: { range: "bytes=10-19" } });
      assert.equal(head.statusCode, 206);
      assert.equal(head.body.length, 0);
    }
  }
  who.writeLibrary([item, { ...item, id: "ambiguous" }]);
  assert.equal((await byteRequest(who, `/api/stream/${hash}`)).statusCode, 404);
  who.writeLibrary([]);
  assert.equal((await byteRequest(who, `/api/stream/${hash}?path=${encodeURIComponent(file)}&itemId=local-title`)).statusCode, 404);
});

test("native registry is the playback authority when present", async () => {
  const who = createPlaybackFixture();
  const file = path.join(who.stateDir, "native-personal.mp4");
  const bytes = Buffer.alloc(256, 0x42);
  fs.writeFileSync(file, bytes);
  const registry = new NativeMediaRegistry({ stateDir: who.stateDir });
  registry.register({
    itemId: "native-title",
    workId: "tmdb-9001",
    editionId: "personal-edition",
    title: "Native title",
    source: {
      id: "personal-source",
      kind: "personal_import",
      verified: true,
      path: file,
      fileReceipt: {
        path: file,
        sizeBytes: bytes.length,
        fingerprint: createHash("sha256").update(bytes).digest("hex"),
      },
    },
  });
  who.writeLibrary([{ id: "native-title", sourceKind: "debrid" }]);
  const result = await byteRequest(who, "/api/stream/item/native-title", { headers: { range: "bytes=4-11" } });
  assert.equal(result.statusCode, 206);
  assert.equal(result.body.length, 8);
});

test("native provider playback uses the registry item and its exact torrent file binding", async () => {
  const who = createPlaybackFixture();
  const hash = "a".repeat(40);
  const registry = new NativeMediaRegistry({ stateDir: who.stateDir });
  const item = registry.register({ itemId: "native-episode", workId: "series-a", editionId: "cut-1",
    mediaType: "episode", season: 1, episode: 2,
    source: { id: "torbox-31-file-5", kind: "provider_stream", provider: "torbox", verified: true,
      binding: { infohash: hash, torrentId: 31, fileId: 5, sizeBytes: 100, accountScope: who.providerScope } } });
  who.writeLibrary([{ id: item.itemId, sourceKind: "personal_import" }]);
  who.setProvider(true);
  const calls = [];
  const result = await byteRequest(who, "/api/stream/item/native-episode", { options: { fetchImpl: async (url) => {
    calls.push(url);
    if (url.includes("mylist")) return { ok: true, json: async () => ({ data: [{ id: 31, hash, download_state: "completed",
      files: [{ id: 5, name: "Show.S01E02.mkv", size: 100 }] }] }) };
    return { ok: true, json: async () => ({ data: null }) };
  } } });
  assert.equal(result.statusCode, 404);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /mylist\?id=31/);
  assert.match(calls[1], /torrent_id=31&file_id=5/);
  assert.ok(calls.every((url) => !url.includes("torrent_id=undefined")));
});

test("provider byte route never queries account B for account A's registered source", async () => {
  const who = createPlaybackFixture();
  const registry = new NativeMediaRegistry({ stateDir: who.stateDir });
  registry.register({ itemId: "account-film", workId: "account-film", editionId: "cut-one",
    source: { id: "account-a", kind: "provider_stream", provider: "torbox", verified: true,
      binding: { infohash: "a".repeat(40), torrentId: 10, fileId: 1, accountScope: who.providerScope } } });
  who.setProvider(true);
  fs.writeFileSync(path.join(who.stateDir, "answers.json"), JSON.stringify({ source: "torbox", apiKey: "fixture-key-B" }));
  writeProviderValidation(who.stateDir, createProviderValidation("torbox", "fixture-key-B", "fixture-account-B"));
  let calls = 0;
  const result = await byteRequest(who, "/api/stream/item/account-film", { options: {
    fetchImpl: async () => { calls++; throw new Error("old source must not reach provider"); },
  } });
  assert.equal(result.statusCode, 404);
  assert.equal(calls, 0);
});

test("provider disable denies mapped disk cache and hash RAM cache on the next Range request", async () => {
  const { neuroCache } = await import("./neuro-cache.mjs");
  const who = createPlaybackFixture();
  const hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const cache = path.join(who.stateDir, "cache");
  fs.mkdirSync(cache);
  const file = path.join(cache, `${hash}.mp4`);
  fs.writeFileSync(file, Buffer.alloc(128, 0x66));
  who.writeLibrary([{ id: "provider-title", infohash: hash, path: file, sourceKind: "debrid",
    source: { provider: "torbox", accountScope: who.providerScope } }]);
  neuroCache.setPrewarmedBuffer(hash, Buffer.alloc(128, 0x77));
  try {
    who.setProvider(true);
    assert.equal((await byteRequest(who, `/api/stream/${hash}`, { headers: { range: "bytes=0-7" } })).json.code, "playback_source_unavailable");
    who.setProvider(false);
    const denied = await byteRequest(who, `/api/stream/${hash}`, { headers: { range: "bytes=0-7" }, options: { providerEnabled: true, apiKey: "forged-legacy-option" } });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json.code, "source_unavailable");
    assert.equal(denied.getHeader("content-range"), undefined);
    who.writeLibrary([{ id: "unknown-cache", infohash: hash, path: file }]);
    assert.equal((await byteRequest(who, `/api/stream/${hash}`)).json.code, "playback_source_unverified");
  } finally { neuroCache.prewarmed.delete(hash); }
});

test("child and device presence gates apply to bytes without telemetry or a trusted client session ID", async () => {
  const child = { id: "child", name: "Child", isKids: true, maturity: "little", pin: "2468" };
  const who = createPlaybackFixture({ profile: child });
  const file = path.join(who.stateDir, "family.mp4");
  fs.writeFileSync(file, Buffer.alloc(16));
  const item = { id: "family-title", path: file, sourceKind: "personal_import", OfficialRating: "R" };
  who.writeLibrary([item]);
  assert.equal((await byteRequest(who, "/api/stream/item/family-title")).json.code, "family_title_denied");
  assert.equal((await byteRequest(who, "/api/stream/sample")).json.code, "family_title_denied");
  assert.equal((await byteRequest(who, "/api/stream/public/night-of-the-living-dead-1968")).json.code, "family_title_denied");
  who.writeLibrary([{ ...item, OfficialRating: "G" }]);
  assert.equal((await byteRequest(who, "/api/stream/item/family-title")).statusCode, 200);
  who.writeLibrary([{ ...item, OfficialRating: undefined }]);
  assert.equal((await byteRequest(who, "/api/stream/item/family-title")).json.code, "family_title_denied");
  const adult = createPlaybackFixture({ items: [item] });
  saveProfile(child, adult.profilesDir);
  adult.options.presenceService.roomPresence.set(`playback:${adult.device.id}:watching`, { kidsPresent: true, childProfileIds: ["child"] });
  for (const suffix of ["", "?playSessionId=forged", "?sessionId=unrelated"]) {
    assert.equal((await byteRequest(adult, `/api/stream/item/family-title${suffix}`)).json.code, "family_title_denied");
  }
});

test("public playback resolves only a server catalog identity and forwards Range without household credentials", async (t) => {
  const who = createPlaybackFixture();
  const contacted = [];
  t.mock.method(https, "request", (url, options, respond) => {
    contacted.push({ url, options });
    const outgoing = new EventEmitter();
    outgoing.destroy = () => {};
    outgoing.end = () => {
      const upstream = Readable.from([Buffer.from("test")]);
      upstream.statusCode = 206;
      upstream.headers = { "content-range": "bytes 0-3/400", "content-length": "4", "content-type": "video/mp4", "cache-control": "public, max-age=3600" };
      respond(upstream);
    };
    return outgoing;
  });
  const result = await byteRequest(who, "/api/stream/public/night-of-the-living-dead-1968?url=http://127.0.0.1/private", { headers: { range: "bytes=0-3" } });
  assert.equal(result.statusCode, 206);
  assert.equal(result.text, "test");
  assert.equal(result.getHeader("cache-control"), "private, no-store");
  assert.equal(contacted[0].url, "https://archive.org/download/night_of_the_living_dead_dvd/Night.mp4");
  assert.equal(contacted[0].options.headers.Range, "bytes=0-3");
  assert.equal(contacted[0].options.headers.cookie, undefined);
  assert.equal(contacted[0].options.headers.Authorization, undefined);
  assert.equal((await byteRequest(who, "/api/stream/public/unknown?url=https://archive.org/movie.mp4")).statusCode, 404);
  assert.equal(contacted.length, 1);
});

test("provider resolution never substitutes another torrent/file or outlives provider revocation", async () => {
  const who = createPlaybackFixture();
  const hash = "cccccccccccccccccccccccccccccccccccccccc";
  const item = { id: "provider-selected", infohash: hash, sourceKind: "debrid", torrentId: 5, providerFileId: 9,
    source: { provider: "torbox", accountScope: who.providerScope } };
  who.writeLibrary([item]);
  who.setProvider(true);
  const calls = [];
  const wrongTorrent = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ data: [{ id: 5, hash: "dddddddddddddddddddddddddddddddddddddddd", files: [{ id: 9 }] }] }) };
  };
  const deniedFile = await byteRequest(who, `/api/stream/${hash}?file_id=10`, { options: { fetchImpl: wrongTorrent } });
  assert.equal(deniedFile.statusCode, 404);
  assert.equal(calls.length, 0);
  const wrong = await byteRequest(who, `/api/stream/${hash}`, { options: { fetchImpl: wrongTorrent } });
  assert.equal(wrong.statusCode, 404);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /mylist/);
  const revokeDuringLookup = async (url) => {
    calls.push(url);
    who.setProvider(false);
    return { ok: true, json: async () => ({ data: [{ id: 5, hash, download_state: "completed", files: [{ id: 9 }] }] }) };
  };
  const revoked = await byteRequest(who, `/api/stream/${hash}`, { options: { fetchImpl: revokeDuringLookup } });
  assert.equal(revoked.statusCode, 403);
  assert.equal(revoked.json.code, "source_unavailable");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => !url.includes("requestdl") && !url.includes("createtorrent")));
});

test("provider byte route requires exact stored torrent, ready state and episode file", async () => {
  const who = createPlaybackFixture();
  const hash = "dddddddddddddddddddddddddddddddddddddddd";
  const item = { id: "episode-one", workId: "series", editionId: "cut-one", mediaType: "episode", season: 1, episode: 1,
    infohash: hash, sourceKind: "debrid", torrentId: 21, providerFileId: 3,
    source: { provider: "torbox", accountScope: who.providerScope } };
  who.writeLibrary([item]);
  who.setProvider(true);
  const checked = [];
  const lookup = (row) => async (url) => {
    checked.push(url);
    return { ok: true, json: async () => ({ data: [row] }) };
  };
  const base = { id: 21, hash, files: [{ id: 3, name: "Show.S01E01.mkv", size: 100 }] };
  for (const row of [
    { ...base, id: 22, download_state: "completed" },
    { ...base, download_state: "downloading" },
    { ...base, download_state: "completed", files: [{ id: 3, name: "Show.S01E02.mkv", size: 100 }] },
    { ...base, download_state: "completed", files: [{ id: 3, name: "Show.S01E01E02.mkv", size: 100 }] },
  ]) {
    const result = await byteRequest(who, "/api/stream/item/episode-one", { options: { fetchImpl: lookup(row) } });
    assert.equal(result.statusCode, 404);
    assert.equal(result.json.code, "playback_source_unavailable");
  }
  assert.equal(checked.length, 4);
  assert.ok(checked.every((url) => url.includes("mylist?id=21")));
});

test("parseRangeHeader: parses standard, open, and suffix byte ranges", () => {
  const total = 10000;

  // Standard range
  const r1 = parseRangeHeader("bytes=0-1023", total);
  assert.deepEqual(r1, { start: 0, end: 1023, chunkSize: 1024 });

  // Open range
  const r2 = parseRangeHeader("bytes=5000-", total);
  assert.deepEqual(r2, { start: 5000, end: 9999, chunkSize: 5000 });

  // Suffix range (last 500 bytes)
  const r3 = parseRangeHeader("bytes=-500", total);
  assert.deepEqual(r3, { start: 9500, end: 9999, chunkSize: 500 });
});

test("parseRangeHeader: identifies unsatisfiable and malformed ranges", () => {
  const total = 1000;

  assert.equal(parseRangeHeader("bytes=2000-", total), "unsatisfiable");
  assert.equal(parseRangeHeader("bytes=500-200", total), "unsatisfiable");
  assert.equal(parseRangeHeader("bytes=1000-1000", total), "unsatisfiable");
  assert.equal(parseRangeHeader("not-a-range", total), null);
  assert.equal(parseRangeHeader("", total), null);
});

test("getSampleVideoPath: resolves only an existing file under the supplied root", () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), ".reelos-sample-path-test-"));
  try {
    assert.equal(getSampleVideoPath(root), null);
    const publicDir = path.join(root, "public");
    fs.mkdirSync(publicDir);
    const file = path.join(publicDir, "reelos_teaser_45s.mp4");
    fs.writeFileSync(file, Buffer.alloc(16, 0x41));
    assert.equal(getSampleVideoPath(root), file);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("handleStreamRequest: serves isolated sample bytes with full 200 and range 206 chunks", async () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), ".reelos-sample-stream-test-"));
  fs.mkdirSync(path.join(root, "public"));
  fs.writeFileSync(path.join(root, "public", "reelos_teaser_45s.mp4"), Buffer.alloc(2048, 0x42));
  const server = http.createServer(async (req, res) => {
    const handled = await handleStreamRequest(req, res, { root });
    if (!handled) {
      res.statusCode = 404;
      res.end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Full content request
    const resFull = await fetch(`${baseUrl}/api/stream/sample`);
    assert.equal(resFull.status, 200);
    assert.equal(resFull.headers.get("accept-ranges"), "bytes");
    assert.equal(resFull.headers.get("x-reelos-directplay"), "true");
    assert.equal(resFull.headers.get("x-reelos-zerotranscode"), "100%");
    assert.equal(resFull.headers.get("content-type"), "video/mp4");
    const totalLength = parseInt(resFull.headers.get("content-length"), 10);
    assert.equal(totalLength, 2048);

    // Consume body
    await resFull.arrayBuffer();

    // 2. Range request (first 1024 bytes)
    const resRange = await fetch(`${baseUrl}/api/stream/sample`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(resRange.status, 206);
    assert.equal(resRange.headers.get("content-range"), `bytes 0-1023/${totalLength}`);
    assert.equal(resRange.headers.get("content-length"), "1024");
    assert.equal(resRange.headers.get("accept-ranges"), "bytes");
    assert.equal(resRange.headers.get("x-reelos-directplay"), "true");

    const chunk = await resRange.arrayBuffer();
    assert.equal(chunk.byteLength, 1024);

    // 3. Unsatisfiable range
    const resUnsat = await fetch(`${baseUrl}/api/stream/sample`, {
      headers: { Range: "bytes=999999999-" },
    });
    assert.equal(resUnsat.status, 416);
    assert.equal(resUnsat.headers.get("content-range"), `bytes */${totalLength}`);

    // 4. Unknown hash request
    const resHash = await fetch(`${baseUrl}/api/stream/0123456789abcdef0123456789abcdef01234567`);
    assert.equal(resHash.status, 404);
    const hashJson = await resHash.json();
    assert.equal(hashJson.directPlayReady, false);

    // 6. HEAD request support
    const resHead = await fetch(`${baseUrl}/api/stream/sample`, { method: "HEAD" });
    assert.equal(resHead.status, 200);
    assert.equal(resHead.headers.get("accept-ranges"), "bytes");
    assert.equal(resHead.headers.get("content-length"), String(totalLength));
    const headText = await resHead.text();
    assert.equal(headText, "", "HEAD request should have no response body");
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("handleStreamRequest: streams locally cached media for hash with range support", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".reelos-stream-test-"));
  const cacheDir = path.join(tempDir, ".reelos-state", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const testHash = "abcdef0123456789abcdef0123456789abcdef01";
  const dummyFilePath = path.join(cacheDir, `${testHash}.mp4`);
  const dummyData = Buffer.alloc(2048, 0x42);
  fs.writeFileSync(dummyFilePath, dummyData);

  const server = http.createServer(async (req, res) => {
    const handled = await handleStreamRequest(req, res, { root: tempDir,
      libraryItems: [{ id: "cached-personal", infohash: testHash, path: dummyFilePath, sourceKind: "personal_import" }],
    });
    if (!handled) {
      res.statusCode = 404;
      res.end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/stream/${testHash}`, {
      headers: { Range: "bytes=100-199" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 100-199/2048");
    assert.equal(res.headers.get("content-length"), "100");
    assert.equal(res.headers.get("x-reelos-directplay"), "true");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 100);
    assert.equal(Buffer.from(buf)[0], 0x42);
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reelos-box: dispatchBoxApi handles an authorized personal Range stream directly", async () => {
  const previousState = process.env.REELOS_STATE;
  process.env.REELOS_STATE = identity.stateDir;
  const file = path.join(identity.stateDir, "box-personal.mp4");
  fs.writeFileSync(file, Buffer.alloc(1024, 0x52));
  identity.writeLibrary([{ id: "box-personal", sourceKind: "personal_import", path: file, OfficialRating: "G" }]);
  const server = http.createServer(async (req, res) => {
    if (await dispatchBoxApi(req, res)) return;
    res.statusCode = 404;
    res.end("unhandled");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/stream/item/box-personal`, {
      headers: { Range: "bytes=0-511" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("x-reelos-directplay"), "true");
    assert.equal(res.headers.get("content-length"), "512");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 512);
    assert.equal(Buffer.from(buf)[0], 0x52);
  } finally {
    server.close();
    identity.writeLibrary([]);
    fs.rmSync(file, { force: true });
    if (previousState === undefined) delete process.env.REELOS_STATE;
    else process.env.REELOS_STATE = previousState;
  }
});

test("proxyRemoteStream: forwards Range requests to remote debrid upstream and pipes chunks zero-copy", async () => {
  // Upstream server simulating remote TorBox streaming CDN
  const upstream = http.createServer((req, res) => {
    assert.equal(req.headers["range"], "bytes=100-199");
    res.statusCode = 206;
    res.setHeader("Content-Range", "bytes 100-199/1000");
    res.setHeader("Content-Length", "100");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.end(Buffer.alloc(100, 0x55));
  });

  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamPort = upstream.address().port;
  const upstreamUrl = `http://127.0.0.1:${upstreamPort}/stream/remote-video.mp4`;

  // Local edge server proxying through proxyRemoteStream
  const edgeServer = http.createServer((req, res) => {
    proxyRemoteStream(req, res, upstreamUrl);
  });

  await new Promise((resolve) => edgeServer.listen(0, "127.0.0.1", resolve));
  const edgePort = edgeServer.address().port;
  const edgeUrl = `http://127.0.0.1:${edgePort}`;

  try {
    const res = await fetch(`${edgeUrl}/play`, {
      headers: { Range: "bytes=100-199" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("x-reelos-directplay"), "true");
    assert.equal(res.headers.get("x-reelos-zerotranscode"), "100%");
    assert.equal(res.headers.get("content-range"), "bytes 100-199/1000");
    assert.equal(res.headers.get("content-length"), "100");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 100);
    assert.equal(Buffer.from(buf)[0], 0x55);
  } finally {
    edgeServer.close();
    upstream.close();
  }
});

test("parseRangeHeader: clamps end when end >= totalSize per RFC 7233", () => {
  const total = 1000;
  // Standard player over-request: bytes=0-1000000 on a 1000 byte file
  const r = parseRangeHeader("bytes=0-1000000", total);
  assert.deepEqual(r, { start: 0, end: 999, chunkSize: 1000 });

  // Mid-stream seek: bytes=500-2000 on a 1000 byte file
  const r2 = parseRangeHeader("bytes=500-2000", total);
  assert.deepEqual(r2, { start: 500, end: 999, chunkSize: 500 });
});

test("proxyRemoteStream: transparently follows 302 redirect from debrid CDN", async () => {
  // Target final CDN server
  const targetCdn = http.createServer((req, res) => {
    res.statusCode = 206;
    res.setHeader("Content-Range", "bytes 0-49/50");
    res.setHeader("Content-Length", "50");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.end(Buffer.alloc(50, 0x77));
  });
  await new Promise((resolve) => targetCdn.listen(0, "127.0.0.1", resolve));
  const targetPort = targetCdn.address().port;
  const targetUrl = `http://127.0.0.1:${targetPort}/cdn-video.mp4`;

  // Upstream redirector (e.g. TorBox API gateway redirecting to CDN node)
  const gateway = http.createServer((req, res) => {
    res.statusCode = 302;
    res.setHeader("Location", targetUrl);
    res.end();
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const gatewayPort = gateway.address().port;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}/requestdl`;

  const edgeServer = http.createServer((req, res) => {
    proxyRemoteStream(req, res, gatewayUrl);
  });
  await new Promise((resolve) => edgeServer.listen(0, "127.0.0.1", resolve));
  const edgePort = edgeServer.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${edgePort}/play`, {
      headers: { Range: "bytes=0-49" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("x-reelos-directplay"), "true");
    assert.equal(res.headers.get("content-range"), "bytes 0-49/50");
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 50);
    assert.equal(Buffer.from(buf)[0], 0x77);
  } finally {
    edgeServer.close();
    gateway.close();
    targetCdn.close();
  }
});

test("provider proxy rejects unsafe initial URLs and DNS answers before transport", async () => {
  let transports = 0;
  const options = {
    providerSecret: "account-api-key",
    providerLookup: async () => [{ address: "8.8.8.8", family: 4 }],
    providerHttpsRequest: () => { transports += 1; throw new Error("transport should not run"); },
  };
  for (const url of [
    "http://cdn.example/video", "https://user:pass@cdn.example/video", "https://127.0.0.1/video",
    "https://0x7f000001/video", "https://10.1.2.3/video", "https://169.254.169.254/latest/meta-data/",
    "https://168.63.129.16/video", "https://[::1]/video", "https://[::ffff:127.0.0.1]/video",
    "https://[fc00::1]/video", "https://metadata.google.internal/video",
    "https://cdn.example/video?token=account-api-key", "https://cdn.example/video?token=%61ccount-api-key",
  ]) {
    const res = await providerProxyRequest(url, options);
    assert.equal(res.statusCode, 502, url);
  }
  for (const addresses of [
    [{ address: "192.168.1.2", family: 4 }],
    [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }],
    [{ address: "fe80::1", family: 6 }],
    [{ address: "2001:db8::1", family: 6 }],
  ]) {
    const res = await providerProxyRequest("https://cdn.example/video", { ...options, providerLookup: async () => addresses });
    assert.equal(res.statusCode, 502);
  }
  assert.equal(transports, 0);
});

test("provider proxy pins public DNS, forwards Range, and allows signed CDN lease query", async () => {
  const contacts = [];
  const res = await providerProxyRequest("https://cdn.example/video?lease=temporary", {
    providerSecret: "account-api-key",
    providerLookup: async (host) => { assert.equal(host, "cdn.example"); return [{ address: "8.8.8.8", family: 4 }]; },
    providerHttpsRequest: (url, requestOptions, respond) => {
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => requestOptions.lookup("cdn.example", {}, (error, address, family) => {
        assert.ifError(error);
        contacts.push({ url, address, family, options: requestOptions });
        const upstream = Readable.from([Buffer.from("abcd")]);
        upstream.statusCode = 206;
        upstream.headers = { "content-range": "bytes 0-3/4", "content-length": "4", "content-type": "video/mp4" };
        respond(upstream);
      });
      return outgoing;
    },
  }, { headers: { range: "bytes=0-3" } });
  assert.equal(res.statusCode, 206);
  assert.equal(res.text, "abcd");
  assert.equal(res.getHeader("content-range"), "bytes 0-3/4");
  assert.equal(res.getHeader("cache-control"), "private, no-store");
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].address, "8.8.8.8");
  assert.equal(contacts[0].family, 4);
  assert.equal(contacts[0].options.headers.Range, "bytes=0-3");
  assert.equal(contacts[0].options.headers.Authorization, undefined);
  assert.equal(contacts[0].options.agent, false);
});

test("provider proxy rechecks authority after DNS before opening the CDN transport", async () => {
  let authorized = true;
  let transports = 0;
  const result = await providerProxyRequest("https://cdn.example/video", {
    providerLookup: async () => {
      authorized = false;
      return [{ address: "8.8.8.8", family: 4 }];
    },
    providerAuthorize: () => authorized,
    providerHttpsRequest: () => { transports++; throw new Error("transport must not open"); },
  });
  assert.equal(result.statusCode, 502);
  assert.equal(transports, 0);
});

test("provider proxy stops a redirected CDN hop after account revocation", async () => {
  let authorized = true;
  let transports = 0;
  const result = await providerProxyRequest("https://cdn.example/start", {
    providerLookup: async () => [{ address: "8.8.8.8", family: 4 }],
    providerAuthorize: () => authorized,
    providerHttpsRequest: (_url, _options, respond) => {
      transports++;
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => {
        authorized = false;
        const upstream = Readable.from([]);
        upstream.statusCode = 302;
        upstream.headers = { location: "https://cdn.example/next" };
        respond(upstream);
      };
      return outgoing;
    },
  });
  assert.equal(result.statusCode, 502);
  assert.equal(transports, 1);
});

test("provider proxy validates every redirect and bounds redirect chains", async () => {
  for (const target of ["http://cdn.example/insecure", "https://127.0.0.1/private", "https://metadata.example/private"]) {
    let contacts = 0;
    const res = await providerProxyRequest("https://cdn.example/start", {
      providerLookup: async (host) => [{ address: host === "metadata.example" ? "169.254.169.254" : "8.8.8.8", family: 4 }],
      providerHttpsRequest: (_url, _options, respond) => {
        contacts += 1;
        const outgoing = new EventEmitter();
        outgoing.destroy = () => {};
        outgoing.end = () => {
          const upstream = Readable.from([]);
          upstream.statusCode = 302;
          upstream.headers = { location: target };
          respond(upstream);
        };
        return outgoing;
      },
    });
    assert.equal(res.statusCode, 502, target);
    assert.equal(contacts, 1, target);
  }
  let lookups = 0;
  let rebindingContacts = 0;
  const rebound = await providerProxyRequest("https://cdn.example/start", {
    providerLookup: async () => [{ address: ++lookups === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 }],
    providerHttpsRequest: (_url, _options, respond) => {
      rebindingContacts += 1;
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => {
        const upstream = Readable.from([]);
        upstream.statusCode = 302;
        upstream.headers = { location: "https://cdn.example/next" };
        respond(upstream);
      };
      return outgoing;
    },
  });
  assert.equal(rebound.statusCode, 502);
  assert.equal(lookups, 2);
  assert.equal(rebindingContacts, 1);
  let hops = 0;
  const loop = await providerProxyRequest("https://cdn.example/start", {
    providerLookup: async () => [{ address: "8.8.8.8", family: 4 }],
    providerHttpsRequest: (_url, _options, respond) => {
      hops += 1;
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => {
        const upstream = Readable.from([]);
        upstream.statusCode = 302;
        upstream.headers = { location: "https://cdn.example/start" };
        respond(upstream);
      };
      return outgoing;
    },
  });
  assert.equal(loop.statusCode, 508);
  assert.equal(hops, 6);
});

test("provider proxy preserves HEAD, upstream status and client cancellation", async () => {
  const providerLookup = async () => [{ address: "8.8.8.8", family: 4 }];
  const head = await providerProxyRequest("https://cdn.example/video", {
    providerLookup,
    providerHttpsRequest: (_url, requestOptions, respond) => {
      assert.equal(requestOptions.method, "HEAD");
      assert.equal(requestOptions.headers.Range, "bytes=0-3");
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => {
        const upstream = Readable.from([]);
        upstream.statusCode = 206;
        upstream.headers = { "content-range": "bytes 0-3/4", "content-length": "4" };
        respond(upstream);
      };
      return outgoing;
    },
  }, { method: "HEAD", headers: { range: "bytes=0-3" } });
  assert.equal(head.statusCode, 206);
  assert.equal(head.text, "");
  assert.equal(head.getHeader("content-range"), "bytes 0-3/4");

  const unavailable = await providerProxyRequest("https://cdn.example/video", {
    providerLookup,
    providerHttpsRequest: (_url, _requestOptions, respond) => {
      const outgoing = new EventEmitter();
      outgoing.destroy = () => {};
      outgoing.end = () => {
        const upstream = Readable.from([Buffer.from("upstream unavailable")]);
        upstream.statusCode = 503;
        upstream.headers = { "content-type": "text/plain" };
        respond(upstream);
      };
      return outgoing;
    },
  });
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.text, "upstream unavailable");

  const req = createMockRequest();
  const res = createMockResponse();
  let destroyed = false;
  let started;
  const didStart = new Promise((resolve) => { started = resolve; });
  proxyRemoteStream(req, res, "https://cdn.example/video", 5, {
    remotePolicy: "provider", providerLookup,
    providerHttpsRequest: () => {
      const outgoing = new EventEmitter();
      outgoing.destroy = () => { destroyed = true; };
      outgoing.end = () => started();
      return outgoing;
    },
  });
  await didStart;
  req.emit("aborted");
  assert.equal(destroyed, true);
});

test("handleStreamRequest: handles TorBox array response and .mp4 extension in URL", async () => {
  const testHash = "4444444444444444444444444444444444444444";
  identity.setProvider(true);
  const mockFetch = async (url) => {
    if (url.includes("mylist")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 9988,
              hash: testHash,
              name: "Movie.2024.1080p.mp4",
              files: [{ id: 1, name: "Movie.2024.1080p.mp4", size: 1000 }],
            },
          ],
        }),
      };
    }
    if (url.includes("requestdl")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: "http://127.0.0.1:9/mock-stream.mp4",
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const req = {
    url: `/api/stream/${testHash}.mp4`,
    headers: { range: "bytes=0-100" },
    method: "GET",
    on: () => {},
  };

  let handledResult = false;
  let statusSet = 0;
  const headersSet = {};
  const res = {
    set statusCode(v) { statusSet = v; },
    get statusCode() { return statusSet; },
    setHeader(k, v) { headersSet[k.toLowerCase()] = v; },
    getHeader(k) { return headersSet[k.toLowerCase()]; },
    hasHeader(k) { return k.toLowerCase() in headersSet; },
    end() {},
  };

  let requestDownloadCall;
  const mockFetchWithServer = async (url, init = {}) => {
    if (url.includes("mylist")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 9988,
              hash: testHash,
              download_state: "completed",
              files: [{ id: 1, name: "Movie.mp4", size: 1000 }],
            },
          ],
        }),
      };
    }
    if (url.includes("requestdl")) {
      requestDownloadCall = { url, init };
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: "https://cdn.example/video.mp4?lease=temporary",
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const edgeServer = http.createServer(async (eReq, eRes) => {
    const handled = await handleStreamRequest(eReq, eRes, {
      fetchImpl: mockFetchWithServer,
      apiKey: "test-api-key",
      providerEnabled: true,
      libraryItems: [{ id: "mapped-provider", infohash: testHash, sourceKind: "debrid", torrentId: 9988, providerFileId: 1,
        source: { provider: "torbox", accountScope: identity.providerScope } }],
      providerRemoteOptions: {
        providerLookup: async () => [{ address: "8.8.8.8", family: 4 }],
        providerHttpsRequest: (url, requestOptions, respond) => {
          const outgoing = new EventEmitter();
          outgoing.destroy = () => {};
          outgoing.end = () => requestOptions.lookup(new URL(url).hostname, {}, (error, address) => {
            if (error) { outgoing.emit("error", error); return; }
            assert.equal(address, "8.8.8.8");
            assert.equal(requestOptions.headers.Range, "bytes=0-100");
            const upstream = Readable.from([Buffer.alloc(101, 0x99)]);
            upstream.statusCode = 206;
            upstream.headers = { "content-range": "bytes 0-100/1000", "content-length": "101", "content-type": "video/mp4" };
            respond(upstream);
          });
          return outgoing;
        },
      },
    });
    if (!handled) {
      eRes.statusCode = 404;
      eRes.end("not handled");
    }
  });
  await new Promise((resolve) => edgeServer.listen(0, "127.0.0.1", resolve));
  const edgePort = edgeServer.address().port;

  try {
    const streamRes = await fetch(`http://127.0.0.1:${edgePort}/api/stream/${testHash}.mp4`, {
      headers: { Range: "bytes=0-100" },
    });
    assert.equal(streamRes.status, 206);
    assert.equal(streamRes.headers.get("x-reelos-directplay"), "true");
    const buf = await streamRes.arrayBuffer();
    assert.equal(buf.byteLength, 101);
    assert.match(requestDownloadCall.url, /redirect=false/);
    assert.match(requestDownloadCall.init.headers.Authorization, /^Bearer \S+$/);
  } finally {
    edgeServer.close();
    identity.setProvider(false);
  }
});

test("handleStreamRequest: refuses legacy hash-only RAM buffers without verified title and file provenance", async () => {
  const { neuroCache } = await import("./neuro-cache.mjs");
  const testHash = "abcdef0123456789abcdef0123456789abcdef01";
  const fake50MbHead = Buffer.alloc(1024 * 1024, 0x42); // 1MB slice representing pre-warmed head

  neuroCache.setPrewarmedBuffer(testHash, fake50MbHead, "video/mp4");

  const edgeServer = http.createServer(async (req, res) => {
    const handled = await handleStreamRequest(req, res, { providerEnabled: true });
    if (!handled) {
      res.statusCode = 404;
      res.end();
    }
  });

  await new Promise((resolve) => edgeServer.listen(0, "127.0.0.1", resolve));
  const edgePort = edgeServer.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${edgePort}/api/stream/${testHash}`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("x-reelos-prewarmed"), null);
    assert.equal((await res.json()).code, "playback_source_unmapped");
  } finally {
    edgeServer.close();
    neuroCache.prewarmed.delete(testHash);
  }
});
