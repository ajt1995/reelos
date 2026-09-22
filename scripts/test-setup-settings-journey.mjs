#!/usr/bin/env node
import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { launchTestBrowser } from "./test-e2e-helpers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_DIR = join(ROOT, ".reelos-audit", "setup-settings-browser");
const EVIDENCE_PATH = join(EVIDENCE_DIR, "result.json");
const evidenceSources = [
  "src/experience/reelos-world.tsx",
  "src/experience/experience-state.ts",
  "src/experience/profile-adapter.ts",
  "scripts/services/profile-service.mjs",
  "scripts/test-setup-settings-journey.mjs",
];
const fingerprint = () => Object.fromEntries(evidenceSources.map((file) => [
  file,
  createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex"),
]));
const testedSources = fingerprint();

async function availableUrl() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(`http://127.0.0.1:${address.port}`));
    });
  });
}

async function waitForServer(base, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local ReelOS service exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/api/ready`, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200 || response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for isolated ReelOS service at ${base}`);
}

function stopServer(child, stateDir) {
  try {
    if (process.platform === "win32") execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch {}
  child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
  try { rmSync(stateDir, { recursive: true, force: true }); } catch {}
}

async function openSettings(page) {
  await page.getByRole("button", { name: "Change profile", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("button", { name: "Change profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /^For you/ }).waitFor({ state: "visible" });
}

async function chooseAndPersist(page, base, groupLabel, choice, field, expected) {
  const group = page.getByText(groupLabel, { exact: true }).locator("..");
  const button = group.getByRole("button", { name: choice, exact: true });
  const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/profiles") && candidate.request().method() === "POST");
  await button.click();
  assert.equal((await response).status(), 200);
  const body = await page.request.get(`${base}/api/profiles`).then((result) => result.json());
  assert.equal(body.profiles.find((profile) => profile.id === "settings-audit-owner")[field], expected);
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const base = await availableUrl();
  const stateRoot = join(ROOT, ".reelos-test-tmp");
  mkdirSync(stateRoot, { recursive: true });
  const stateDir = mkdtempSync(join(stateRoot, "reelos-setup-settings-"));
  const port = new URL(base).port;
  const child = spawn(process.execPath, ["scripts/with-app-env.mjs", process.execPath, "scripts/reelos-box.mjs"], {
    cwd: ROOT,
    env: { ...process.env, HOST: "127.0.0.1", PORT: port, NODE_ENV: "production", REELOS_STATE: stateDir },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[box] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[box] ${chunk}`));
  let browser;
  const tests = [];
  const runtimeErrors = [];
  try {
    await waitForServer(base, child);
    const launched = await launchTestBrowser({ headless: true });
    browser = launched.browser;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const owner = {
      id: "settings-audit-owner", name: "Settings Audit", experienceVersion: 2, color: "#2563eb",
      atmosphere: true, transparency: true, motion: "subtle", density: "comfortable", exploration: "balanced",
      reactions: {}, dismissedTasteIds: [], lessLikeIds: [], savedIds: [], progress: {}, bookProgress: {},
      bookLocations: {}, bookBookmarks: {}, readingAppearance: { theme: "dark", fontSizeIndex: 1 },
      audioPreference: "original", subtitleLanguage: "English",
    };
    assert.equal((await page.request.post(`${base}/api/profiles`, { data: owner })).status(), 200);
    assert.equal((await page.request.post(`${base}/api/profiles/setup/complete`, { data: { expectedProfileIds: [owner.id] } })).status(), 200);
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.getByRole("button", { name: "Change profile", exact: true }).waitFor({ state: "visible", timeout: 15_000 });

    const shelves = page.locator(".reelos-world-shelf");
    await shelves.first().waitFor({ state: "visible" });
    assert.ok(await shelves.count() >= 1);
    assert.ok(await shelves.first().getByRole("heading").innerText());
    assert.ok(await shelves.first().locator("article, button").count() >= 1);
    tests.push({ name: "Home curated shelves expose real title cards", status: "PASS", detail: `${await shelves.count()} rendered shelf regions` });

    await openSettings(page);
    await page.getByRole("button", { name: /^For you/ }).click();
    await chooseAndPersist(page, base, "Motion", "expressive", "motion", "expressive");
    tests.push({ name: "Motion preference persists after server acknowledgement and reload", status: "PASS", detail: "expressive" });
    await chooseAndPersist(page, base, "Browsing density", "compact", "density", "compact");
    tests.push({ name: "Browsing density persists after server acknowledgement and reload", status: "PASS", detail: "compact" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await openSettings(page);
    await page.getByRole("button", { name: /^For you/ }).click();
    for (const [label, choice] of [["Motion", "expressive"], ["Browsing density", "compact"]]) {
      const selected = page.getByText(label, { exact: true }).locator("..").getByRole("button", { name: choice, exact: true });
      assert.match(await selected.getAttribute("class"), /bg-white text-black/);
    }

    await page.getByRole("button", { name: /^Help & about/ }).click();
    await page.getByText("Feature status", { exact: true }).waitFor({ state: "visible" });
    await page.getByText(/Health, recovery, updates, and feature status/).waitFor({ state: "visible" });
    await page.getByText(/working only after this home confirms its service is available/).waitFor({ state: "visible" });
    await page.getByText(/active, checking, paused, blocked, and later-release abilities/).waitFor({ state: "visible" });
    tests.push({ name: "Help status exposes honest update recovery and capability state", status: "PASS", detail: "no unverified readiness claim" });

    assert.deepEqual(runtimeErrors, []);
    assert.deepEqual(fingerprint(), testedSources, "Source changed during run; repeat on a stable candidate");
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify({
      schema: "reelos-setup-settings-browser/v1", generatedAt: new Date().toISOString(), result: "passed",
      browser: launched.channel, passed: tests.length, failed: 0, skipped: 0, tests, runtimeErrors, sources: testedSources,
    }, null, 2)}\n`);
    console.log(`Setup/settings browser journey: ${tests.length} passed, 0 failed, 0 skipped.`);
  } catch (error) {
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify({
      schema: "reelos-setup-settings-browser/v1", generatedAt: new Date().toISOString(), result: "failed",
      passed: tests.length, failed: 1, skipped: 0, tests, error: error instanceof Error ? error.message : String(error), runtimeErrors, sources: testedSources,
    }, null, 2)}\n`);
    throw error;
  } finally {
    await browser?.close();
    stopServer(child, stateDir);
  }
}

await main();
