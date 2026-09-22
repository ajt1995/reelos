import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  createGuestPass,
  pruneExpiredGuests,
  GUEST_VIBES,
  HORROR_LEVELS,
  handleGuestPassRoute,
} from "./guest-pass-service.mjs";

test("Guest Pass Service", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guest-test-"));

  await t.test("creates guest pass with 3-question vibe blending", () => {
    const res = createGuestPass({
      nickname: "Jordan",
      vibeChoice: "scifi_mindbender",
      horrorLevel: "none",
      stateDir: tmpDir,
    });

    assert.equal(res.ok, true);
    assert.equal(res.guestProfile.name, "Jordan");
    assert.equal(res.guestProfile.isGuest, true);
    assert.equal(res.guestProfile.curationWeights["sci-fi"], 1.5);
    assert.equal(res.guestProfile.curationWeights.horror, -2.0); // Suppressed
    assert.ok(res.guestProfile.expiresAt > Date.now());
  });

  await t.test("prunes expired guest passes without touching resident profiles", () => {
    // Force an expired guest
    const res = createGuestPass({
      nickname: "OldGuest",
      vibeChoice: "action_blast",
      stateDir: tmpDir,
    });
    // Manually expire it
    const profilePath = path.join(tmpDir, "profiles", `${res.guestProfile.id}.json`);
    const doc = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    doc.expiresAt = Date.now() - 10000;
    fs.writeFileSync(profilePath, JSON.stringify(doc));

    const pruneRes = pruneExpiredGuests(tmpDir, Date.now());
    assert.equal(pruneRes.ok, true);
    assert.ok(pruneRes.prunedIds.includes(res.guestProfile.id));
    assert.equal(fs.existsSync(profilePath), false);
  });

  await t.test("handles HTTP /api/guest/presets and /api/guest/join", async () => {
    let statusCode = 0;
    let headers = {};
    let bodyData = "";
    const mockRes = {
      writeHead(code, h) {
        statusCode = code;
        headers = h;
      },
      end(payload) {
        bodyData = payload;
      },
    };

    // 1. Presets
    await handleGuestPassRoute(
      { method: "GET" },
      mockRes,
      new URL("http://127.0.0.1/api/guest/presets"),
      async () => ({}),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const presets = JSON.parse(bodyData);
    assert.equal(presets.ok, true);
    assert.ok(presets.vibes.length >= 4);

    // 2. Join
    await handleGuestPassRoute(
      { method: "POST" },
      mockRes,
      new URL("http://127.0.0.1/api/guest/join"),
      async () => ({ nickname: "Sam", vibeChoice: "feelgood_comedy", horrorLevel: "mild_thrills" }),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const joinResult = JSON.parse(bodyData);
    assert.equal(joinResult.ok, true);
    assert.equal(joinResult.guestProfile.name, "Sam");
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
