import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import test from "node:test";
import { applyIsRunning, applyTargetFromLog, lockIsHeld } from "./reelos-ota-status.mjs";

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
  assert.equal(applyTargetFromLog("ReelOS 1.2.50.20 → 1.2.50.21\n"), "1.2.50.21");
  assert.equal(
    applyTargetFromLog("ReelOS 1.2.50.19 → 1.2.50.20\nReelOS 1.2.50.20 → 1.2.50.21\n"),
    "1.2.50.21",
  );
  assert.equal(applyTargetFromLog("channel 1.2.50.21\ncanaries ok\n"), "1.2.50.21");
  assert.equal(applyTargetFromLog(""), null);
});
