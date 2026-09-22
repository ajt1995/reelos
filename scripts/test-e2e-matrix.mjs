#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { assertNoHorizontalOverflow, createTestPage, launchTestBrowser } from "./test-e2e-helpers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
async function availableAuditUrl() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(`http://127.0.0.1:${port}`));
    });
  });
}

// An isolated free port prevents a stale preview or real household session
// from being mistaken for the matrix fixture. Explicit targets still work.
const BASE_URL = process.env.REELOS_HOST || process.argv[2] || await availableAuditUrl();
const EVIDENCE_DIR = join(ROOT, ".reelos-audit", "e2e-matrix");
const evidenceSources = [
  "src/experience/reelos-world.tsx",
  "src/experience/experience-state.ts",
  "src/experience/experience-catalog.ts",
  "src/experience/taste-field.ts",
  "src/experience/search-intent.ts",
  "scripts/test-e2e-matrix.mjs",
];
const sourceFingerprints = () => Object.fromEntries(evidenceSources.map((file) => [
  file,
  createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex"),
]));
const testedSources = sourceFingerprints();
const results = { baseUrl: BASE_URL, generatedAt: "", browser: "", passed: 0, failed: 0, skipped: 0, tests: [], sources: testedSources };
let managedServerActive = false;
let managedStateDir = "";

function record(name, status, detail = "") {
  results.tests.push({ name, status, detail });
  results[status === "PASS" ? "passed" : status === "FAIL" ? "failed" : "skipped"] += 1;
  (status === "FAIL" ? console.error : console.log)(`  [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}
async function check(name, work) {
  try { const detail = await work(); record(name, "PASS", typeof detail === "string" ? detail : ""); }
  catch (error) { record(name, "FAIL", error instanceof Error ? error.message : String(error)); }
}
function invariant(condition, message) { if (!condition) throw new Error(message); }

async function isServerUp(url) {
  try {
    const response = await fetch(`${url}/api/ready`, { signal: AbortSignal.timeout(1500) });
    return response.status === 200 || response.status === 401;
  } catch {
    try { return (await fetch(`${url}/`, { signal: AbortSignal.timeout(1500) })).status === 200; }
    catch { return false; }
  }
}
async function startEphemeralServer(url) {
  const port = new URL(url).port || "8080";
  console.log(`[test:e2e] No server at ${url}; starting a local ReelOS service on ${port}.`);
  const testRoot = join(ROOT, ".reelos-test-tmp");
  mkdirSync(testRoot, { recursive: true });
  managedStateDir = mkdtempSync(join(testRoot, "reelos-e2e-state-"));
  managedServerActive = true;
  const child = spawn(process.execPath, ["scripts/with-app-env.mjs", process.execPath, "scripts/reelos-box.mjs"], {
    cwd: ROOT, env: { ...process.env, HOST: "127.0.0.1", PORT: port, NODE_ENV: "production", REELOS_STATE: managedStateDir },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[box] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[box] ${chunk}`));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local ReelOS service exited with ${child.exitCode}`);
    if (await isServerUp(url)) return child;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  stopEphemeralServer(child);
  throw new Error(`Timed out waiting for ReelOS at ${url}`);
}
function stopEphemeralServer(child) {
  if (!child) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch { /* The service may already have stopped. */ }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.destroy();
  child.unref();
  if (managedStateDir) {
    try { rmSync(managedStateDir, { recursive: true, force: true }); } catch {}
    managedStateDir = "";
  }
  managedServerActive = false;
}

async function bootstrapAuditHome(page) {
  const owner = {
    id: "audit-owner", name: "Austin", experienceVersion: 2, color: "#4f7cff",
    atmosphere: true, transparency: true, motion: "subtle", density: "comfortable",
    exploration: "balanced", reactions: {}, dismissedTasteIds: [], lessLikeIds: [],
    savedIds: [], progress: {}, bookProgress: {}, bookLocations: {}, bookBookmarks: {},
    readingAppearance: { theme: "dark", fontSizeIndex: 1 }, audioPreference: "original",
    subtitleLanguage: "English",
  };
  const created = await page.request.post(`${BASE_URL}/api/profiles`, { data: owner });
  invariant(created.ok(), `isolated audit profile bootstrap failed (${created.status()})`);
  const completed = await page.request.post(`${BASE_URL}/api/profiles/setup/complete`, { data: { expectedProfileIds: [owner.id] } });
  invariant(completed.ok(), `isolated audit setup completion failed (${completed.status()})`);
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
}
async function visible(page, locator, timeout = 8_000) {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator.first();
}
async function assertNoOverflow(page, label) {
  const value = await assertNoHorizontalOverflow(page);
  invariant(!value.hasOverflow, `${label} is ${Math.max(value.docScrollWidth, value.bodyScrollWidth) - Math.min(value.docClientWidth, value.bodyClientWidth)}px wider than its viewport`);
  return `${value.docClientWidth}px viewport`;
}
async function assertMinTarget(locator, minimum = 48) {
  const box = await locator.boundingBox();
  invariant(box, "control has no rendered bounds");
  invariant(box.width >= minimum && box.height >= minimum, `${Math.round(box.width)}×${Math.round(box.height)}px target is below ${minimum}px`);
  return `${Math.round(box.width)}×${Math.round(box.height)}px`;
}
async function goToWorld(page, name) {
  const nav = page.getByRole("navigation", { name: /Primary/ }).filter({ visible: true }).first();
  await visible(page, nav, 10_000);
  const destination = nav.getByRole("button", { name, exact: true });
  await visible(page, destination);
  await destination.click();
  await page.waitForTimeout(180);
}
async function openCurrentProfile(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator("body").waitFor({ state: "visible" });
  const setupHeading = page.getByRole("heading", { name: "Hi, what should we call you?", exact: true });
  const chooserHeading = page.getByRole("heading", { name: "Who's watching?", exact: true });
  const authorizedHome = page.getByRole("button", { name: "Change profile", exact: true });
  await Promise.race([
    setupHeading.waitFor({ state: "visible", timeout: 15_000 }),
    chooserHeading.waitFor({ state: "visible", timeout: 15_000 }),
    authorizedHome.waitFor({ state: "visible", timeout: 15_000 }),
  ]).catch(() => undefined);
  if (await setupHeading.isVisible().catch(() => false)) {
    if (!managedServerActive) throw new Error("this home has not completed onboarding; run test:setup first, then audit the consumer UI");
    await bootstrapAuditHome(page);
  }
  const chooser = page.getByRole("heading", { name: "Who's watching?", exact: true });
  if (await chooser.isVisible().catch(() => false)) {
    const connect = page.getByRole("button", { name: "Connect this device", exact: true });
    if (await connect.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 }),
        connect.click(),
      ]);
      await chooser.waitFor({ state: "visible" });
      await connect.waitFor({ state: "hidden", timeout: 5_000 });
    }
    const profile = page.locator("form button[aria-pressed]").first();
    await visible(page, profile); await profile.click();
    if (await page.getByLabel("Your PIN", { exact: true }).isVisible().catch(() => false)) {
      throw new Error("the available profile requires a PIN; open an adult profile before running this audit");
    }
    const proceed = page.getByRole("button", { name: "Continue", exact: true });
    invariant(await proceed.isEnabled(), "profile Continue action is unavailable");
    await proceed.click();
  }
  const homeProfile = page.getByRole("button", { name: "Change profile", exact: true });
  const entryAlert = page.getByRole("alert").first();
  try {
    await Promise.race([
      homeProfile.waitFor({ state: "visible", timeout: 15_000 }),
      entryAlert.waitFor({ state: "visible", timeout: 15_000 }),
    ]);
  } catch {
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 500);
    throw new Error(`profile entry did not settle: ${body || "empty page"}`);
  }
  if (await entryAlert.isVisible().catch(() => false)) {
    throw new Error(`profile entry failed: ${(await entryAlert.innerText()).trim()}`);
  }
  await visible(page, homeProfile, 2_000);
  await goToWorld(page, "Home");
}
async function screenshot(page, name) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

async function auditProfileBoundary(browser) {
  console.log("\n--- Profile and household boundary ---");
  const context = await browser.newContext({ viewport: { width: 430, height: 860 } });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await check("Fresh browser shows a real household boundary", async () => {
      const chooser = page.getByRole("heading", { name: "Who's watching?", exact: true });
      const setup = page.getByRole("heading", { name: "Hi, what should we call you?", exact: true });
      const home = page.getByRole("button", { name: "Change profile", exact: true });
      await Promise.race([chooser.waitFor({ state: "visible", timeout: 20_000 }), setup.waitFor({ state: "visible", timeout: 20_000 }), home.waitFor({ state: "visible", timeout: 20_000 })]);
      invariant(await chooser.isVisible().catch(() => false) || await setup.isVisible().catch(() => false) || await home.isVisible().catch(() => false), "no profile, setup, or authorized-home state appeared");
      return await chooser.isVisible().catch(() => false) ? "profile chooser" : await setup.isVisible().catch(() => false) ? "first-run setup" : "authorized household session";
    });
    await check("Profile boundary has touch-sized actions", async () => assertMinTarget(await visible(page, page.locator("button:visible").first())));
  } finally { await context.close(); }
}

async function auditDesktop(page, errors) {
  console.log("\n--- Desktop personal world ---");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCurrentProfile(page);
  await check("Home has no horizontal overflow", () => assertNoOverflow(page, "Home"));
  await check("Home leads with artwork and a personal hero", async () => {
    const main = page.locator("main").first();
    const heading = await visible(page, main.getByRole("heading", { level: 1 }).first());
    invariant(await main.locator("section").first().locator("img, [aria-hidden='true']").count() > 0, "hero has neither artwork nor an artwork fallback");
    return (await heading.innerText()).trim();
  });
  await check("Natural-language search sits directly beneath the hero", async () => {
    const search = await visible(page, page.getByRole("button", { name: /Find anything\./ }).first());
    const [searchBox, heroBox] = await Promise.all([search.boundingBox(), page.locator("main > section").first().boundingBox()]);
    invariant(searchBox && heroBox, "hero/search bounds are unavailable");
    invariant(searchBox.y > heroBox.y + heroBox.height * 0.55, "search is not positioned after the hero experience");
    return "title, person, feeling, exclusion, or remembered scene";
  });
  await check("Home search parses a precise natural-language request", async () => {
    await page.getByRole("button", { name: /Find anything\./ }).first().click();
    const input = await visible(page, page.getByPlaceholder("A title, person, feeling, exclusion, or half-remembered scene"));
    await input.fill("a quiet movie under 100 minutes without horror");
    await visible(page, page.getByText("Under 100 minutes", { exact: true }));
    await visible(page, page.getByText("Without horror", { exact: true }));
    await input.fill("Arrival");
    await visible(page, page.getByText(/\d+ paths from that clue/));
    await page.getByRole("button", { name: "Close search", exact: true }).click();
    return "intent chips and title routes rendered";
  });
  await check("Poster cards expose reachable Like and Less-like controls", async () => {
    const like = await visible(page, page.locator('button[aria-label^="Like "]').first());
    const less = await visible(page, page.locator('button[aria-label^="Less like "]').first());
    return `${await assertMinTarget(like)}, ${await assertMinTarget(less)}`;
  });
  await check("No-idea helper makes a decision and asks for feedback", async () => {
    const heading = page.getByRole("heading", { name: "No idea what to watch?", exact: true });
    await heading.scrollIntoViewIfNeeded(); await visible(page, heading);
    await page.getByRole("button", { name: "Decide for me", exact: true }).click();
    const result = page.getByText("ReelOS would stop here", { exact: true });
    const unavailable = page.getByText("Nothing ready yet", { exact: true });
    await Promise.race([result.waitFor({ state: "visible", timeout: 5_000 }), unavailable.waitFor({ state: "visible", timeout: 5_000 })]);
    if (await result.isVisible().catch(() => false)) {
      await visible(page, page.getByRole("button", { name: "Like this", exact: true }));
      await visible(page, page.getByRole("button", { name: "Less like this", exact: true }));
      return "playable recommendation with reversible feedback";
    }
    await visible(page, page.getByRole("button", { name: "Explore anyway", exact: true }));
    return "honest no-playable-source state";
  });
  await screenshot(page, "desktop-home");

  await goToWorld(page, "Discover");
  await check("Discover has no horizontal overflow", () => assertNoOverflow(page, "Discover"));
  await check("Discover is art-led, not an introductory control stack", async () => {
    await visible(page, page.getByRole("button", { name: /Open this door/ }));
    invariant(await page.locator("main > section").first().locator("img").count() > 0, "featured invitation has no artwork");
    for (const path of ["Quietly strange", "Warm, never sugary", "Make the home feel bigger"]) await visible(page, page.getByRole("button", { name: new RegExp(path) }));
    invariant(await page.locator(".reelos-world-shelf").count() >= 3, "Discover has fewer than three curated shelves");
    return "featured invitation, three illustrated paths, and curated shelves";
  });
  await check("Discover keeps Search and Refine compact and functional", async () => {
    await visible(page, page.getByRole("button", { name: /Search a title, person, mood, or memory/ }));
    const refine = await visible(page, page.getByRole("button", { name: /^Refine/ }));
    await refine.click();
    const dialog = await visible(page, page.getByRole("dialog", { name: "Shape tonight, briefly." }));
    await dialog.getByRole("button", { name: "adventurous", exact: true }).click();
    await dialog.getByRole("button", { name: "Show me", exact: true }).click();
    await visible(page, page.getByText("Tonight:", { exact: true }));
    return "session-only refinement applied";
  });
  await check("Discover person invitations open an actual destination", async () => {
    const person = page.getByRole("button", { name: "Florence Pugh", exact: true });
    await person.scrollIntoViewIfNeeded(); await person.click();
    const dialog = await visible(page, page.getByRole("dialog", { name: "Florence Pugh" }));
    await dialog.getByRole("button", { name: "Close Florence Pugh", exact: true }).click();
    return "person sheet opened and returned";
  });
  await screenshot(page, "desktop-discover");

  const profileButton = await visible(page, page.locator('button[aria-label="Change profile"]:visible'));
  await profileButton.click();
  await check("Profile switcher keeps personal and Family destinations separate", async () => {
    for (const name of ["Your profile", "Family", "Settings"]) await visible(page, page.getByRole("button", { name, exact: true }));
    return "direct profile switching plus distinct personal/family actions";
  });
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await check("Personal profile destination keeps taste separate from Family administration", async () => {
    await visible(page, page.getByRole("heading", { name: "Austin", exact: true }));
    await visible(page, page.getByRole("button", { name: "Tune your taste", exact: true }));
    invariant(await page.getByRole("button", { name: "Add someone", exact: true }).count() === 0, "Family administration leaked into the personal destination");
    return "private artwork, collections, and taste entry without Family controls";
  });
  await page.getByRole("button", { name: "Tune your taste", exact: true }).click();
  await check("Endless taste field replenishes and updates the Cozy collection", async () => {
    await visible(page, page.getByRole("heading", { name: "Fill it with what you love.", exact: true }));
    const field = await visible(page, page.getByRole("group", { name: "Your endless taste picker", exact: true }));
    const initialCount = await field.locator("button[data-taste-item]").count();
    invariant(initialCount >= 8, `taste field exposed only ${initialCount} bubbles`);
    invariant(await page.getByRole("button", { name: /^(More|Next batch)$/ }).count() === 0, "taste field has a pagination action");
    const titleBubble = field.locator('button[data-taste-item="title"]').first();
    const titleLabel = await titleBubble.getAttribute("aria-label");
    invariant(Boolean(titleLabel), "title bubble has no accessible identity");
    const titleName = titleLabel.replace(/^(Like|Love) /, "").replace(/, currently .+$/, "");
    await titleBubble.click();
    await visible(page, page.getByRole("button", { name: "Cozy", exact: true }));
    await page.getByRole("button", { name: "Cozy", exact: true }).click();
    await page.waitForTimeout(1_100);
    invariant(await field.locator("button[data-taste-item]").count() === initialCount, "departed taste bubble was not replenished");
    await page.getByRole("button", { name: "That feels like me", exact: true }).click();
    await visible(page, page.getByRole("heading", { name: "Comfort.", exact: true }));
    await visible(page, page.getByText(titleName, { exact: true }));
    return `${initialCount} self-replenishing bubbles; ${titleName} added to Comfort`;
  });
  await page.locator('button[aria-label="Change profile"]:visible').click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await check("Settings uses the approved concise category hierarchy", async () => {
    for (const category of ["For you", "Family", "Playback & companion", "Books", "Library & storage", "Sources & devices", "Help & about", "Quietly getting better"]) {
      await visible(page, page.getByRole("button", { name: new RegExp(`^${category}`) }));
    }
    invariant(!/Radarr|Sonarr|Prowlarr|Seerr|Decypharr/i.test(await page.locator("main").innerText()), "ARR-era pipeline jargon is visible in consumer Settings");
    return "eight consumer categories; later-release ambiance is status-only; no ARR-era controls";
  });
  await check("Settings explains source access honestly", async () => {
    await page.getByRole("button", { name: /^Sources & devices/ }).click();
    await visible(page, page.getByText(/public-domain and personal media only|Connected and available to this home|Enabled, but a key still needs live validation/).first());
    await visible(page, page.getByText("Public catalogs & owner source connections", { exact: true }));
    return "provider, public catalog, and owner-source boundaries are distinct";
  });
  await check("Settings appearance controls remain personal and touch-sized", async () => {
    await page.getByRole("button", { name: /^For you/ }).click();
    const color = await visible(page, page.locator('button[aria-label^="Use #"]').first());
    await visible(page, page.getByText("Living color", { exact: true }));
    await visible(page, page.getByText("Translucent surfaces", { exact: true }));
    return assertMinTarget(color);
  });
  await screenshot(page, "desktop-settings");
  await check("No browser runtime exceptions occurred in the personal world", async () => {
    invariant(errors.pageErrors.length === 0, errors.pageErrors.join(" | "));
    return "0 page exceptions";
  });
}

async function auditCapabilities(page) {
  console.log("\n--- Advanced capabilities and honest failure states ---");
  let delayed = true;
  await page.route("**/api/capabilities", async (route) => {
    if (!delayed) return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 450));
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Capability service intentionally unavailable for this audit." }) });
  });
  await page.goto(`${BASE_URL}/settings/advanced`, { waitUntil: "commit", timeout: 20_000 });
  await check("Capabilities show a real loading state", async () => {
    await visible(page, page.getByLabel("Loading capabilities"), 2_000);
    return "skeleton is labelled and non-deceptive";
  });
  await check("Capabilities fail honestly with a retry", async () => {
    const alert = await visible(page, page.getByRole("alert"), 5_000);
    invariant((await alert.innerText()).includes("intentionally unavailable"), "service error was hidden or rewritten as success");
    await visible(page, alert.getByRole("button", { name: "Try again", exact: true }));
    return "visible service error and recovery action";
  });
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  if (await retry.isVisible().catch(() => false)) {
    delayed = false;
    await retry.click();
    await page.unroute("**/api/capabilities");
  } else {
    delayed = false;
    await page.unroute("**/api/capabilities");
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await check("Advanced Capabilities exposes the current lifecycle", async () => {
    await visible(page, page.getByRole("heading", { name: "Quietly getting better", exact: true }));
    const section = await visible(page, page.getByRole("region", { name: "ReelOS capabilities" }));
    await page.waitForFunction(() => document.querySelector('[aria-label="ReelOS capabilities"]')?.getAttribute("aria-busy") === "false");
    const rows = section.locator("article");
    invariant(await rows.count() >= 1, "no installed capability lifecycle rows were returned");
    const first = rows.first().getByRole("button").first(); await first.click();
    invariant(await first.getAttribute("aria-expanded") === "true", "capability details did not expand");
    invariant(/Installed|Validating|Learning|Ready|Active|Paused|Unsupported|Failed/i.test(await section.innerText()), "no honest lifecycle state is shown");
    return `${await rows.count()} capability rows`;
  });
  await check("Capabilities prioritize playback over background learning", async () => {
    await visible(page, page.getByText(/Watching always comes first/));
    return "resource-yield promise is visible";
  });
  await check("Advanced Capabilities has no horizontal overflow", () => assertNoOverflow(page, "Advanced Capabilities"));
  await screenshot(page, "desktop-capabilities");
}

async function auditPhone(page) {
  console.log("\n--- Phone touch experience (390×844) ---");
  await page.setViewportSize({ width: 390, height: 844 });
  await openCurrentProfile(page);
  await check("Phone Home has no horizontal overflow", () => assertNoOverflow(page, "Phone Home"));
  await check("Phone uses the four-action touch navigation", async () => {
    const nav = await visible(page, page.getByRole("navigation", { name: "Primary navigation" }));
    const buttons = nav.getByRole("button");
    invariant(await buttons.count() === 4, `expected 4 actions, found ${await buttons.count()}`);
    for (let index = 0; index < 4; index += 1) await assertMinTarget(buttons.nth(index));
    return "Home, Discover, Library, Books";
  });
  await check("Phone search and profile controls are touch-sized", async () => {
    const search = page.getByRole("button", { name: "Find anything", exact: true });
    const profile = page.getByRole("button", { name: "Change profile", exact: true });
    return (await Promise.all([assertMinTarget(search), assertMinTarget(profile)])).join(", ");
  });
  await goToWorld(page, "Discover");
  await check("Phone Discover remains complete without crowding", async () => {
    await visible(page, page.getByRole("button", { name: /^Refine/ }));
    await visible(page, page.getByRole("button", { name: /Quietly strange/ }));
    invariant(await page.locator(".reelos-world-shelf").count() >= 3, "curated shelves disappeared on phone");
    return assertNoOverflow(page, "Phone Discover");
  });
  await screenshot(page, "phone-discover");
}

async function auditTv(page) {
  console.log("\n--- TV/remote experience (1920×1080) ---");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openCurrentProfile(page);
  await check("TV Home has no horizontal overflow", () => assertNoOverflow(page, "TV Home"));
  await check("TV exposes stationary top navigation", async () => {
    const nav = await visible(page, page.getByRole("navigation", { name: "Primary" }));
    for (const label of ["Home", "Discover", "Library", "Books"]) await visible(page, nav.getByRole("button", { name: label, exact: true }));
    return "remote-scale primary destinations";
  });
  await check("TV keyboard/remote focus reaches a visible action", async () => {
    await page.locator("body").click({ position: { x: 2, y: 2 } });
    let focused = null;
    for (let index = 0; index < 16; index += 1) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return { text: element.getAttribute("aria-label") || element.innerText, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0, focusVisible: element.matches(":focus-visible") };
      });
      if (focused?.visible && focused.focusVisible) break;
    }
    invariant(focused?.visible && focused.focusVisible, "remote focus never became visibly addressable");
    invariant(focused.width >= 44 && focused.height >= 44, `focused action is only ${Math.round(focused.width)}×${Math.round(focused.height)}px`);
    return `${focused.text?.trim().slice(0, 50)} (${Math.round(focused.width)}×${Math.round(focused.height)}px)`;
  });
  await check("TV can enter Discover with the keyboard", async () => {
    const discover = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Discover", exact: true });
    await discover.focus(); await page.keyboard.press("Enter");
    await visible(page, page.getByRole("button", { name: /Open this door/ }));
    return "Enter activated focused destination";
  });
  await screenshot(page, "tv-discover");
}

async function runMatrix() {
  console.log("================================================================================");
  console.log("              REELOS CURRENT CONSUMER EXPERIENCE E2E MATRIX");
  console.log(`              Target: ${BASE_URL}`);
  console.log("================================================================================");
  let ephemeralChild = null;
  let browser = null;
  if (!(await isServerUp(BASE_URL))) {
    const host = new URL(BASE_URL).hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Remote target ${BASE_URL} is unavailable`);
    ephemeralChild = await startEphemeralServer(BASE_URL);
  }
  try {
    const launched = await launchTestBrowser({ headless: true });
    browser = launched.browser; results.browser = launched.channel;
    console.log(`Browser: ${launched.channel}`);
    await auditProfileBoundary(browser);
    const { page, errors } = await createTestPage(browser, { width: 1440, height: 900 });
    try {
      await auditDesktop(page, errors);
      await auditCapabilities(page);
      await auditPhone(page);
      await auditTv(page);
    } finally { await page.close(); }
  } finally {
    await browser?.close().catch(() => undefined);
    stopEphemeralServer(ephemeralChild);
  }
  results.generatedAt = new Date().toISOString();
  invariant(JSON.stringify(sourceFingerprints()) === JSON.stringify(testedSources), "consumer UI or matrix source changed during the run; repeat on a stable candidate");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, "result.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log("\n================================================================================\n                              SUMMARY\n================================================================================");
  console.log(`  Passed:  ${results.passed}\n  Failed:  ${results.failed}\n  Skipped: ${results.skipped}`);
  console.log(`  Evidence: ${join(EVIDENCE_DIR, "result.json")}`);
  if (results.failed) { console.error("\nThe matrix found real consumer-experience regressions. See the failures above."); process.exitCode = 1; }
  else console.log("\nThe current consumer experience passed the desktop, phone, and TV matrix.");
}

runMatrix().catch((error) => { console.error("FATAL E2E MATRIX ERROR:", error); process.exitCode = 1; });
