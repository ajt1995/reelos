import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { launchTestBrowser } from "./test-e2e-helpers.mjs";
import { readAppEnv } from "./with-app-env.mjs";

const root = resolve(import.meta.dirname, "..");
const evidenceDir = join(root, ".reelos-audit", "family-social");
const evidencePath = join(evidenceDir, "result.json");
const sourceFiles = [
  "scripts/test-family-social-journey.mjs",
  "scripts/test-e2e-helpers.mjs",
  "scripts/services/profile-service.mjs",
  "scripts/services/profile-session-service.mjs",
  "scripts/services/companion-service.mjs",
  "scripts/services/child-profile-service.mjs",
  "scripts/services/watchparty-service.mjs",
  "src/experience/reelos-world.tsx",
  "src/experience/experience-state.ts",
  "src/experience/profile-adapter.ts",
  "src/experience/companion-client.ts",
  "src/experience/watch-together-client.ts",
  "src/components/watch-together-world.tsx",
  "src/routes/family.tsx",
  "src/routes/companion.tsx",
  "src/routes/party.tsx",
];

function fingerprint() {
  return Object.fromEntries(sourceFiles.map((file) => [
    file,
    createHash("sha256").update(readFileSync(join(root, file))).digest("hex"),
  ]));
}

function profile(id, name, extra = {}) {
  return {
    id,
    name,
    experienceVersion: 2,
    color: "#9eb6ff",
    reactions: {},
    dismissedTasteIds: [],
    lessLikeIds: [],
    savedIds: [],
    progress: {},
    bookProgress: {},
    motion: "subtle",
    density: "comfortable",
    exploration: "balanced",
    audioPreference: "original",
    subtitleLanguage: "English",
    ...extra,
  };
}

async function freePort() {
  const probe = createServer();
  await new Promise((done) => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  return port;
}

async function startIsolatedService() {
  const stateRoot = join(root, ".test-tmp");
  mkdirSync(stateRoot, { recursive: true });
  const state = mkdtempSync(join(stateRoot, "family-social-"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...readAppEnv(root),
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "production",
    REELOS_STATE: state,
    REELOS_PROFILES_DIR: join(state, "profiles"),
  };
  const server = spawn(process.execPath, ["scripts/with-app-env.mjs", process.execPath, "scripts/reelos-box.mjs"], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const capture = (chunk) => { log = (log + chunk.toString()).slice(-8000); };
  server.stdout.on("data", capture);
  server.stderr.on("data", capture);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      if ((await fetch(`${base}/api/profiles`, { signal: AbortSignal.timeout(1_000) })).ok) {
        await new Promise((done) => setTimeout(done, 350));
        if (server.exitCode === null) return { base, server, state, startupLog: () => log };
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  server.kill();
  throw new Error(`Isolated family service did not start.\n${log}`);
}

function collectRuntimeErrors(page, label, errors) {
  page.on("pageerror", (error) => errors.push({ label, type: "pageerror", message: error.message }));
  page.on("console", (message) => {
    const text = message.text();
    const expectedHarnessNoise = text.includes("ERR_NETWORK_ACCESS_DENIED") ||
      text.includes("status of 401 (Unauthorized)");
    if (message.type() === "error" && !text.includes("favicon") && !expectedHarnessNoise) {
      errors.push({ label, type: "console", message: message.text() });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500 && !response.url().includes("favicon")) {
      errors.push({ label, type: "response", message: `${response.status()} ${response.url()}` });
    }
  });
}

const testedSources = fingerprint();
mkdirSync(evidenceDir, { recursive: true });
const checks = [];
const runtimeErrors = [];
let server;
let browser;

try {
  const service = await startIsolatedService();
  server = service.server;
  const base = service.base;
  const launched = await launchTestBrowser({ headless: true });
  browser = launched.browser;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  collectRuntimeErrors(page, "host", runtimeErrors);

  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
  } catch (error) {
    throw new Error(`${error.message}\nIsolated service output:\n${service.startupLog()}`);
  }
  const owner = profile("family-owner", "Alex Owner", { color: "#f0ba61" });
  const adult = profile("family-adult", "Morgan Adult", { color: "#a9b9ff" });
  const child = profile("family-child", "Riley Child", {
    color: "#58d5bc",
    isKids: true,
    pin: "2468",
    maturity: "big",
    bedtime: "8:30 PM",
    boundaries: { scares: "ask", slapstick: "fine", fantasy: "fine", romance: "ask", grief: "ask", supernatural: "ask", stunts: "ask", language: "never" },
    familyPlayback: { languageSeverity: "moderate", religiousLanguage: false, audioTreatment: "mute", subtitleTreatment: "hide", exceptions: [] },
  });
  assert.equal((await page.request.post(`${base}/api/profiles`, { data: owner })).status(), 200);
  assert.equal((await page.request.post(`${base}/api/profiles`, { data: adult })).status(), 200);
  assert.equal((await page.request.post(`${base}/api/profiles`, { data: child })).status(), 200);
  assert.equal((await page.request.post(`${base}/api/profiles/setup/complete`, { data: { expectedProfileIds: [owner.id, adult.id, child.id] } })).status(), 200);

  await page.goto(`${base}/family`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Family", exact: true }).waitFor();
  await page.getByText("Morgan Adult", { exact: true }).waitFor();
  await page.getByText("Riley Child", { exact: true }).waitFor();
  assert.match(await page.locator(".reelos-family-card").filter({ hasText: "Riley Child" }).innerText(), /PIN required/);
  await page.screenshot({ path: join(evidenceDir, "family-overview.png"), fullPage: true });
  checks.push("service-backed Family overview renders adult and protected child truth");

  await page.getByRole("button", { name: /Morgan Adult/ }).click();
  await page.getByPlaceholder("Their name").fill("Morgan Edited");
  await page.getByRole("button", { name: /Protect this profile with a passcode/ }).click();
  await page.getByRole("textbox", { name: "New 4-digit PIN" }).fill("1357");
  await page.getByRole("textbox", { name: "Confirm 4-digit PIN" }).fill("1357");
  const adultSaved = page.waitForResponse((response) => response.url().endsWith("/api/profiles") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save changes" }).click();
  assert.equal((await adultSaved).status(), 200);
  await page.getByText("Morgan Edited", { exact: true }).waitFor();
  const adultStored = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
  assert.equal(adultStored.profiles.find((item) => item.id === adult.id).pinEnabled, true);
  checks.push("adult edit persists and optional PIN is confirmed by the service");

  await page.locator(".reelos-family-card").filter({ hasText: "Riley Child" }).click();
  await page.getByRole("button", { name: "Teens", exact: true }).click();
  const scares = page.locator("div.rounded-2xl").filter({ hasText: "Scary monsters & jump scares" }).last();
  await scares.getByRole("button", { name: /never/i }).click();
  await page.getByLabel("Bedtime").fill("9:15 PM");
  const childSaved = page.waitForResponse((response) => response.url().endsWith("/api/profiles") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save changes" }).click();
  assert.equal((await childSaved).status(), 200);
  const childCardAfterEdit = page.locator(".reelos-family-card").filter({ hasText: "Riley Child" });
  await childCardAfterEdit.waitFor();
  assert.match(await childCardAfterEdit.innerText(), /teen boundaries/i);
  assert.match(await childCardAfterEdit.innerText(), /PIN required/i);
  checks.push("child boundaries edit persists without weakening required exit PIN");

  const presenceSaved = page.waitForResponse((response) => response.url().includes("/api/companion/presence-filter") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Riley Child is in bed" }).click();
  assert.equal((await presenceSaved).status(), 200);
  await page.getByRole("button", { name: "Riley Child is here" }).waitFor();
  const presence = await page.request.get(`${base}/api/companion/presence-filter?sessionId=living_room_tv`).then((response) => response.json());
  assert.equal(presence.state?.kidsPresent, true);
  assert.deepEqual(presence.state?.childProfileIds, [child.id]);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Kids here" }).waitFor();
  const homeText = await page.locator("main").innerText();
  assert.match(homeText, /Toy Story|Finding Nemo|Jurassic Park|The Lion King/);
  assert.doesNotMatch(homeText, /Pulp Fiction|Fight Club|Alien|John Wick/);
  checks.push("Kids Present round-trips and Home filters out adult-only catalog titles");

  await page.getByRole("button", { name: "Change profile" }).click();
  await page.getByRole("button", { name: /Riley Child/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Change profile" }).click();
  await page.getByRole("button", { name: /Alex Owner/ }).click();
  await page.getByRole("heading", { name: "A grown-up takes it from here." }).waitFor();
  await page.getByPlaceholder("4-digit PIN").fill("0000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText(/PIN.*(?:not accepted|did not match)|incorrect PIN|invalid PIN/i).waitFor();
  await page.getByPlaceholder("4-digit PIN").fill("2468");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Alex Owner", exact: true }).waitFor();
  await page.getByRole("button", { name: "Alex Owner", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Change profile" }).waitFor();
  checks.push("child exit blocks on a wrong PIN and succeeds only after service confirmation");

  await page.goto(`${base}/companion`);
  await page.getByRole("main").getByRole("button", { name: "Home", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Pause" }).isDisabled(), true);
  await page.getByRole("button", { name: "Catch me up" }).click();
  await page.getByRole("heading", { name: "The story so far" }).waitFor();
  await page.getByText("ReelOS will not imply spoiler protection without a verified timeline.").waitFor();
  checks.push("Companion strip, remote, and story states fail closed when playback evidence is absent");

  await page.goto(`${base}/party`);
  await page.getByRole("heading", { name: "Find the overlap." }).waitFor();
  await page.getByRole("button", { name: "Watch from apart" }).click();
  const roomResponse = page.waitForResponse((response) => response.url().endsWith("/api/watchparty/room") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create invite" }).click();
  assert.equal((await roomResponse).status(), 200);
  await page.getByText("Connected", { exact: true }).first().waitFor({ timeout: 10_000 });
  const roomCode = (await page.locator("span.font-mono").filter({ hasText: /^[A-Z2-9]{6}$/ }).first().innerText()).trim();
  assert.match(roomCode, /^[A-Z2-9]{6}$/);

  const storageState = await context.storageState();
  const joinContext = await browser.newContext({ viewport: { width: 1050, height: 800 }, storageState });
  const joinPage = await joinContext.newPage();
  collectRuntimeErrors(joinPage, "join", runtimeErrors);
  await joinPage.goto(`${base}/party?code=${roomCode}`);
  await joinPage.getByRole("button", { name: "Join", exact: true }).click();
  await joinPage.getByText("Connected", { exact: true }).first().waitFor({ timeout: 10_000 });
  await joinPage.getByText(/You/).waitFor();
  await joinContext.setOffline(true);
  await joinPage.waitForTimeout(1_000);
  await joinContext.setOffline(false);
  await joinPage.getByText("Connected", { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByText(/Morgan Edited|Alex Owner/).first().waitFor();
  checks.push("Watch Together host, join, participant confirmation, and stable reconnect render from live service state");
  await joinContext.close();

  assert.deepEqual(runtimeErrors, [], "Browser journey emitted runtime errors");
  assert.deepEqual(fingerprint(), testedSources, "Source changed during the family-social matrix; repeat on a stable candidate");
  const evidence = {
    schema: "reelos-family-social-browser-evidence/v1",
    capturedAt: new Date().toISOString(),
    result: "passed",
    serverMode: "isolated-development-service",
    browser: browser.version(),
    browserChannel: launched.channel,
    checks,
    runtimeErrors,
    sources: testedSources,
    hardwareOnlyGaps: [
      "Native TV/phone remote key and focus behavior",
      "Physical network interruption, sleep/wake, and router roaming",
      "Real display playback synchronization and sustained multi-device timing",
    ],
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`PASS: ${checks.join("; ")}.`);
} catch (error) {
  writeFileSync(evidencePath, `${JSON.stringify({
    schema: "reelos-family-social-browser-evidence/v1",
    capturedAt: new Date().toISOString(),
    result: "failed",
    error: error instanceof Error ? error.message : String(error),
    checks,
    runtimeErrors,
    sources: testedSources,
  }, null, 2)}\n`);
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  server?.kill();
}
