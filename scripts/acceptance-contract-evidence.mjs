import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outputPath = join(root, ".reelos-audit", "acceptance-contracts", "result.json");
const scriptTests = [
  "clients/android/android-contracts.test.mjs",
  "scripts/platform-release-status.test.mjs",
  "scripts/reelos-ota-rollback.test.mjs",
  "scripts/reelos-update.test.mjs",
  "scripts/services/android-client-service.test.mjs",
  "scripts/services/family-treatment-service.test.mjs",
  "scripts/services/playback-session-service.test.mjs",
  "scripts/services/profile-service.test.mjs",
];
const sourceTests = [
  "src/lib/family-treatment.test.ts",
  "src/lib/playback-session-client.test.ts",
  "src/lib/playback-sleep-timer.test.ts",
  "src/lib/playback-subtitles.test.ts",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function localImports(path) {
  const content = readFileSync(path, "utf8");
  return [...content.matchAll(/(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/gu)].map((match) => match[1]);
}

function resolveImport(from, specifier) {
  const base = resolve(dirname(from), specifier);
  const candidates = extname(base) ? [base] : [base, `${base}.mjs`, `${base}.js`, `${base}.ts`];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function dependencyClosure(entries) {
  const found = new Set();
  const pending = entries.map((entry) => resolve(root, entry));
  while (pending.length) {
    const path = pending.pop();
    if (!path || found.has(path) || !existsSync(path)) continue;
    found.add(path);
    for (const specifier of localImports(path)) {
      const imported = resolveImport(path, specifier);
      if (imported && imported.startsWith(root)) pending.push(imported);
    }
  }
  return found;
}

function filesBelow(path) {
  if (!existsSync(path)) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(child));
    else files.push(child);
  }
  return files;
}

function runTests(files, stripTypes = false) {
  const args = [
    ...(stripTypes ? ["--experimental-strip-types"] : []),
    "--test",
    "--test-concurrency=1",
    "--test-reporter=tap",
    ...files,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TEMP: join(root, ".reelos-test-tmp"), TMP: join(root, ".reelos-test-tmp") },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const names = [...output.matchAll(/^\s*# Subtest: (.+)$/gmu)].map((match) => match[1].trim());
  const skipped = Number(output.match(/^# skipped (\d+)$/mu)?.[1] ?? 0);
  return { ok: result.status === 0 && skipped === 0, status: result.status, skipped, names, output };
}

export function buildAcceptanceContractEvidence() {
  mkdirSync(join(root, ".reelos-test-tmp"), { recursive: true });
  const runs = [runTests(scriptTests), runTests(sourceTests, true)];
  const testNames = [...new Set(runs.flatMap((run) => run.names))].sort();
  const sourcePaths = dependencyClosure([...scriptTests, ...sourceTests]);
  for (const path of filesBelow(join(root, "clients", "android", "app", "src", "main"))) sourcePaths.add(path);
  for (const path of ["clients/android/app/build.gradle.kts", "clients/android/gradle.properties"]) sourcePaths.add(resolve(root, path));
  const passed = runs.every((run) => run.ok);
  return {
    schema: "reelos-acceptance-contract-evidence/v1",
    generatedAt: new Date().toISOString(),
    result: passed ? "passed" : "failed",
    passed: passed ? testNames.length : 0,
    failed: runs.filter((run) => !run.ok).length,
    skipped: runs.reduce((sum, run) => sum + run.skipped, 0),
    tests: testNames.map((name) => ({ name, status: passed ? "PASS" : "FAIL" })),
    sources: Object.fromEntries([...sourcePaths].sort().map((path) => [relative(root, path).replaceAll("\\", "/"), sha256(path)])),
    failures: runs.filter((run) => !run.ok).map((run) => ({ status: run.status, output: run.output.slice(-4000) })),
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const report = buildAcceptanceContractEvidence();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Acceptance contract evidence: ${report.result} (${report.passed} named tests, ${report.failed} failed runs, ${report.skipped} skipped).`);
  if (report.result !== "passed") process.exitCode = 1;
}
