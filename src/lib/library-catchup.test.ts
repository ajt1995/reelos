import assert from "node:assert/strict";
import { test } from "node:test";
import { catchupLocksHome, catchupShowsBanner, normalizeLibraryCatchup } from "./library-catchup.ts";

test("catch-up banner shows on running import and backoff; splash-lock stays import-only", () => {
  const running = { status: "running", needsImport: true, message: "Library catching up" };
  assert.equal(catchupLocksHome(running), true);
  assert.equal(catchupShowsBanner(running), true);
  assert.equal(catchupLocksHome({ status: "backoff", needsImport: false }), false);
  assert.equal(catchupShowsBanner({ status: "backoff" }), true);
  assert.equal(catchupShowsBanner({ status: "done", needsImport: true }), false);
  assert.equal(catchupShowsBanner({ status: "idle" }), false);
  const norm = normalizeLibraryCatchup({ status: "backoff", message: "TorBox filesystem busy" });
  assert.equal(norm.status, "backoff");
  assert.equal(catchupShowsBanner(norm), true);
  assert.equal(norm.splashLock, false);
});
