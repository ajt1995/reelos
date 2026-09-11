import assert from "node:assert/strict";
import test from "node:test";
import { catchupLocksHome, normalizeLibraryCatchup } from "./library-catchup";

test("catchupLocksHome only while running and dumps need import", () => {
  assert.equal(catchupLocksHome({ status: "running", needsImport: true, splashLock: true, message: "", folder: 0, total: 0, skipped: 0, timeouts: 0 }), true);
  assert.equal(catchupLocksHome({ status: "running", needsImport: false, splashLock: true, message: "Library catching up — 14 skipped", folder: 1, total: 1, skipped: 14, timeouts: 0 }), false);
  for (const status of ["done", "idle", "stopped", "backoff"] as const) {
    assert.equal(
      catchupLocksHome({ status, needsImport: true, splashLock: true, message: "Library catching up", folder: 0, total: 0, skipped: 14, timeouts: 0 }),
      false,
      status,
    );
  }
});

test("normalizeLibraryCatchup does not advertise catching up for a skip-only done pass", () => {
  const row = normalizeLibraryCatchup({
    status: "done",
    splashLock: true,
    needsImport: false,
    skipped: 14,
    timeouts: 0,
    message: "Library catching up — folder 1 of 1, 14 skipped",
  });
  assert.equal(row.splashLock, false);
  assert.match(row.message, /catch-up done/);
  assert.doesNotMatch(row.message, /catching up/i);
});
