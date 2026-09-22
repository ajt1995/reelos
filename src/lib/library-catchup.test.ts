import assert from "node:assert/strict";
import { test } from "node:test";
import { catchupLocksHome, catchupShowsBanner, normalizeLibraryCatchup } from "./library-catchup.ts";

test("catch-up banner shows on running import and backoff; splash-lock stays import-only", () => {
  const running = { status: "running" as const, needsImport: true, message: "Library catching up" };
  assert.equal(catchupLocksHome(running), true);
  assert.equal(catchupShowsBanner(running), true);
  assert.equal(catchupLocksHome({ status: "backoff" as const, needsImport: false }), false);
  assert.equal(catchupShowsBanner({ status: "backoff" as const }), true);
  assert.equal(catchupShowsBanner({ status: "done" as const, needsImport: true }), false);
  assert.equal(catchupShowsBanner({ status: "idle" as const }), false);
  const norm = normalizeLibraryCatchup({ status: "backoff" as const, message: "TorBox filesystem busy" });
  assert.equal(norm.status, "backoff");
  assert.equal(catchupShowsBanner(norm), true);
  assert.equal(norm.splashLock, false);
});
