import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("release test runner resolves only classified release files", () => {
  const inventory = JSON.parse(execFileSync(process.execPath, [resolve(root, "scripts", "test-inventory.mjs"), "--json"], { cwd: root, encoding: "utf8" }));
  const release = inventory.tests.filter((item) => item.disposition === "release");
  const runnerTests = new Set([
    "scripts/context-brief.test.mjs",
    "scripts/coverage-lock.test.mjs",
    "scripts/feature-acceptance.test.mjs",
    "scripts/install-local-intelligence-pack.test.mjs",
    "scripts/neural-architecture.test.mjs",
    "scripts/packaging-boundaries.test.mjs",
    "scripts/reelos-backup.test.mjs",
    "scripts/reelos-ota-rollback.test.mjs",
    "scripts/run-test-group.test.mjs",
    "scripts/reelos-stream-routing.test.mjs",
    "scripts/reelos-curator-routing.test.mjs",
    "scripts/reelos-retention-routing.test.mjs",
    "scripts/reelos-preparation-routing.test.mjs",
    "scripts/reelos-update.test.mjs",
    "scripts/release-trust.test.mjs",
    "scripts/curator-status.test.mjs",
    "scripts/discover-browse-pagination.test.mjs",
    "scripts/storage-lru-watchdog.test.mjs",
    "scripts/setup-settings-evidence.test.mjs",
  ]);
  assert.ok(release.length > 0);
  assert.ok(release.some((item) => item.file === "scripts/reelos-stream-routing.test.mjs"), "Playback routing remains a release contract");
  assert.ok(release.some((item) => item.file === "scripts/reelos-curator-routing.test.mjs"), "Private taste routing remains a release contract");
  assert.ok(release.some((item) => item.file === "scripts/reelos-preparation-routing.test.mjs"), "Verified preparation routing remains a release contract");
  assert.ok(release.some((item) => item.file === "scripts/storage-lru-watchdog.test.mjs"), "Original-media preservation remains a release contract");
  assert.ok(release.every((item) => runnerTests.has(item.file) || /^(scripts\/services\/|src\/lib\/)/.test(item.file)));
});
