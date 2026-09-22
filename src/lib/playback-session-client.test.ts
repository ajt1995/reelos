import assert from "node:assert/strict";
import test from "node:test";
import {
  playbackSessionFailureMessage,
  playbackSessionNeedsRestart,
  postPlaybackSession,
  playbackPosition,
  savePrivatePlaybackProgress,
  savePrivateTitleReaction,
} from "./playback-session-client.ts";

const body = { itemId: "movie-1", mediaSourceId: "source-1", playSessionId: "session-1" };

test("private reactions require exact identity, title, value and durable acknowledgement", async () => {
  const reaction = { expectedProfileId: "person-1", titleId: "movie-1", reaction: "love" as const };
  const ack = { ok: true, persisted: true, profileId: "person-1", titleId: "movie-1", reaction: "love" };
  await savePrivateTitleReaction(reaction, async (url, init) => {
    assert.equal(url, "/api/profiles/reaction");
    assert.deepEqual(JSON.parse(String(init?.body)), reaction);
    return Response.json(ack);
  });
  for (const invalid of [{ ...ack, persisted: false }, { ...ack, profileId: "person-2" }, { ...ack, titleId: "other" }, { ...ack, reaction: "like" }, { ok: true }]) {
    await assert.rejects(savePrivateTitleReaction(reaction, async () => Response.json(invalid)));
  }
  await assert.rejects(savePrivateTitleReaction(reaction, async () => new Response("offline", { status: 503 })));
  await assert.rejects(savePrivateTitleReaction(reaction, async () => { throw new Error("offline"); }));
  await savePrivateTitleReaction({ ...reaction, reaction: null }, async () => Response.json({ ...ack, reaction: null }));
});

test("final position preserves sub-heartbeat playback without inventing an unknown duration", () => {
  assert.deepEqual(playbackPosition({ currentTime: 3.5, duration: NaN, paused: true }), {
    positionTicks: 35000000, durationTicks: undefined, isPaused: true,
  });
  assert.equal(playbackPosition({ currentTime: -3, duration: 45, paused: false }).positionTicks, 0);
});

test("stopping uses keepalive and includes the captured final position", async () => {
  await postPlaybackSession("stop", { ...body, positionTicks: 35000000 }, undefined, async (_url, init) => {
    assert.equal(init?.keepalive, true);
    assert.equal(JSON.parse(String(init?.body)).positionTicks, 35000000);
    return Response.json({ ok: true });
  });
});

test("private progress requires persistence acknowledgement and asserts the current identity", async () => {
  const progress = { expectedProfileId: "person-1", titleId: "movie-1", progress: 0.4 };
  await savePrivatePlaybackProgress(progress, async (url, init) => {
    assert.equal(url, "/api/profiles/progress");
    assert.deepEqual(JSON.parse(String(init?.body)), progress);
    assert.equal(init?.keepalive, true);
    return Response.json({ ok: true, persisted: true });
  });
  await assert.rejects(savePrivatePlaybackProgress(progress, async () => Response.json({ ok: true })));
  await assert.rejects(savePrivatePlaybackProgress(progress, async () => Response.json({ ok: false }, { status: 403 })));
});

test("playback session client requires an acknowledged start response", async () => {
  const result = await postPlaybackSession("start", body, undefined, async () =>
    Response.json({ ok: true, presenceKey: "device:session-1" }),
  );
  assert.deepEqual(result, { ok: true, status: 200, presenceKey: "device:session-1", code: undefined, error: undefined });
});

test("playback session client recognizes a recoverable progress-session reset", () => {
  assert.equal(playbackSessionNeedsRestart({ ok: false, status: 409, code: "playback_session_not_started" }), true);
  assert.equal(playbackSessionNeedsRestart({ ok: false, status: 409, code: "playback_session_pending" }), false);
});

test("playback session client preserves authorization failures for the player", () => {
  assert.equal(
    playbackSessionFailureMessage({ ok: false, status: 403, error: "A family PIN is required." }),
    "A family PIN is required.",
  );
});
