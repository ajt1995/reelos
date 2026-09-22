import { test } from "node:test";
import assert from "node:assert/strict";
import { WatchPartyService } from "../../services/watchparty-service.mjs";

test("Tier 2 - F12.1 Emoji Boundary: empty string emoji passes through cleanly", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Alice", customCode: "EMOJIB1" });

  const res = service.sendReaction("EMOJIB1", "user-1", { emoji: "" });
  assert.equal(res.ok, true);
  assert.equal(res.reaction.emoji, "");
});

test("Tier 2 - F12.2 Emoji Boundary: multi-megabyte string in emoji truncated or rejected safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Bob", customCode: "EMOJIB2" });

  const giantEmoji = "🔥".repeat(10000);
  assert.doesNotThrow(() => {
    service.sendReaction("EMOJIB2", "user-2", { emoji: giantEmoji });
  });
});

test("Tier 2 - F12.3 Emoji Boundary: handles script/HTML tags in senderName safely", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Charlie", customCode: "EMOJIB3" });

  const xssName = "<script>alert('xss')</script>";
  const res = service.sendReaction("EMOJIB3", "user-3", { emoji: "🎉", senderName: xssName });

  assert.equal(res.ok, true);
  assert.equal(res.reaction.emoji, "🎉");
});

test("Tier 2 - F12.4 Emoji Boundary: flood of 200 reactions handled without buffer overflow", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "David", customCode: "EMOJIB4" });

  for (let i = 0; i < 200; i++) {
    service.sendReaction("EMOJIB4", "user-4", { emoji: "🚀" });
  }

  const room = service.rooms.get("EMOJIB4");
  assert.ok(room.reactions.length <= 50, "Reactions must be bounded by maxReactions");
});

test("Tier 2 - F12.5 Emoji Boundary: default/omitted options in sendReaction", () => {
  const service = new WatchPartyService();
  service.createRoom({ hostName: "Eve", customCode: "EMOJIB5" });

  const resEmptyObj = service.sendReaction("EMOJIB5", "user-5", {});
  assert.equal(resEmptyObj.ok, true);
  assert.equal(resEmptyObj.reaction.emoji, "❤️");

  const resUndef = service.sendReaction("EMOJIB5", "user-5", undefined);
  assert.equal(resUndef.ok, true);
  assert.equal(resUndef.reaction.emoji, "❤️");
});
