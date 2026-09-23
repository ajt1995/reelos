import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTorrent } from "./dispatcher.mjs";

const magnet = `magnet:?xt=urn:btih:${"a".repeat(40)}`;
const accountScope = "f".repeat(64);

test("validated TorBox dispatch uses native account and never the retired bridge", async () => {
  const calls = [];
  const result = await dispatchTorrent(magnet, {
    provider: "torbox", apiKey: "synthetic-key", accountScope, authorize: () => true,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), auth: options.headers.Authorization });
      return { ok: true, status: 200, json: async () => ({ data: { torrent_id: 10 } }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.method, "torbox_native");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.torbox\.app\/v1\/api\/torrents\/createtorrent$/);
  assert.equal(calls[0].auth, "Bearer synthetic-key");
});

test("unscoped or non-native provider dispatch sends no request", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error("must not be called"); };
  assert.equal((await dispatchTorrent(magnet, { provider: "torbox", apiKey: "synthetic-key", fetchImpl })).ok, false);
  assert.equal((await dispatchTorrent(magnet, { provider: "real-debrid", apiKey: "synthetic-key", accountScope, authorize: () => true, fetchImpl })).ok, false);
  assert.equal(calls, 0);
});

test("revoked authority is checked at native dispatch send time", async () => {
  let calls = 0;
  const result = await dispatchTorrent(magnet, {
    provider: "torbox", apiKey: "synthetic-key", accountScope,
    authorize: () => false,
    fetchImpl: async () => { calls++; throw new Error("must not be called"); },
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("provider rejection payload is not reported as a successful dispatch", async () => {
  const result = await dispatchTorrent(magnet, {
    provider: "torbox", apiKey: "synthetic-key", accountScope, authorize: () => true,
    fetchImpl: async () => ({ ok: true, status: 200,
      json: async () => ({ success: false, error: "rejected" }) }),
  });
  assert.equal(result.ok, false);
});
