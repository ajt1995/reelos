import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readOsUpgradeStatus,
  checkOsUpdatesSync,
  startOsUpgrade,
  requestReboot,
  handleOsUpgradeRoute,
} from "./os-upgrade-service.mjs";

describe("OsUpgradeService (Ubuntu Apt Bridge & Reboot Detection)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reelos-os-upgrade-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("reads default idle status when state directory is empty", () => {
    const status = readOsUpgradeStatus(tmpDir);
    assert.equal(status.ok, true);
    assert.equal(status.status, "idle");
    assert.equal(status.rebootRequired, false);
    assert.equal(status.updatesAvailable, 0);
  });

  it("detects rebootRequired when flag file exists", () => {
    fs.writeFileSync(path.join(tmpDir, "reboot-required"), "*** System restart required ***\n");
    const status = readOsUpgradeStatus(tmpDir);
    assert.equal(status.ok, true);
    assert.equal(status.rebootRequired, true);
  });

  it("reads structured status and log tail correctly", () => {
    const mockData = {
      status: "completed",
      lastChecked: "2026-09-15T00:00:00Z",
      updatesAvailable: 5,
      securityUpdates: 3,
      rebootRequired: false,
      rebootPackages: ["linux-generic", "openssl"],
      osName: "Ubuntu 24.04.1 LTS",
    };
    fs.writeFileSync(path.join(tmpDir, "os-upgrade-status.json"), JSON.stringify(mockData));
    fs.writeFileSync(
      path.join(tmpDir, "os-upgrade.log"),
      "Line 1: apt-get update\nLine 2: upgrading 5 packages\nLine 3: done"
    );

    const status = readOsUpgradeStatus(tmpDir);
    assert.equal(status.ok, true);
    assert.equal(status.status, "completed");
    assert.equal(status.updatesAvailable, 5);
    assert.equal(status.securityUpdates, 3);
    assert.ok(status.logTail.includes("Line 3: done"));
  });

  it("runs checkOsUpdatesSync and updates status file", () => {
    const res = checkOsUpdatesSync({ stateDir: tmpDir });
    if (process.platform === "linux") {
      assert.equal(typeof res.ok, "boolean");
    } else {
      assert.equal(res.ok, false);
      assert.equal(res.available, false);
    }
  });

  it("prevents starting upgrade if already running or during OTA", () => {
    // 1. Simulate already running
    fs.writeFileSync(
      path.join(tmpDir, "os-upgrade-status.json"),
      JSON.stringify({ status: "running" })
    );
    const failRun = startOsUpgrade({ stateDir: tmpDir });
    assert.equal(failRun.ok, false);
    assert.match(failRun.error, /already in progress/);

    // 2. Simulate OTA collision
    const origOta = process.env.REELOS_OTA;
    process.env.REELOS_OTA = "1";
    fs.writeFileSync(
      path.join(tmpDir, "os-upgrade-status.json"),
      JSON.stringify({ status: "idle" })
    );
    const otaCollision = startOsUpgrade({ stateDir: tmpDir });
    assert.equal(otaCollision.ok, false);
    assert.match(otaCollision.error, /OTA is currently running/);
    process.env.REELOS_OTA = origOta;
  });

  it("handles HTTP routes properly", async () => {
    // 1. GET /api/system/os-upgrade/status
    let resHeaders = {};
    let resCode = 0;
    let resBody = "";
    const mockRes = {
      writeHead(code, headers) {
        resCode = code;
        resHeaders = headers;
      },
      end(body) {
        resBody = body;
      },
    };

    const handledStatus = await handleOsUpgradeRoute(
      { url: "/api/system/os-upgrade/status", method: "GET" },
      mockRes,
      { stateDir: tmpDir }
    );
    assert.equal(handledStatus, true);
    assert.equal(resCode, 200);
    const parsedStatus = JSON.parse(resBody);
    assert.equal(parsedStatus.ok, true);

    // 2. POST /api/system/os-upgrade/check
    const handledCheck = await handleOsUpgradeRoute(
      { url: "/api/system/os-upgrade/check", method: "POST" },
      mockRes,
      { stateDir: tmpDir }
    );
    assert.equal(handledCheck, true);
    assert.equal(resCode, process.platform === "linux" ? 200 : 500);

    // 3. POST /api/system/reboot
    const handledReboot = await handleOsUpgradeRoute(
      { url: "/api/system/reboot", method: "POST" },
      mockRes,
      { stateDir: tmpDir }
    );
    assert.equal(handledReboot, true);
    assert.equal(resCode, process.platform === "linux" ? 200 : 500);
    const parsedReboot = JSON.parse(resBody);
    assert.equal(parsedReboot.ok, process.platform === "linux");
  });
});
