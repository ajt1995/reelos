import test from "node:test";
import assert from "node:assert/strict";
import { TorBoxProviderAdapter, torBoxFileSelector } from "./torbox-provider-adapter.mjs";

const limiter = { executeRequest: async (_key, call) => ({ data: await call() }) };
const response = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
const accountScope = "f".repeat(64);

test("TorBox adapter validates, acquires, and verifies one exact file", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/user/me")) return response(200, { data: { id: 1 } });
    if (url.endsWith("/torrents/createtorrent")) return response(200, { data: { torrent_id: 7 } });
    if (url.includes("/torrents/mylist")) return response(200, { data: [{ id: 7, hash: "a".repeat(40), download_state: "completed", files: [{ id: 3, name: "film.mkv", size: 1000 }] }] });
    throw new Error(`unexpected ${url}`);
  };
  const adapter = new TorBoxProviderAdapter({ apiKey: "secret", fetchImpl, rateLimiter: limiter });
  assert.equal((await adapter.validate()).ok, true);
  const acquired = await adapter.acquire({ id: "candidate", hash: "a".repeat(40), magnet: `magnet:?xt=urn:btih:${"a".repeat(40)}` });
  const verified = await adapter.verify(acquired);
  assert.equal(verified.source.binding.fileId, 3);
  assert.equal(verified.source.verified, true);
  assert.equal(calls.some((call) => JSON.stringify(call).includes("secret")), true);
  assert.equal(JSON.stringify(verified).includes("secret"), false);
});

test("TorBox adapter refuses unauthorized and ambiguous files", async () => {
  const unauthorized = new TorBoxProviderAdapter({ apiKey: "bad", rateLimiter: limiter, fetchImpl: async () => response(401, {}) });
  await assert.rejects(() => unauthorized.validate(), (error) => error.code === "provider_unauthorized");
  assert.equal(torBoxFileSelector([{ id: 1, name: "a.mkv", size: 100 }, { id: 2, name: "b.mkv", size: 100 }]), null);
  assert.equal(torBoxFileSelector([{ id: 1, name: "S01E01.mkv", size: 100 }, { id: 2, name: "S01E02.mkv", size: 200 }]), null);
  assert.equal(torBoxFileSelector([{ id: 1, name: "a.mkv", size: 100 }], 2), null);
});

test("TorBox refuses another provider operation after account authority changes", async () => {
  let allowed = true;
  let calls = 0;
  const adapter = new TorBoxProviderAdapter({ apiKey: "synthetic-key", accountScope,
    rateLimiter: limiter, authorize: () => {
      if (!allowed) throw Object.assign(new Error("Changed account"), { code: "provider_connection_changed" });
    },
    fetchImpl: async () => { calls++; return response(200, { data: { id: 1 } }); },
  });
  await adapter.validate();
  allowed = false;
  await assert.rejects(() => adapter.validate(), (error) => error.code === "provider_connection_changed");
  assert.equal(calls, 1);
});

test("TorBox adapter binds the returned torrent id, hash, file and episode", async () => {
  const hash = "d".repeat(40);
  const adapter = new TorBoxProviderAdapter({ apiKey: "secret", accountScope, rateLimiter: limiter, fetchImpl: async (url) => {
    if (url.includes("createtorrent")) return response(200, { data: { torrent_id: 11 } });
    if (url.includes("mylist")) return response(200, { data: [{ id: 11, hash, download_state: "completed", files: [
      { id: 1, name: "Series.S01E01.mkv", size: 100 }, { id: 2, name: "Series.S01E02.mkv", size: 200 },
    ] }] });
    throw new Error(url);
  } });
  const candidate = { hash, magnet: `magnet:?xt=urn:btih:${hash}`, fileId: 1 };
  const acquired = await adapter.acquire(candidate, { requestedMedia: { mediaType: "episode", season: 1, episode: 1 } });
  const verified = await adapter.verify(acquired);
  assert.deepEqual(verified.source.binding, { infohash: hash, torrentId: 11, fileId: 1, sizeBytes: 100, accountScope });
  await assert.rejects(() => adapter.verify({ ...acquired, requestedFileId: 2 }), (error) => error.code === "provider_episode_mismatch");
  const selected = await adapter.verify({ ...acquired, requestedFileId: null });
  assert.equal(selected.source.binding.fileId, 1);
});

test("TorBox episode packs fail closed for duplicate or combined episode files", async () => {
  const hash = "f".repeat(40);
  let files = [];
  const adapter = new TorBoxProviderAdapter({ apiKey: "secret", rateLimiter: limiter, fetchImpl: async () => response(200, {
    data: [{ id: 19, hash, download_state: "completed", files }],
  }) });
  const requested = { torrentId: 19, hash, requestedMedia: { mediaType: "episode", season: 1, episode: 2 } };
  files = [{ id: 1, name: "Show.S01E01.mkv", size: 100 }, { id: 2, name: "Show.S01E02.mkv", size: 200 }];
  assert.equal((await adapter.verify(requested)).source.binding.fileId, 2);
  files = [{ id: 2, name: "Show.S01E02.1080p.mkv", size: 200 }, { id: 3, name: "Show.S01E02.720p.mkv", size: 150 }];
  await assert.rejects(() => adapter.verify(requested), (error) => error.code === "provider_file_ambiguous");
  files = [{ id: 2, name: "Show.S01E02E03.mkv", size: 200 }];
  await assert.rejects(() => adapter.verify(requested), (error) => error.code === "provider_file_ambiguous");
  files = [{ id: 1, name: "Show.S01E01.mkv", size: 100 }];
  await assert.rejects(() => adapter.verify(requested), (error) => error.code === "provider_file_ambiguous");
});

test("TorBox adapter rejects a same-hash torrent with a different id", async () => {
  const hash = "e".repeat(40);
  const adapter = new TorBoxProviderAdapter({ apiKey: "secret", rateLimiter: limiter, fetchImpl: async () => response(200, {
    data: [{ id: 12, hash, download_state: "completed", files: [{ id: 1, name: "film.mkv", size: 100 }] }],
  }) });
  await assert.rejects(() => adapter.verify({ torrentId: 11, hash }), (error) => error.code === "provider_job_ambiguous");
});

test("TorBox adapter rejects unavailable provider state", async () => {
  const adapter = new TorBoxProviderAdapter({ apiKey: "secret", rateLimiter: limiter, fetchImpl: async () => response(200, { data: [{ id: 9, hash: "b".repeat(40), download_state: "failed", files: [{ id: 1, name: "x.mp4", size: 12 }] }] }) });
  await assert.rejects(() => adapter.verify({ torrentId: 9, hash: "b".repeat(40) }), (error) => error.code === "provider_item_unavailable");
});

test("TorBox adapter waits for a pending item before publishing it", async () => {
  let polls = 0;
  const adapter = new TorBoxProviderAdapter({
    apiKey: "secret",
    rateLimiter: limiter,
    pollIntervalMs: 1,
    maxWaitMs: 100,
    fetchImpl: async () => response(200, { data: [{
      id: 10,
      hash: "c".repeat(40),
      download_state: ++polls < 3 ? "downloading" : "completed",
      files: [{ id: 4, name: "ready.mkv", size: 44 }],
    }] }),
  });
  const result = await adapter.waitUntilReady({ torrentId: 10, hash: "c".repeat(40) });
  assert.equal(result.source.verified, true);
  assert.equal(polls, 3);
});
