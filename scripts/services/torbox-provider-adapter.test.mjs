import test from "node:test";
import assert from "node:assert/strict";
import { TorBoxProviderAdapter, torBoxFileSelector } from "./torbox-provider-adapter.mjs";

const limiter = { executeRequest: async (_key, call) => ({ data: await call() }) };
const response = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });

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
  assert.equal(torBoxFileSelector([{ id: 1, name: "a.mkv", size: 100 }], 2), null);
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
