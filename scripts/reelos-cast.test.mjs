import assert from "node:assert/strict";
import test from "node:test";
import {
  castCommandToSession,
  castPlayToSession,
  fetchJellyfinSessions,
  filterControllableSessions,
  mapJellyfinSession,
  sendSessionMessage,
} from "./reelos-cast.mjs";

test("mapJellyfinSession correctly formats session objects", () => {
  const raw = {
    Id: "sess-123",
    DeviceName: "Living Room TV",
    Client: "Jellyfin for Android TV",
    DeviceId: "dev-456",
    UserName: "reelos",
    SupportsRemoteControl: true,
    NowPlayingItem: {
      Id: "item-789",
      Name: "Inception",
      Type: "Movie",
    },
    PlayState: {
      IsPaused: false,
      PositionTicks: 1200000000,
    },
  };

  const mapped = mapJellyfinSession(raw);
  assert.equal(mapped.id, "sess-123");
  assert.equal(mapped.name, "Living Room TV");
  assert.equal(mapped.client, "Jellyfin for Android TV");
  assert.equal(mapped.supportsRemoteControl, true);
  assert.equal(mapped.nowPlaying.name, "Inception");
  assert.equal(mapped.isPaused, false);
  assert.equal(mapped.positionTicks, 1200000000);
});

test("filterControllableSessions keeps only devices with SupportsRemoteControl", () => {
  const sessions = [
    { Id: "s1", SupportsRemoteControl: true, Client: "Android TV" },
    { Id: "s2", SupportsRemoteControl: false, Client: "DLNA Player" },
    { Id: "s3", SupportsRemoteControl: true, Client: "Web Browser" },
  ];

  const controllable = filterControllableSessions(sessions);
  assert.equal(controllable.length, 2);
  assert.equal(controllable[0].id, "s1");
  assert.equal(controllable[1].id, "s3");
});

test("fetchJellyfinSessions calls Jellyfin with proper auth headers", async () => {
  let calledUrl = "";
  let calledHeaders = {};

  const fakeFetch = async (url, opts) => {
    calledUrl = url;
    calledHeaders = opts.headers;
    return {
      ok: true,
      json: async () => [{ Id: "tv-1", DeviceName: "Samsung TV", SupportsRemoteControl: true }],
    };
  };

  const res = await fetchJellyfinSessions({
    token: "secret-token",
    fetchFn: fakeFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(calledUrl, "http://127.0.0.1:8096/Sessions");
  assert.match(calledHeaders.Authorization, /Token="secret-token"/);
  assert.equal(res.sessions.length, 1);
  assert.equal(res.sessions[0].name, "Samsung TV");
});

test("castPlayToSession sends Play command with parameters", async () => {
  let calledUrl = "";

  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 204 };
  };

  const res = await castPlayToSession({
    sessionId: "tv-1",
    itemIds: "item-100",
    token: "secret-token",
    fetchFn: fakeFetch,
  });

  assert.equal(res.ok, true);
  assert.match(calledUrl, /\/Sessions\/tv-1\/Playing\/Play/);
  assert.match(calledUrl, /ItemIds=item-100/);
  assert.match(calledUrl, /PlayCommand=PlayNow/);
});

test("castCommandToSession sends pause, stop, and seek", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 204 };
  };

  await castCommandToSession({ sessionId: "tv-1", command: "pause", token: "tok", fetchFn: fakeFetch });
  await castCommandToSession({ sessionId: "tv-1", command: "stop", token: "tok", fetchFn: fakeFetch });
  await castCommandToSession({
    sessionId: "tv-1",
    command: "seek",
    params: { positionTicks: 5000 },
    token: "tok",
    fetchFn: fakeFetch,
  });

  assert.match(calls[0], /\/Sessions\/tv-1\/Playing\/Pause/);
  assert.match(calls[1], /\/Sessions\/tv-1\/Playing\/Stop/);
  assert.match(calls[2], /\/Sessions\/tv-1\/Playing\/Seek\?SeekPositionTicks=5000/);
});

test("sendSessionMessage sends Message request with header and text", async () => {
  let calledUrl = "";
  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 204 };
  };

  const res = await sendSessionMessage({
    sessionId: "tv-1",
    header: "ReelOS Test",
    text: "Testing on-screen message",
    token: "secret-token",
    fetchFn: fakeFetch,
  });

  assert.equal(res.ok, true);
  assert.match(calledUrl, /\/Sessions\/tv-1\/Message/);
  assert.match(calledUrl, /Header=ReelOS\+Test/);
  assert.match(calledUrl, /Text=Testing\+on-screen\+message/);
});

