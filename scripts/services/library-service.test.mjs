import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sanitizeTitleString,
  validateRemovePayload,
  validateResetPayload,
  buildLibraryPayload,
} from "./library-service.mjs";

test("Library Service: sanitizes scene release strings", () => {
  assert.equal(sanitizeTitleString("Inception.1080p.BluRay.x264"), "Inception");
  assert.equal(sanitizeTitleString("The.Matrix.1999.2160p.UHD.Remux"), "The Matrix 1999");
  assert.equal(sanitizeTitleString("Breaking Bad"), "Breaking Bad");
  assert.equal(sanitizeTitleString(""), "");
  assert.equal(sanitizeTitleString(null), null);
});

test("Library Service: validates remove payload", () => {
  const valid = validateRemovePayload({ titleId: "tmdb-550", confirm: true });
  assert.equal(valid.ok, true);
  assert.equal(valid.params.titleId, "tmdb-550");
  assert.equal(valid.params.confirm, true);

  const validJf = validateRemovePayload({ jellyfinId: "jf-abc-123" });
  assert.equal(validJf.ok, true);

  const invalid = validateRemovePayload({});
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);
});

test("Library Service: validates reset payload", () => {
  const ok = validateResetPayload({ confirm: true, resync: true });
  assert.equal(ok.ok, true);
  assert.equal(ok.resync, true);

  const missingConfirm = validateResetPayload({ confirm: false });
  assert.equal(missingConfirm.ok, false);
  assert.equal(missingConfirm.status, 400);
});

test("Library Service: builds structured library payload", () => {
  const res = buildLibraryPayload({
    titles: [{ id: "tmdb-550", title: "Fight Club" }],
    continueWatching: [],
    error: null,
  });
  assert.equal(res.titles.length, 1);
  assert.equal(res.titles[0].title, "Fight Club");
  assert.deepEqual(res.continueWatching, []);
});
