import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cmpVer,
  displayVersion,
  isRollback,
  notesForVersion,
  ownerEnglish,
  pendingNotes,
  stripVersionPrefix,
} from "./update-notes.mjs";

const NOTES = [
  "1.2.50.33: Requests is in-flight only. Remove from this box unmonitors and deletes the *arr row — never /media. Settings → Updates shows this install and, after Check, the pending update. Complements #94. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.32: Search→request→play: recover keeps kicking. Complements #86. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
  "1.2.50.31: Firstboot does not loop on a provisioned box. Complements #86. 1.2.51 parked (was Tron chrome; scrapped — do not reuse).",
];

test("ownerEnglish strips PR asides and parked Tron lines", () => {
  const s = ownerEnglish(NOTES[0]);
  assert.match(s, /Requests is in-flight only/);
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
  const pending = pendingNotes(NOTES, "1.2.50.31", "1.2.50.33");
  assert.deepEqual(
    pending.map(stripVersionPrefix),
    [
      "Requests is in-flight only. Remove from this box unmonitors and deletes the *arr row — never /media. Settings → Updates shows this install and, after Check, the pending update.",
      "Search→request→play: recover keeps kicking.",
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
  const pending = pendingNotes(NOTES, "0", "1.2.50.33");
  assert.equal(pending.length, 1);
  assert.match(pending[0], /^1\.2\.50\.33:/);
});

test("displayVersion ignores placeholder current", () => {
  assert.equal(displayVersion("…", "1.2.50.33"), "1.2.50.33");
  assert.equal(displayVersion("0", "1.2.50.33"), "1.2.50.33");
  assert.equal(displayVersion("1.2.50.27", "1.2.50.33"), "1.2.50.27");
  assert.equal(displayVersion("1.2.50.38-beta.1", "1.2.50.38"), "1.2.50.38-beta.1");
});

test("2.0.0 is newer than 1.2.50.39; rollback is the older stable", () => {
  assert.ok(cmpVer("2.0.0", "1.2.50.39") > 0);
  assert.ok(cmpVer("1.2.50.39", "2.0.0") < 0);
  assert.equal(isRollback("2.0.0", "1.2.50.39", false), true);
  assert.equal(isRollback("2.0.0", "1.2.50.39", true), false);
  assert.equal(isRollback("1.2.50.39", "1.2.50.39", false), false);
  const pending = pendingNotes(
    ["2.0.0: Arena chrome and Books.", "1.2.50.39: Stable."],
    "1.2.50.39",
    "2.0.0",
  );
  assert.equal(pending.length, 1);
  assert.match(pending[0], /Arena chrome and Books/);
});
