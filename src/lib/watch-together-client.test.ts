import assert from "node:assert/strict";
import { test } from "node:test";
import {
  householdConsensus,
  inviteCodeFromLocation,
  normalizeInviteCode,
  parsePartyRoom,
} from "../experience/watch-together-client.ts";

test("watch together normalizes share codes and reads deep links", () => {
  assert.equal(normalizeInviteCode(" ab-c12! "), "ABC12");
  assert.equal(inviteCodeFromLocation("?code=couch1"), "COUCH1");
});
test("watch together rejects invented or incomplete room state", () => {
  assert.equal(parsePartyRoom({ code: "ABC123", title: "Film" }), null);
  assert.equal(parsePartyRoom({ code: "bad", titleId: "a", title: "Film", hostId: "h" }), null);
});

test("watch together preserves confirmed participants and connection truth", () => {
  const room = parsePartyRoom({
    code: "ABC123",
    titleId: "film",
    title: "Film",
    hostId: "host",
    participants: [{ id: "host", name: "Austin", isHost: true, connected: false, joinedAt: 10 }],
  });
  assert.equal(room?.participants[0]?.connected, false);
  assert.equal(room?.participants[0]?.isHost, true);
});

test("household consensus protects an objection from being averaged away", () => {
  const titles = [
    { id: "no", moods: [] },
    { id: "yes", moods: [] },
  ] as any;
  const profiles = [
    { reactions: { no: "love", yes: "like" }, lessLikeIds: [] },
    { reactions: {}, lessLikeIds: ["no"] },
  ] as any;
  assert.deepEqual(householdConsensus(titles, profiles).map((title) => title.id), ["yes", "no"]);
});
