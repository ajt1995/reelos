import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import test from "node:test";
import { applyIsRunning, applyProductRunning, applyTargetFromLog, lockIsHeld, parseLibraryProgress, productSwapDone } from "./reelos-ota-status.mjs";

test("leftover ota.lock file is not running", () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-ota-"));
  const lock = join(dir, "ota.lock");
  writeFileSync(lock, "");
  assert.equal(existsSync(lock), true);
  assert.equal(lockIsHeld(lock), false);
  assert.equal(applyIsRunning({ lockPath: lock, env: {} }), false);
});

test("held flock is running; leftover after release is not", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reelos-ota-"));
  const lock = join(dir, "ota.lock");
  const child = spawn("bash", ["-c", `exec 9>"${lock}"; flock -n 9 || exit 2; sleep 8`], {
    stdio: "ignore",
  });
  let held = false;
  for (let i = 0; i < 20; i++) {
    await delay(50);
    if (lockIsHeld(lock)) {
      held = true;
      break;
    }
  }
  assert.equal(held, true);
  assert.equal(applyIsRunning({ lockPath: lock, env: {} }), true);
  child.kill("SIGTERM");
  await delay(80);
  assert.equal(lockIsHeld(lock), false);
});

test("REELOS_OTA=1 is running without touching the lock", () => {
  assert.equal(applyIsRunning({ env: { REELOS_OTA: "1" }, lockPath: "/no/such/ota.lock" }), true);
});

test("applyTargetFromLog reads the last arrow, then channel", () => {
  assert.equal(applyTargetFromLog("ReelOS 1.2.50.22 → 1.2.50.23\n"), "1.2.50.23");
  assert.equal(
    applyTargetFromLog("ReelOS 1.2.50.21 → 1.2.50.22\nReelOS 1.2.50.22 → 1.2.50.23\n"),
    "1.2.50.23",
  );
  assert.equal(applyTargetFromLog("channel 1.2.50.23\ncanaries ok\n"), "1.2.50.23");
  assert.equal(applyTargetFromLog(""), null);
});

test("product swap done ends the Applying clock while lock/unit can still refuse a second Apply", () => {
  const log = "ReelOS 1.2.50.38 → 1.2.50.40\nengines may still be configuring\nReelOS 1.2.50.40 applied.\nlibrary catch-up in background\n";
  assert.equal(productSwapDone(log), true);
  assert.equal(productSwapDone("ReelOS 1.2.50.38 → 1.2.50.40\nhops\n"), false);
  assert.equal(
    applyProductRunning({ env: {}, lockPath: "/no/such/ota.lock", logText: log }),
    false,
  );
});

test("library progress splash-locks only when running and dumps need import", () => {
  const running = parseLibraryProgress(
    JSON.stringify({ status: "running", needsImport: true, folder: 3, total: 16, skipped: 4, timeouts: 1, message: "Library catching up — folder 3 of 16" }),
  );
  assert.equal(running.splashLock, true);
  assert.match(running.message, /folder 3 of 16/);
  const skipped = parseLibraryProgress(JSON.stringify({ status: "running", needsImport: false, skipped: 12 }));
  assert.equal(skipped.splashLock, false);
  const back = parseLibraryProgress(JSON.stringify({ status: "backoff", needsImport: true }));
  assert.equal(back.splashLock, false);
});

