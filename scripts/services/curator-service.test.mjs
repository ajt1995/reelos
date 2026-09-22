import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getCuratorPublicState,
  recordVote,
  resetPreferences,
  processCuratorRequest,
  processCuratorResetRequest,
} from "./curator-service.mjs";

test("Curator Service: returns normalized initial state", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-curator-test-"));
  try {
    const state = getCuratorPublicState(dir);
    assert.ok(Array.isArray(state.hidden));
    assert.ok(Array.isArray(state.liked));
    assert.equal(state.hidden.length, 0);
    assert.equal(state.liked.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Curator Service: records vote and updates public preferences", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-curator-test-"));
  try {
    // Dislike
    const r1 = recordVote({ id: "tmdb-550", title: "Fight Club", vote: "dislike" }, dir);
    assert.equal(r1.ok, true);
    assert.equal(r1.status, 200);
    assert.ok(r1.data.hidden.includes("tmdb-550"));

    // Like
    const r2 = recordVote({ id: "tmdb-157336", title: "Interstellar", vote: "like" }, dir);
    assert.equal(r2.ok, true);
    assert.ok(r2.data.liked.includes("tmdb-157336"));

    // Missing id error
    const rErr = recordVote({ id: "", vote: "like" }, dir);
    assert.equal(rErr.ok, false);
    assert.equal(rErr.status, 400);

    // Reset
    const rReset = resetPreferences(dir);
    assert.equal(rReset.ok, true);
    assert.equal(rReset.data.hidden.length, 0);
    assert.equal(rReset.data.liked.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Curator Service: processCuratorRequest handles GET and POST", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-curator-test-"));
  try {
    const getRes = await processCuratorRequest({ method: "GET" }, async () => ({}), dir);
    assert.equal(getRes.status, 200);
    assert.ok(Array.isArray(getRes.payload.liked));

    const postRes = await processCuratorRequest(
      { method: "POST" },
      async () => ({ id: "tmdb-105", title: "Back to the Future", vote: "like" }),
      dir
    );
    assert.equal(postRes.status, 200);
    assert.ok(postRes.payload.liked.includes("tmdb-105"));

    const badMethod = await processCuratorRequest({ method: "PUT" }, async () => ({}), dir);
    assert.equal(badMethod.status, 405);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Curator Service: processCuratorResetRequest verifies method", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-curator-test-"));
  try {
    const bad = await processCuratorResetRequest({ method: "GET" }, dir);
    assert.equal(bad.status, 405);

    const good = await processCuratorResetRequest({ method: "POST" }, dir);
    assert.equal(good.status, 200);
    assert.equal(good.payload.hidden.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
