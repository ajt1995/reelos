import test from "node:test";
import assert from "node:assert/strict";
import { consumePlayerCompanionCommand, playerCompanionTiming, pollPlayerCompanionCommands, publishPlayerCompanionSession } from "./player-companion.ts";

test("web player publishes real timing and polls only its session", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true, commands: [{ id: "one", action: "seek", payload: { deltaTicks: 100_000_000 } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const timing = playerCompanionTiming({ currentTime: 12.5, duration: 100, paused: false } as HTMLVideoElement);
  await publishPlayerCompanionSession({ sessionId: "living-room", titleId: "film", titleName: "Film", ...timing }, fetcher);
  const commands = await pollPlayerCompanionCommands("living-room", undefined, fetcher);
  assert.equal(calls[0].url, "/api/companion/session");
  assert.match(String(calls[0].init?.body), /125000000/);
  assert.equal(calls[1].url, "/api/companion/remote/poll?sessionId=living-room");
  assert.equal(commands[0].action, "seek");
});

test("web player consumes bounded play, pause, relative and absolute seek commands", async () => {
  let plays = 0, pauses = 0;
  const video = { currentTime: 50, duration: 100, async play() { plays++; }, pause() { pauses++; } };
  await consumePlayerCompanionCommand(video as HTMLVideoElement, { id: "p", action: "play", payload: {} });
  await consumePlayerCompanionCommand(video as HTMLVideoElement, { id: "s", action: "seek", payload: { deltaTicks: -600_000_000 } });
  assert.equal(video.currentTime, 0);
  await consumePlayerCompanionCommand(video as HTMLVideoElement, { id: "a", action: "seek", payload: { positionTicks: 2_000_000_000 } });
  assert.equal(video.currentTime, 100);
  await consumePlayerCompanionCommand(video as HTMLVideoElement, { id: "x", action: "pause", payload: {} });
  assert.equal(plays, 1); assert.equal(pauses, 1);
});
