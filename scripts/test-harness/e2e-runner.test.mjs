import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { runE2E } from "./e2e-runner.mjs";

test("E2E Runner: programmatic invocation with selectedTiers=[3] executes cleanly", async () => {
  const result = await runE2E({ selectedTiers: [3], json: true });
  assert.equal(result.success, true);
  assert.equal(result.totalFailed, 0);
  assert.equal(result.totalPassed, 18);
  assert.ok(result.totalDurationMs > 0);
  assert.ok(result.tiers[3]);
  assert.equal(result.tiers[3].pass, 18);
  assert.equal(result.tiers[3].fail, 0);
});

test("E2E Runner CLI: --help outputs usage instructions and exits 0", () => {
  const proc = spawnSync(
    process.execPath,
    ["scripts/test-harness/e2e-runner.mjs", "--help"],
    { encoding: "utf8" }
  );

  assert.equal(proc.status, 0);
  assert.match(proc.stdout, /ReelOS Opaque-Box E2E Test Runner/);
  assert.match(proc.stdout, /--tier=1/);
});

test("E2E Runner CLI: --tier=3 executes pairwise suite and exits 0", () => {
  const proc = spawnSync(
    process.execPath,
    ["scripts/test-harness/e2e-runner.mjs", "--tier=3"],
    { encoding: "utf8" }
  );

  assert.equal(proc.status, 0);
  assert.match(proc.stdout, /ALL TIERS PASSED/);
  assert.match(proc.stdout, /T3/);
});

test("E2E Runner CLI: --tier=99 rejects invalid tier with code 1", () => {
  const proc = spawnSync(
    process.execPath,
    ["scripts/test-harness/e2e-runner.mjs", "--tier=99"],
    { encoding: "utf8" }
  );

  assert.equal(proc.status, 1);
  assert.match(proc.stderr, /Unknown tier: 99/);
});

test("E2E Runner CLI: --tier=3 --json outputs valid parseable JSON with success=true", () => {
  const proc = spawnSync(
    process.execPath,
    ["scripts/test-harness/e2e-runner.mjs", "--tier=3", "--json"],
    { encoding: "utf8" }
  );

  assert.equal(proc.status, 0);
  const parsed = JSON.parse(proc.stdout);
  assert.equal(parsed.success, true);
  assert.equal(parsed.totalPassed, 18);
  assert.equal(parsed.totalFailed, 0);
});
