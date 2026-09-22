import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  submitFeedback,
  listFeedback,
  handleFeedbackRoute,
} from "./feedback-service.mjs";

test("Feedback Service", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fb-test-"));

  await t.test("submits feedback and saves diagnostics snapshot", () => {
    const res = submitFeedback({
      category: "idea",
      message: "Please add a dark cyberpunk neon theme!",
      contact: "user@example.com",
      includeDiagnostics: true,
      stateDir: tmpDir,
    });

    assert.equal(res.ok, true);
    assert.ok(res.id.startsWith("fb-"));

    const list = listFeedback(tmpDir);
    assert.equal(list.length, 1);
    assert.equal(list[0].category, "idea");
    assert.equal(list[0].message, "Please add a dark cyberpunk neon theme!");
    assert.ok(list[0].diagnostics !== null);
  });

  await t.test("refuses empty messages", () => {
    const res = submitFeedback({
      category: "bug",
      message: "   ",
      stateDir: tmpDir,
    });
    assert.equal(res.ok, false);
    assert.match(res.error, /cannot be empty/i);
  });

  await t.test("handles HTTP /api/feedback/submit and /api/feedback/list", async () => {
    let statusCode = 0;
    let bodyData = "";
    const mockRes = {
      writeHead(code) {
        statusCode = code;
      },
      end(payload) {
        bodyData = payload;
      },
    };

    // 1. Submit
    await handleFeedbackRoute(
      { method: "POST" },
      mockRes,
      new URL("http://127.0.0.1/api/feedback/submit"),
      async () => ({ category: "feature", message: "Trailer previews on title hover" }),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const postRes = JSON.parse(bodyData);
    assert.equal(postRes.ok, true);

    // 2. List
    await handleFeedbackRoute(
      { method: "GET" },
      mockRes,
      new URL("http://127.0.0.1/api/feedback/list"),
      async () => ({}),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const listRes = JSON.parse(bodyData);
    assert.equal(listRes.ok, true);
    assert.equal(listRes.feedback.length, 2);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
