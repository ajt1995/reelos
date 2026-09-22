#!/usr/bin/env node

/**
 * ReelOS Opaque-Box E2E Test Runner
 *
 * Executes the 4-tier autonomous test suite:
 * - Tier 1: Feature Coverage (90 tests across 18 features)
 * - Tier 2: Boundary & Corner Cases (90 tests across 18 features)
 * - Tier 3: Pairwise Combinatorial Interactions (18 cross-feature tests)
 * - Tier 4: Real-World Swarm Workload Scenarios (6 full application scenarios)
 *
 * CLI Usage:
 *   node scripts/test-harness/e2e-runner.mjs [--tier=1|2|3|4] [--all] [--bail] [--json]
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TIERS = {
  1: {
    name: "Tier 1: Feature Coverage",
    dir: "scripts/test-harness/tier1-feature",
    glob: "scripts/test-harness/tier1-feature/*.test.mjs",
  },
  2: {
    name: "Tier 2: Boundary & Corner Cases",
    dir: "scripts/test-harness/tier2-boundary",
    glob: "scripts/test-harness/tier2-boundary/*.test.mjs",
  },
  3: {
    name: "Tier 3: Pairwise Combinations",
    dir: "scripts/test-harness/tier3-pairwise",
    glob: "scripts/test-harness/tier3-pairwise/*.test.mjs",
  },
  4: {
    name: "Tier 4: Real-World Swarm Workloads",
    dir: "scripts/test-harness/tier4-workload",
    glob: "scripts/test-harness/tier4-workload/*.test.mjs",
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    selectedTiers: [1, 2, 3, 4],
    bail: false,
    json: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--all") {
      options.selectedTiers = [1, 2, 3, 4];
    } else if (arg.startsWith("--tier=")) {
      const tierNum = parseInt(arg.replace("--tier=", ""), 10);
      if ([1, 2, 3, 4].includes(tierNum)) {
        options.selectedTiers = [tierNum];
      } else {
        console.error(`Unknown tier: ${tierNum}. Allowed values: 1, 2, 3, 4`);
        process.exit(1);
      }
    } else if (arg === "--bail") {
      options.bail = true;
    } else if (arg === "--json") {
      options.json = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
ReelOS Opaque-Box E2E Test Runner

Usage:
  node scripts/test-harness/e2e-runner.mjs [options]

Options:
  --all           Run all 4 tiers (default)
  --tier=1        Run Tier 1 (Feature Coverage)
  --tier=2        Run Tier 2 (Boundary & Corner Cases)
  --tier=3        Run Tier 3 (Pairwise Combinatorial Interactions)
  --tier=4        Run Tier 4 (Real-World Swarm Workload Scenarios)
  --bail          Exit immediately on the first tier failure
  --json          Output results in JSON format
  --help, -h      Show this help message
`);
}

function getTestFilesForTier(tierNum) {
  const tier = TIERS[tierNum];
  if (!fs.existsSync(tier.dir)) return [];
  return fs
    .readdirSync(tier.dir)
    .filter((f) => f.endsWith(".test.mjs"))
    .sort()
    .map((f) => path.join(tier.dir, f).replace(/\\/g, "/"));
}

function runNodeTest(files) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const childEnv = { ...process.env, FORCE_COLOR: "1" };
    delete childEnv.NODE_TEST_CONTEXT;

    const child = spawn(
      process.execPath,
      ["--test", ...files],
      {
        cwd: process.cwd(),
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - startTime;
      // Strip ANSI escape codes
      const cleanStdout = stdout.replace(/\u001b\[[0-9;]*m/g, "");
      const passMatch = cleanStdout.match(/(?:ℹ\s+pass|pass|#\s+pass)\s+(\d+)/);
      const failMatch = cleanStdout.match(/(?:ℹ\s+fail|fail|#\s+fail)\s+(\d+)/);
      const okMatches = cleanStdout.match(/^ok\s+\d+/gm);

      let pass = 0;
      if (passMatch) {
        pass = parseInt(passMatch[1], 10);
      } else if (okMatches) {
        pass = okMatches.length;
      } else if (code === 0) {
        pass = files.length;
      }

      const fail = failMatch ? parseInt(failMatch[1], 10) : (code !== 0 ? 1 : 0);

      resolve({
        code,
        durationMs,
        pass,
        fail,
        stdout,
        stderr,
      });
    });
  });
}

export async function runE2E(options = {}) {
  const opts = {
    selectedTiers: options.selectedTiers || [1, 2, 3, 4],
    bail: options.bail || false,
    json: options.json || false,
  };

  const results = {
    startTime: new Date().toISOString(),
    tiers: {},
    totalPassed: 0,
    totalFailed: 0,
    totalDurationMs: 0,
    success: true,
  };

  if (!opts.json) {
    console.log("\n=======================================================");
    console.log("       ReelOS Autonomous Opaque-Box E2E Test Suite     ");
    console.log("=======================================================\n");
  }

  for (const tierNum of opts.selectedTiers) {
    const tierMeta = TIERS[tierNum];
    const files = getTestFilesForTier(tierNum);

    if (!opts.json) {
      console.log(`▶ Running ${tierMeta.name} (${files.length} test files)...`);
    }

    if (files.length === 0) {
      if (!opts.json) {
        console.log(`  ⚠️ No test files found in ${tierMeta.dir}`);
      }
      results.tiers[tierNum] = {
        name: tierMeta.name,
        files: 0,
        pass: 0,
        fail: 0,
        durationMs: 0,
        code: 0,
      };
      continue;
    }

    const testRun = await runNodeTest(files);
    results.tiers[tierNum] = {
      name: tierMeta.name,
      files: files.length,
      pass: testRun.pass,
      fail: testRun.fail,
      durationMs: testRun.durationMs,
      code: testRun.code,
    };

    results.totalPassed += testRun.pass;
    results.totalFailed += testRun.fail;
    results.totalDurationMs += testRun.durationMs;

    if (testRun.code !== 0) {
      results.success = false;
      if (!opts.json) {
        console.error(`  ✖ ${tierMeta.name} FAILED (${testRun.fail} failed, ${testRun.pass} passed in ${testRun.durationMs}ms)`);
        const failLines = testRun.stdout.split("\n").filter((l) => l.includes("✖") || l.includes("AssertionError") || l.includes("Error:")).slice(0, 10);
        if (failLines.length > 0) console.error(failLines.map((l) => `    ${l.trim()}`).join("\n"));
        if (testRun.stderr.trim()) console.error(`  ${testRun.stderr.trim()}`);
      }
      if (opts.bail) break;
    } else {
      if (!opts.json) {
        console.log(`  ✔ ${tierMeta.name} PASSED (${testRun.pass} tests in ${(testRun.durationMs / 1000).toFixed(2)}s)`);
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("\n-------------------------------------------------------");
    console.log("                    TEST SUMMARY                       ");
    console.log("-------------------------------------------------------");
    console.log(`| Tier | Description                     | Pass | Fail | Time(s) |`);
    console.log(`|------|---------------------------------|------|------|---------|`);
    for (const [tierNum, t] of Object.entries(results.tiers)) {
      const numStr = `T${tierNum}`.padEnd(4);
      const desc = t.name.padEnd(31);
      const p = String(t.pass).padStart(4);
      const f = String(t.fail).padStart(4);
      const time = (t.durationMs / 1000).toFixed(2).padStart(7);
      console.log(`| ${numStr} | ${desc} | ${p} | ${f} | ${time} |`);
    }
    console.log("-------------------------------------------------------");
    console.log(`Total: ${results.totalPassed} Passed, ${results.totalFailed} Failed (${(results.totalDurationMs / 1000).toFixed(2)}s total)`);
    if (results.success) {
      console.log("Result: ALL TIERS PASSED [OK]\n");
    } else {
      console.log("Result: TEST SUITE FAILED [FAIL]\n");
    }
  }

  return results;
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"))) {
  const options = parseArgs();
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  runE2E(options).then((res) => {
    process.exit(res.success ? 0 : 1);
  }).catch((err) => {
    console.error("Runner encountered fatal error:", err);
    process.exit(1);
  });
}
