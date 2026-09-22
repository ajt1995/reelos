#!/usr/bin/env node
/**
 * ReelOS Day-1 Deployment Pre-Flight Gate
 *
 * Orchestrates the full verification pipeline before release or appliance dispatch.
 * Every step must exit 0. Any failure halts immediately with actionable diagnostics.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("================================================================================");
console.log("               REELOS DAY-1 COMPREHENSIVE PRE-FLIGHT GATE                       ");
console.log("================================================================================\n");

const steps = [
  { name: "Release requirement evidence", cmd: "npm", args: ["run", "audit:acceptance"] },
  { name: "Step 1: Production Build & Asset Hashing", cmd: "npm", args: ["run", "build"] },
  { name: "Step 2: TypeScript Static Typecheck", cmd: "npm", args: ["run", "typecheck"] },
  { name: "Step 3: ESLint Strict Code Hygiene", cmd: "npm", args: ["run", "lint"] },
  { name: "Step 4: Release Contract Test Matrix", cmd: "npm", args: ["run", "test:release"] },
  { name: "Step 5: Zero-VM Memory Guard (<100MB RAM)", cmd: "node", args: ["scripts/resource-guard.mjs"] },
  { name: "Step 6: Total Human-Interaction E2E Matrix", cmd: "npm", args: ["run", "test:e2e"] },
  { name: "Isolated setup and profile browser journey", cmd: "npm", args: ["run", "test:setup"] },
];

const startTime = Date.now();

for (const step of steps) {
  console.log(`>>> Executing ${step.name}...`);
  const isWin = process.platform === "win32";
  const command = isWin ? "cmd.exe" : step.cmd;
  const fullArgs = isWin ? ["/c", step.cmd, ...step.args] : step.args;

  const result = spawnSync(command, fullArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (result.status !== 0) {
    console.error(`\n[FATAL] ${step.name} failed with exit code ${result.status}`);
    console.error(">>> PRE-FLIGHT REJECTED: Deployment blocked to prevent appliance outage. <<<\n");
    process.exit(result.status || 1);
  }
  console.log(`  [OK] ${step.name} passed cleanly.\n`);
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

console.log("================================================================================");
console.log(`>>> ALL ${steps.length} PRE-FLIGHT GATES PASSED IN ${elapsedSec}s. <<<`);
console.log(">>> Local candidate checks passed; consult platform and household evidence before distribution. <<<");
console.log("================================================================================\n");
process.exit(0);
