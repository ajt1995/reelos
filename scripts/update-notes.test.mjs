import assert from "node:assert/strict";
import { test } from "node:test";
import {
  displayVersion,
  notesForVersion,
  ownerEnglish,
  pendingNotes,
  stripVersionPrefix,
} from "./update-notes.mjs";

const NOTES = [
  "1.2.50.34: Settings → Updates shows what this install changed. Complements #90. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.33: Library remove on the phone. Complements #91. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.32: Request then Play tells the truth. Complements #92. Not 1.2.51 (Tron).",
  "1.2.50.31: Firstboot does not loop on a provisioned box. Complements #86. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
];

test("ownerEnglish strips PR asides and parked Tron lines", () => {
  const s = ownerEnglish(NOTES[0]);
  assert.match(s, /Settings → Updates/);
  assert.doesNotMatch(s, /Complements/);
  assert.doesNotMatch(s, /1\.2\.51/);
  assert.doesNotMatch(s, /Tron/i);
});

test("notesForVersion is this stamp only", () => {
  const rows = notesForVersion(NOTES, "1.2.50.31");
  assert.equal(rows.length, 1);
  assert.match(stripVersionPrefix(rows[0]), /Firstboot does not loop/);
  assert.doesNotMatch(rows[0], /Tron/i);
});

test("pendingNotes is the delta, not the git log", () => {
  const pending = pendingNotes(NOTES, "1.2.50.31", "1.2.50.34");
  assert.deepEqual(
    pending.map(stripVersionPrefix),
    [
      "Settings → Updates shows what this install changed.",
      "Library remove on the phone.",
      "Request then Play tells the truth.",
    ],
  );
});

test("pendingNotes caps at four newest", () => {
  const many = [
    "1.2.50.40: Five.",
    "1.2.50.39: Four.",
    "1.2.50.38: Three.",
    "1.2.50.37: Two.",
    "1.2.50.36: One.",
    "1.2.50.31: Base.",
  ];
  const pending = pendingNotes(many, "1.2.50.31", "1.2.50.40");
  assert.equal(pending.length, 4);
  assert.match(pending[0], /^1\.2\.50\.40:/);
});

test("unknown local only names the remote stamp", () => {
  const pending = pendingNotes(NOTES, "0", "1.2.50.34");
  assert.equal(pending.length, 1);
  assert.match(pending[0], /^1\.2\.50\.34:/);
});

test("displayVersion ignores placeholder current", () => {
  assert.equal(displayVersion("…", "1.2.50.34"), "1.2.50.34");
  assert.equal(displayVersion("0", "1.2.50.34"), "1.2.50.34");
  assert.equal(displayVersion("1.2.50.27", "1.2.50.34"), "1.2.50.27");
});
