import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  gatherApplianceDiagnostics,
  handleDiagnosticsRoute,
} from "./diagnostics-heartbeat-service.mjs";

test("Diagnostics Heartbeat Service", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diag-test-"));

  await t.test("gathers appliance diagnostics accurately", () => {
    const diag = gatherApplianceDiagnostics({ stateDir: tmpDir });
    assert.ok(diag.timestamp > 0);
    assert.ok(diag.hardware.cores >= 1);
    assert.ok(["potato", "whisper_workhorse", "beast"].includes(diag.hardware.tier));
    assert.ok(diag.storage.totalGb > 0);
    assert.equal(diag.services.webPortal, "online");
    assert.ok(["healthy", "degraded"].includes(diag.healthStatus));
  });

  await t.test("handles HTTP /api/diagnostics/heartbeat and /api/diagnostics/ping", async () => {
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

    // 1. Heartbeat
    await handleDiagnosticsRoute(
      { method: "GET" },
      mockRes,
      new URL("http://127.0.0.1/api/diagnostics/heartbeat"),
      async () => ({}),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const hb = JSON.parse(bodyData);
    assert.equal(hb.ok, true);
    assert.ok(hb.heartbeat.uptimeSeconds >= 0);

    // 2. Ping
    await handleDiagnosticsRoute(
      { method: "POST" },
      mockRes,
      new URL("http://127.0.0.1/api/diagnostics/ping"),
      async () => ({}),
      tmpDir
    );
    assert.equal(statusCode, 200);
    const ping = JSON.parse(bodyData);
    assert.equal(ping.ok, true);
    assert.equal(ping.ack, true);
    assert.equal(fs.existsSync(path.join(tmpDir, "last-heartbeat.json")), true);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
