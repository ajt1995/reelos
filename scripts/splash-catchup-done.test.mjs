import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseLibraryProgress, shouldSplashLock } from "./reelos-ota-status.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("client splash-locks chrome via updateLocksUi while applying; catch-up is a banner", () => {
  const helper = read("src/lib/library-catchup.ts");
  assert.match(helper, /export function catchupLocksHome/);
  assert.match(helper, /export function catchupShowsBanner/);
  assert.match(helper, /export function updateLocksUi/);
  assert.match(helper, /needsImport/);
  assert.match(helper, /SETTLED/);
  assert.match(read("src/components/gate.tsx"), /updateLocksUi/);
  assert.match(read("src/components/gate.tsx"), /Splash updating/);
  assert.match(read("src/components/splash.tsx"), /catchupLocksHome/);
  assert.match(read("src/components/splash.tsx"), /Updating ReelOS/);
  assert.match(read("src/components/library-catchup-bar.tsx"), /catchupShowsBanner/);
  assert.match(read("src/components/home-view.tsx"), /catchupShowsBanner/);
});

test("skip-only leftover JSON does not splash-lock when catch-up is idle", () => {
  const leftover = parseLibraryProgress(
    JSON.stringify({
      status: "running",
      needsImport: true,
      splashLock: true,
      skipped: 14,
      folder: 1,
      total: 1,
      timeouts: 0,
      message: "Library catching up — folder 1 of 1, 14 skipped",
    }),
    { actuallyRunning: false },
  );
  assert.equal(leftover.splashLock, false);
  assert.equal(leftover.status, "done");
  assert.match(leftover.message, /catch-up done/);
  assert.doesNotMatch(leftover.message, /catching up/i);
  assert.equal(shouldSplashLock({ status: "done", needsImport: true }), false);
  assert.equal(shouldSplashLock({ status: "running", needsImport: false }), false);
});
