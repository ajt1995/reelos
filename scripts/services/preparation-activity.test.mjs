import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { EventEmitter, once } from "node:events";
import { PassThrough, Writable } from "node:stream";
import {
  beginPreparationBlockingStream, hasPreparationBlockingPlayback,
  subscribePreparationBlockingPlayback, updatePreparationBlockingSession, endPreparationBlockingSession,
} from "./preparation-activity.mjs";
import { streamLocalFile, proxyRemoteStream } from "./neural-stream-server.mjs";
import { forwardPlaybackSession } from "./playback-session-service.mjs";
import { createPlaybackFixture } from "../test-harness/playback-fixtures.mjs";

function request(method = "GET", range) {
  return Object.assign(new EventEmitter(), { method, headers: range ? { range } : {} });
}
function response() {
  const headers = new Map();
  const res = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  res.setHeader = (key, value) => headers.set(key.toLowerCase(), value);
  res.hasHeader = (key) => headers.has(key.toLowerCase());
  res.headersSent = false;
  return res;
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function waitForIdle() {
  if (!hasPreparationBlockingPlayback()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("Playback activity did not settle")); }, 2000);
    const unsubscribe = subscribePreparationBlockingPlayback((active) => {
      if (!active) { clearTimeout(timer); unsubscribe(); resolve(); }
    });
  });
}

test("overlapping byte leases are reference counted, releases and unsubscribe are idempotent", () => {
  assert.equal(hasPreparationBlockingPlayback(), false);
  const events = [];
  const unsubscribe = subscribePreparationBlockingPlayback((active) => events.push(active));
  const removeThrowing = subscribePreparationBlockingPlayback(() => { throw new Error("observer failure"); });
  const first = beginPreparationBlockingStream();
  const second = beginPreparationBlockingStream();
  assert.equal(hasPreparationBlockingPlayback(), true);
  first(); first();
  assert.equal(hasPreparationBlockingPlayback(), true);
  second(); second();
  assert.equal(hasPreparationBlockingPlayback(), false);
  assert.deepEqual(events, [true, false]);
  unsubscribe(); unsubscribe(); removeThrowing();
  const next = beginPreparationBlockingStream(); next();
  assert.deepEqual(events, [true, false]);
});

test("expired sessions unblock and an outstanding byte stream still blocks", (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  updatePreparationBlockingSession("expiring-a", 1100);
  updatePreparationBlockingSession("expiring-b", 1200);
  now = 1101;
  assert.equal(hasPreparationBlockingPlayback(), true);
  const release = beginPreparationBlockingStream();
  now = 1201;
  assert.equal(hasPreparationBlockingPlayback(), true);
  release();
  assert.equal(hasPreparationBlockingPlayback(), false);
  endPreparationBlockingSession("expiring-a"); endPreparationBlockingSession("expiring-b");
});

test("local HEAD and unsatisfiable ranges do not acquire; real read closes and aborted reads release", async () => {
  const home = createPlaybackFixture();
  const file = path.join(home.stateDir, "bytes.mp4");
  fs.writeFileSync(file, Buffer.alloc(256 * 1024));
  const events = [];
  const unsubscribe = subscribePreparationBlockingPlayback((active) => events.push(active));
  try {
    for (const req of [request("HEAD"), request("HEAD", "bytes=0-1"), request("GET", "bytes=999999-")]) {
      const res = response();
      const closed = once(res, "close");
      streamLocalFile(req, res, file);
      await closed;
      assert.equal(hasPreparationBlockingPlayback(), false);
    }
    assert.deepEqual(events, []);
    const req = request(), res = response();
    const closed = once(res, "close");
    streamLocalFile(req, res, file);
    assert.equal(hasPreparationBlockingPlayback(), true, "lease exists before filesystem open completes");
    await closed; await waitForIdle();
    assert.equal(hasPreparationBlockingPlayback(), false);
    const abortedReq = request(), abortedRes = response();
    streamLocalFile(abortedReq, abortedRes, file);
    assert.equal(hasPreparationBlockingPlayback(), true);
    abortedReq.emit("aborted");
    await waitForIdle();
    assert.equal(hasPreparationBlockingPlayback(), false);
    abortedRes.destroy();
  } finally { unsubscribe(); }
});

test("local open errors release activity without a successful playback receipt", async () => {
  const home = createPlaybackFixture();
  const file = path.join(home.stateDir, "vanishing.mp4");
  fs.writeFileSync(file, "fixture");
  const unsubscribe = subscribePreparationBlockingPlayback((active) => {
    if (active) fs.unlinkSync(file); // Deterministic stat -> open failure, isolated fixture only.
  });
  const res = response();
  const closed = once(res, "close");
  try {
    streamLocalFile(request(), res, file);
    await closed; await waitForIdle();
    assert.equal(res.statusCode, 500);
    assert.equal(hasPreparationBlockingPlayback(), false);
  } finally { unsubscribe(); }
});

function mockProxy(t, replies) {
  const requests = [];
  t.mock.method(http, "request", (_url, _options, onResponse) => {
    const req = new PassThrough();
    req.resume();
    req.end = () => {
      const reply = replies.shift();
      if (reply instanceof Error) { queueMicrotask(() => req.destroy(reply)); return; }
      const upstream = new PassThrough();
      upstream.statusCode = reply.status || 200;
      upstream.headers = reply.headers || {};
      requests.push({ req, upstream });
      onResponse(upstream);
      reply.run?.(upstream);
    };
    return req;
  });
  return requests;
}

test("proxy retains one lease across redirects until actual destination close", async (t) => {
  const requests = mockProxy(t, [{ status: 302, headers: { location: "/final" } }, {}]);
  const events = [];
  const unsubscribe = subscribePreparationBlockingPlayback((active) => events.push(active));
  const req = request(), res = response();
  proxyRemoteStream(req, res, "http://isolated.invalid/first");
  assert.equal(requests.length, 2);
  assert.equal(hasPreparationBlockingPlayback(), true);
  res.emit("finish");
  assert.equal(hasPreparationBlockingPlayback(), true, "headers/finish alone cannot end the byte lease");
  const closed = once(res, "close");
  res.destroy();
  await closed; await tick();
  assert.equal(hasPreparationBlockingPlayback(), false);
  assert.ok(requests.every(({ req: upstreamRequest, upstream }) => upstreamRequest.destroyed && upstream.destroyed));
  assert.deepEqual(events, [true, false]);
  unsubscribe();
});

test("proxy HEAD never blocks; range refusal and request/upstream/client failures release", async (t) => {
  for (const kind of ["head", "range", "request-error", "upstream-error", "aborted", "redirect-limit", "invalid-url"]) {
    const replies = kind === "request-error" ? [new Error("fixture connection failure")]
      : [{ status: kind === "range" ? 416 : 200 }];
    const requests = mockProxy(t, replies);
    const events = [];
    const unsubscribe = subscribePreparationBlockingPlayback((active) => events.push(active));
    const req = request(kind === "head" ? "HEAD" : "GET"), res = response();
    res.on("error", () => {});
    proxyRemoteStream(req, res, kind === "invalid-url" ? "not a URL" : "http://isolated.invalid/media", kind === "redirect-limit" ? -1 : 5);
    if (kind === "head") assert.deepEqual(events, []);
    if (kind === "upstream-error") requests[0].upstream.destroy(new Error("fixture upstream failure"));
    if (kind === "aborted") req.emit("aborted");
    await tick(); await tick();
    assert.equal(hasPreparationBlockingPlayback(), false, kind);
    res.destroy();
    unsubscribe();
    t.mock.restoreAll();
  }
});

test("normal proxy completion and synchronous request setup failure both release", async (t) => {
  const requests = mockProxy(t, [{}]);
  const res = response();
  const closed = once(res, "close");
  proxyRemoteStream(request(), res, "http://isolated.invalid/media");
  assert.equal(hasPreparationBlockingPlayback(), true);
  requests[0].upstream.end("fixture bytes");
  await closed;
  assert.equal(hasPreparationBlockingPlayback(), false);
  t.mock.restoreAll();
  t.mock.method(http, "request", () => { throw new Error("fixture request setup failure"); });
  const failed = response();
  proxyRemoteStream(request(), failed, "http://isolated.invalid/media");
  assert.equal(failed.statusCode, 502);
  assert.equal(hasPreparationBlockingPlayback(), false);
});

test("two validated paused local sessions block between ranges and stopping only one does not unblock", async () => {
  const home = createPlaybackFixture();
  const file = path.join(home.stateDir, "film.mp4");
  fs.writeFileSync(file, "personal fixture");
  home.writeLibrary([{ id: "film", path: file, sourceKind: "personal_import", OfficialRating: "G" }]);
  const options = { ...home.options, request: { headers: { cookie: home.cookie } } };
  const body = (id) => ({ itemId: "film", playSessionId: id, isPaused: true });
  assert.equal((await forwardPlaybackSession("start", body("denied"), { ...options, request: { headers: {} } })).ok, false);
  assert.equal(hasPreparationBlockingPlayback(), false);
  try {
    assert.equal((await forwardPlaybackSession("start", body("one"), options)).ok, true);
    assert.equal((await forwardPlaybackSession("start", body("two"), options)).ok, true);
    assert.equal((await forwardPlaybackSession("progress", body("two"), options)).ok, true);
    assert.equal(hasPreparationBlockingPlayback(), true);
    assert.equal((await forwardPlaybackSession("stop", body("one"), options)).ok, true);
    assert.equal(hasPreparationBlockingPlayback(), true);
    assert.equal((await forwardPlaybackSession("stop", body("two"), options)).ok, true);
    assert.equal(hasPreparationBlockingPlayback(), false);
  } finally {
    await forwardPlaybackSession("stop", body("one"), options);
    await forwardPlaybackSession("stop", body("two"), options);
  }
});

test("late acknowledged progress cannot recreate an activity lease after its session stopped", async (t) => {
  const home = createPlaybackFixture();
  const options = { ...home.options, request: { headers: { cookie: home.cookie } },
    presenceService: { getRoomPresence: () => ({ state: { kidsPresent: false } }) } };
  const body = { itemId: "remote-film", playSessionId: "late-progress" };
  let startedProgress, finishProgress;
  const waiting = new Promise((resolve) => { startedProgress = resolve; });
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/Progress")) {
      startedProgress();
      return new Promise((resolve) => { finishProgress = () => resolve(new Response(null, { status: 204 })); });
    }
    return new Response(null, { status: 204 });
  });
  assert.equal((await forwardPlaybackSession("start", body, options)).ok, true);
  const progress = forwardPlaybackSession("progress", body, options);
  await waiting;
  assert.equal((await forwardPlaybackSession("stop", body, options)).ok, true);
  assert.equal(hasPreparationBlockingPlayback(), false);
  finishProgress();
  assert.equal((await progress).ok, true);
  assert.equal(hasPreparationBlockingPlayback(), false);
});
