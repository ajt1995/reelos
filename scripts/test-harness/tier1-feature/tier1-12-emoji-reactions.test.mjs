import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 1 - F12.1 Emoji Reactions: registers reaction with id, emoji, senderName, timestamp", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "EMOJ01" });

  const res = service.sendReaction("EMOJ01", "user-1", {
    emoji: "🔥",
    senderName: "Alice",
  });

  assert.equal(res.ok, true);
  assert.ok(res.reaction.id);
  assert.equal(res.reaction.emoji, "🔥");
  assert.equal(res.reaction.senderName, "Alice");
  assert.ok(typeof res.reaction.timestamp === "number");
});

test("Tier 1 - F12.2 Emoji Reactions: stores reaction in room recentReactions list", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "EMOJ02" });

  service.sendReaction("EMOJ02", "user-2", { emoji: "❤️", senderName: "Bob" });
  const summary = service.getRoomSummary("EMOJ02");

  assert.equal(summary.recentReactions.length, 1);
  assert.equal(summary.recentReactions[0].emoji, "❤️");
  assert.equal(summary.recentReactions[0].senderName, "Bob");
});

test("Tier 1 - F12.3 Emoji Reactions: caps reaction buffer at 50 items and summary at 10 to prevent memory bloat", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "EMOJ03" });

  for (let i = 0; i < 65; i++) {
    service.sendReaction("EMOJ03", "user-3", { emoji: `🎉-${i}`, senderName: "Charlie" });
  }

  const summary = service.getRoomSummary("EMOJ03");
  assert.equal(summary.recentReactions.length, 10, "Summary recentReactions returns 10 most recent");
  assert.equal(summary.recentReactions[summary.recentReactions.length - 1].emoji, "🎉-64");

  const room = service.rooms.get("EMOJ03");
  assert.equal(room.reactions.length, 50, "Internal room.reactions buffer must be capped at maxReactions (50)");
});

test("Tier 1 - F12.4 Emoji Reactions: handles variety of Unicode emojis and ambient cinema reactions", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "EMOJ04" });

  const emojis = ["🍿", "🎬", "✨", "👏", "😱", "🚀"];
  for (const emoji of emojis) {
    const res = service.sendReaction("EMOJ04", "user-4", { emoji, senderName: "David" });
    assert.equal(res.ok, true);
    assert.equal(res.reaction.emoji, emoji);
  }

  const summary = service.getRoomSummary("EMOJ04");
  assert.equal(summary.recentReactions.length, emojis.length);
});

test("Tier 1 - F12.5 Emoji Reactions: returns ok: false for non-existent room code", () => {
  const service = new WatchPartyService();
  const res = service.sendReaction("BADCODE", "user-1", { emoji: "🔥" });
  assert.equal(res.ok, false);
  assert.match(res.error, /Room not found/);
});
