import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AGE_BANDS,
  MEMBER_WIZARD_QUESTIONS,
  MEMBER_WIZARD_TOTAL,
  OWNER_PERMISSION_TOGGLES,
  defaultPermissions,
  isHouseOwner,
  parentalMaxForAge,
} from "./household-profile.ts";

test("member wizard questions are verbatim", () => {
  assert.equal(MEMBER_WIZARD_TOTAL, 2);
  assert.equal(MEMBER_WIZARD_QUESTIONS[0].title, "How old are you?");
  assert.equal(MEMBER_WIZARD_QUESTIONS[1].title, "Jellyfin username and password/PIN");
  assert.equal(AGE_BANDS.length, 4);
  assert.equal(parentalMaxForAge(10), 10);
  assert.equal(isHouseOwner("admin"), true);
  assert.equal(defaultPermissions("member", 8).canManageHouse, false);
  assert.equal(OWNER_PERMISSION_TOGGLES.length, 6);
});
