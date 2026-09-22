#!/usr/bin/env node
/** Run each service-contract test file in isolation to expose leaked handles. */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function testFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(path));
    else if (entry.name.endsWith(".test.mjs")) out.push(path);
  }
  return out.sort();
}

const files = testFiles("scripts");
const failures = [];
const started = Date.now();
for (const [index, file] of files.entries()) {
  const run = spawnSync(process.execPath, ["--test", file], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (run.status !== 0 || run.error) {
    const timedOut = run.error?.code === "ETIMEDOUT";
    failures.push({ file, timedOut, status: run.status, signal: run.signal });
    process.stdout.write(`\n${timedOut ? "HANG" : "FAIL"} ${file}\n${run.stdout || ""}${run.stderr || ""}\n`);
  } else {
    process.stdout.write(".");
  }
  if ((index + 1) % 40 === 0) process.stdout.write(` ${index + 1}/${files.length}\n`);
}
process.stdout.write(
  `\nAudited ${files.length} files in ${Math.round((Date.now() - started) / 1000)}s; ${failures.length} failed or leaked.\n`,
);
if (failures.length) process.exitCode = 1;
