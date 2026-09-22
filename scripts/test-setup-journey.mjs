import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { readAppEnv } from "./with-app-env.mjs";
import { verifyBrowserPlayback, verifyPersonalPlayback } from "./test-harness/browser-playback.mjs";
import { verifyStorageSettings } from "./test-harness/browser-storage.mjs";
import { verifyBrowserPreparation } from "./test-harness/browser-preparation.mjs";
import { launchTestBrowser } from "./test-e2e-helpers.mjs";

const sourceFiles = ["src/experience/reelos-world.tsx", "src/experience/experience-state.ts", "src/experience/profile-adapter.ts", "src/experience/setup-adapter.ts", "src/routes/__root.tsx", "scripts/services/profile-service.mjs", "scripts/services/profile-session-service.mjs", "scripts/services/reelos-gate-service.mjs", "scripts/services/state-paths.mjs", "scripts/reelos-lookup-plugin.mjs", "scripts/test-setup-journey.mjs"];
const fingerprint = () => Object.fromEntries(sourceFiles.map((file) => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]));
sourceFiles.push("scripts/test-harness/browser-playback.mjs", "scripts/services/neural-stream-server.mjs", "scripts/services/playback-access-service.mjs", "scripts/sample-library-seed.mjs", "src/experience/source-access.ts");
sourceFiles.push("src/components/player-view.tsx", "src/lib/playback-session-client.ts", "src/components/gate.tsx", "src/routes/play.$id.tsx", "scripts/services/playback-session-service.mjs");
sourceFiles.push("src/lib/audio-booster.ts", "src/lib/playback-sleep-timer.ts");
sourceFiles.push("src/lib/playback-subtitles.ts");
sourceFiles.push("scripts/services/private-curator-service.mjs", "src/lib/private-curator-client.ts", "src/lib/use-curator.ts");
sourceFiles.push("src/components/curator-status.tsx", "src/components/discover-browse-view.tsx", "src/components/discover-view.tsx", "src/components/library-view.tsx", "src/components/title-view-live.tsx");
sourceFiles.push("src/routes/discover.tsx", "src/routes/library.tsx", "src/routes/title.$id.tsx");
sourceFiles.push("src/components/shell.tsx");
sourceFiles.push("src/components/title-card.tsx");
sourceFiles.push("scripts/services/media-retention-service.mjs", "src/lib/media-retention-client.ts", "src/components/cinema-player.tsx");
sourceFiles.push("scripts/services/storage-service.mjs", "scripts/services/media-strategy-service.mjs", "scripts/services/preparation-budget-service.mjs", "src/lib/storage-settings-client.ts", "src/components/storage-settings.tsx", "src/components/settings-accordions.tsx", "scripts/test-harness/browser-storage.mjs");
sourceFiles.push("scripts/services/media-preparation-service.mjs", "scripts/services/preparation-codec.mjs", "scripts/services/preparation-activity.mjs", "scripts/services/library-api-service.mjs", "src/experience/library-adapter.ts", "src/lib/preparation-client.ts", "src/components/preparation-panel.tsx", "scripts/test-harness/browser-preparation.mjs", "src/lib/prepared-viewing-client.ts");
sourceFiles.push("scripts/reelos-library.mjs");
sourceFiles.push("scripts/test-e2e-helpers.mjs", "scripts/local-tool-discovery.mjs");
const testedSources = fingerprint();
const livePlayback = process.argv.includes("--playback");
const personalPlayback = process.argv.includes("--personal-playback");
const builtPreview = process.argv.includes("--preview");
if (builtPreview && !process.argv.includes("--isolated")) throw new Error("Built-preview verification requires an isolated test home.");
if (livePlayback && personalPlayback) throw new Error("Run public and personal playback separately to retain distinct evidence.");
const evidencePath = `.reelos-audit/setup/${personalPlayback ? "personal" : livePlayback ? "public" : "setup"}-result.json`;
let playbackEvidence;
let preparationEvidence;

async function verifyCuratorRetry(page, base, ownerId) {
  // Catalog metadata is a fixture; profile authentication and the persisted
  // reaction still round-trip the real isolated service.
  const titleId = "curator-retry-fixture";
  let unavailable = true;
  let mutationCount = 0;
  await page.route("**/api/curator", async (route) => {
    if (route.request().method() === "POST") mutationCount++;
    if (route.request().method() === "GET" && unavailable) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false }) });
    } else await route.continue();
  });
  await page.route("**/api/discover?*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ titles: [{ id: titleId, title: "Taste retry fixture", kind: "movie", year: 1968, genres: ["Drama"], poster: "", backdrop: "" }], page: 1, totalPages: 1 }),
  }));
  try {
    await page.goto(`${base}/discover/movies`);
    const retry = page.getByRole("button", { name: "Retry loading taste", exact: true });
    await retry.waitFor();
    const target = await retry.boundingBox();
    assert(target && target.height >= 48 && target.width >= 48, "Taste retry remains touch-sized");
    await page.screenshot({ path: ".reelos-audit/setup/taste-retry.png" });
    const like = page.getByRole("button", { name: "More like this", exact: true });
    await like.waitFor();
    assert.equal(await page.getByText("Cached", { exact: true }).count(), 0, "Unknown catalog identity is not evidence of cached media");
    assert.equal(await page.getByText("4K HDR", { exact: true }).count(), 0, "Catalog presence is not verified format evidence");
    await like.click();
    assert.equal(mutationCount, 0, "No mutation before profile taste is confirmed");
    unavailable = false;
    const loaded = page.waitForResponse((response) => response.url().endsWith("/api/curator") && response.request().method() === "GET" && response.status() === 200);
    await retry.click();
    await loaded;
    await retry.waitFor({ state: "hidden" });
    assert.equal(mutationCount, 0, "Retry reloads taste; it does not replay an unconfirmed vote");
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/curator") && response.request().method() === "POST");
    await like.click();
    const ack = await saved;
    assert.equal(ack.status(), 200);
    const payload = await ack.json();
    assert.equal(payload.profileId, ownerId);
    assert.equal(payload.persisted, true);
    await page.waitForFunction(() => document.querySelector('button[aria-label="More like this"]')?.getAttribute("aria-pressed") === "true");
    const roster = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(roster.profiles.find((profile) => profile.id === ownerId).reactions[titleId], "like");
    assert.equal(mutationCount, 1);
    await page.goto(base);
    await page.getByRole("button", { name: "Change profile", exact: true }).click();
    await page.getByRole("button", { name: "Your profile", exact: true }).click();
    await page.getByRole("heading", { name: "Movie Night Test", exact: true }).waitFor();
    await page.getByRole("button", { name: "Tune your taste", exact: true }).waitFor();
    const unchanged = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(unchanged.activeId, ownerId, "Returning to the real profile chooser cannot silently switch identity");
  } catch (error) {
    await page.screenshot({ path: ".reelos-audit/setup/taste-retry-failure.png" }).catch(() => {});
    error.message += `\nTaste route: ${page.url()}\n${(await page.locator("body").innerText()).slice(0, 1500)}`;
    throw error;
  } finally {
    await page.unroute("**/api/curator");
    await page.unroute("**/api/discover?*");
    await page.goto(base);
  }
}

let base = process.env.REELOS_TEST_URL;
let server;
if (process.argv.includes("--isolated")) {
  const root = resolve(import.meta.dirname, "..");
  const temporaryRoot = join(root, ".test-tmp");
  mkdirSync(temporaryRoot, { recursive: true });
  const state = mkdtempSync(join(temporaryRoot, "setup-browser-"));
  if (personalPlayback) writeFileSync(join(state, "library-shelf.json"), JSON.stringify({ titles: [{
    id: "personal-playback-test", title: "Personal playback test", kind: "movie", year: 2026,
    sourceKind: "personal_import", path: join(root, "public", "reelos_teaser_45s.mp4"), OfficialRating: "G",
  }] }));
  const portProbe = createServer();
  await new Promise((done) => portProbe.listen(0, "127.0.0.1", done));
  const port = portProbe.address().port;
  await new Promise((done) => portProbe.close(done));
  base = `http://127.0.0.1:${port}`;
  const isolatedEnv = { ...readAppEnv(root), ...process.env, REELOS_STATE: state, REELOS_PROFILES_DIR: join(state, "profiles") };
  if (builtPreview) {
    // Build once, then release the compiler before Chromium and the real codec
    // run. Never turn stale compiled UI into evidence for current source files.
    await new Promise((done, reject) => {
      const builder = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", "development"], {
        cwd: root, env: isolatedEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      });
      let tail = "", failure;
      const capture = (chunk) => { tail = (tail + chunk.toString()).slice(-6000); };
      builder.stdout.on("data", capture); builder.stderr.on("data", capture);
      const timer = setTimeout(() => { failure = new Error("Isolated preview build timed out"); builder.kill(); }, 180000);
      builder.once("error", (error) => { failure = error; });
      builder.once("close", (code) => {
        clearTimeout(timer);
        if (failure || code !== 0) reject(new Error(`Fresh preview build failed: ${failure?.message || code}\n${tail}`));
        else done();
      });
    });
    assert.deepEqual(fingerprint(), testedSources, "Source changed during the preview build; repeat on a stable candidate");
    console.log("Fresh built preview ready; development compiler released before browser verification.");
  }
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", builtPreview ? "preview" : "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root, env: isolatedEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  process.on("exit", () => server?.kill());
  let startupLog = "";
  server.stdout.on("data", (chunk) => { startupLog = (startupLog + chunk).slice(-6000); });
  server.stderr.on("data", (chunk) => { startupLog = (startupLog + chunk).slice(-6000); });
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try { ready = (await fetch(`${base}/api/profiles`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) { server.kill(); throw new Error(`Isolated server did not start: ${startupLog}`); }
}
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Set REELOS_TEST_URL to an isolated local test server, never a household installation.");
}
const { browser } = await launchTestBrowser({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
mkdirSync(".reelos-audit/setup", { recursive: true });
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Hi, what should we call you?" }).waitFor({ timeout: 60000 });
  if (process.argv.includes("--inspect")) {
    console.log(await page.locator("main").innerText());
    console.log(await page.locator("input").evaluateAll((inputs) => inputs.map((input) => ({ placeholder: input.placeholder, type: input.type }))));
    await page.screenshot({ path: ".reelos-audit/setup/first-launch.png" });
  } else {
    const before = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(before.auth.bootstrapRequired, true, "Test requires a fresh isolated state directory");
    await page.getByPlaceholder("Your name").fill("Movie Night Test");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "And what is your favorite color?" }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "And what is your favorite color?" }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "Just you for now?" }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue without choosing", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("heading", { name: "What can this home play?" }).waitFor();
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "POST") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Test source save unavailable" }) });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Use public and personal media", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Test source save unavailable" }).waitFor();
    const partial = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(partial.setup.status, "in_progress");
    assert.equal(partial.profiles.length, 1);
    const ownerId = partial.activeId;
    await page.unroute("**/api/settings");
    await page.goto(`${base}/?watch=night-of-the-living-dead-1968`);
    await page.getByRole("heading", { name: "What can this home play?" }).waitFor();
    await page.waitForURL((url) => !url.searchParams.has("watch"));
    assert.equal(await page.locator("video").count(), 0, "A playback deep link must not bypass unfinished setup");
    await page.getByRole("button", { name: "Use public and personal media", exact: true }).click();
    await page.getByRole("heading", { name: "Where should ReelOS meet you?" }).waitFor();
    const completion = page.waitForResponse((response) => response.url().endsWith("/api/profiles/setup/complete"));
    await page.getByRole("button", { name: "Finish and open phone setup", exact: true }).click();
    assert.equal((await completion).status(), 200);
    await page.getByRole("heading", { name: "Where should ReelOS meet you?" }).waitFor({ state: "hidden" });
    const complete = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(complete.setup.status, "complete");
    assert.equal(complete.activeId, ownerId);
    assert.equal(complete.profiles.length, 1);
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("reelos-experience-service-v3")));
    assert.equal(persisted.state.profiles, undefined);
    assert.deepEqual(persisted.state.setupDraft, {});
    const privateCurator = await page.request.get(`${base}/api/curator`).then((response) => response.json());
    assert.equal(privateCurator.profileId, ownerId);
    const curated = await page.request.post(`${base}/api/curator`, { data: { id: "moon", vote: "comfort", expectedProfileId: ownerId } });
    assert.equal(curated.status(), 200);
    assert.equal((await curated.json()).persisted, true);
    const ownerTaste = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(ownerTaste.profiles.find((profile) => profile.id === ownerId).reactions.moon, "cozy");
    await verifyCuratorRetry(page, base, ownerId);
    await verifyStorageSettings(page, base, ownerId);
    if (personalPlayback) preparationEvidence = await verifyBrowserPreparation(page, base, ownerId);
    await page.reload();
    await page.getByRole("heading", { name: "Hi, what should we call you?" }).waitFor({ state: "hidden" });
    await page.screenshot({ path: ".reelos-audit/setup/completed-home.png" });
    if (livePlayback) playbackEvidence = await verifyBrowserPlayback(page, base, ownerId);
    if (personalPlayback) playbackEvidence = await verifyPersonalPlayback(page, base, ownerId);
    const adult = { id: "browser-second-adult", name: "Morgan Test", experienceVersion: 2, color: "#e11d48", reactions: { arrival: "love" }, savedIds: [], progress: {} };
    assert.equal((await page.request.post(`${base}/api/profiles`, { data: adult })).status(), 200);
    const child = { id: "browser-child", name: "Child Test", experienceVersion: 2, isKids: true, pin: "2468", reactions: {}, savedIds: [], progress: {} };
    assert.equal((await page.request.post(`${base}/api/profiles`, { data: child })).status(), 200);
    assert.equal((await page.request.post(`${base}/api/profiles/active`, { data: { id: adult.id } })).status(), 200);
    const secondRoster = await page.request.get(`${base}/api/profiles`).then((response) => response.json());
    assert.equal(secondRoster.activeId, adult.id);
    assert.equal(secondRoster.profiles.find((profile) => profile.id === ownerId).summaryOnly, true);
    assert.equal(secondRoster.profiles.find((profile) => profile.id === ownerId).reactions, undefined);
    const secondTaste = await page.request.get(`${base}/api/curator`).then((response) => response.json());
    assert.equal(secondTaste.profileId, adult.id);
    assert.equal(secondTaste.liked.includes("moon"), false);
    const memberStorage = await page.request.get(`${base}/api/strategy`).then((response) => response.json());
    assert.equal(memberStorage.canEdit, false);
    assert.equal((await page.request.post(`${base}/api/strategy`, { data: { expectedProfileId: adult.id, expectedRevision: memberStorage.revision, allocatedGb: 2 } })).status(), 403);
    const forgedTaste = await page.request.post(`${base}/api/curator/teach`, { data: { titleId: "moon", action: "not_interested", profileId: ownerId } });
    assert.equal(forgedTaste.status(), 403);
    if (personalPlayback) {
      const otherPreparation = await page.request.get(`${base}/api/preparation?expectedProfileId=${adult.id}`).then((response) => response.json());
      assert.equal(otherPreparation.canManage, false);
      assert.deepEqual(otherPreparation.jobs, [], 'Another adult cannot inherit private prepared jobs');
      assert.equal((await page.request.get(`${base}/api/preparation/${preparationEvidence.jobId}/file?expectedProfileId=${adult.id}`)).status(), 403);
      const otherSources = await page.request.get(`${base}/api/media/personal-playback-test/sources`).then((response) => response.json());
      assert.equal(otherSources.activeProfileId, adult.id);
      assert.equal(otherSources.resumeProgress, 0, "Another adult must not inherit viewing progress");
      assert.equal(otherSources.reaction, null, "Another adult must not inherit taste");
      const otherRetention = await page.request.get(`${base}/api/library/keep?id=personal-playback-test&expectedProfileId=${adult.id}`).then((response) => response.json());
      assert.equal(otherRetention.kept, false, "Another adult must not inherit personal keep choices");
      assert.equal(otherRetention.profileId, adult.id);
    }
    await page.reload();
    await page.getByRole("button", { name: "Change profile" }).waitFor();
    for (const [name, width, height] of [["phone", 390, 844], ["tv", 1920, 1080]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} horizontal overflow`);
      await page.screenshot({ path: `.reelos-audit/setup/${name}-home.png` });
    }
    assert.equal((await page.request.post(`${base}/api/profiles/active`, { data: { id: child.id } })).status(), 200);
    assert.equal((await page.request.get(`${base}/api/strategy`)).status(), 403);
    assert.equal((await page.request.get(`${base}/api/preparation?expectedProfileId=${child.id}`)).status(), 403);
    for (const route of ["/discover/movies", "/library", "/title/personal-playback-test"]) {
      await page.goto(`${base}${route}`);
      await page.waitForURL((url) => url.pathname === "/");
      assert.equal((await page.request.get(`${base}/api/profiles`).then((response) => response.json())).activeId, child.id,
        "Legacy deep links cannot replace or escape the child's session");
    }
    assert.equal((await page.request.post(`${base}/api/profiles/active`, { data: { id: adult.id } })).status(), 403);
    assert.equal((await page.request.post(`${base}/api/profiles/active`, { data: { id: adult.id, exitPin: "2468" } })).status(), 200);
    const stranger = await browser.newContext();
    const denied = await stranger.request.post(`${base}/api/settings`, { data: { debridEnabled: false } });
    assert.equal(denied.status(), 401);
    await stranger.close();
    const checks = ["fresh setup", "draft reload", "source failure recovery", "partial-owner resume", "unfinished setup rejects playback deep link", "stable roster IDs", "acknowledged completion", "private browser persistence excluded", "profile isolation", "child exit PIN", "phone/TV overflow", "unauthorized settings denied"];
    checks.push("legacy curator uses private profile taste", "forged curator profile rejected");
    checks.push("taste load failure has touch-sized retry", "taste retry does not replay a vote", "retried taste persists privately");
    checks.push("personal destination uses acknowledged profile identity", "child legacy deep links return to protected Home");
    checks.push("storage load/save failure and retry", "storage budget persists on reload", "storage phone/desktop/TV controls", "storage changes restricted to the owner");
    assert.deepEqual(errors, [], "No browser runtime errors");
    assert.deepEqual(fingerprint(), testedSources, "Source changed during test; repeat on a stable candidate");
    writeFileSync(".reelos-audit/setup/result.json", JSON.stringify({ capturedAt: new Date().toISOString(), result: "passed", checks, playback: playbackEvidence, preparation: preparationEvidence, serverMode: builtPreview ? "fresh-built-preview" : "development", runtimeErrors: errors, sources: testedSources, platform: process.platform, node: process.version, browser: browser.version() }, null, 2));
    writeFileSync(evidencePath, readFileSync(".reelos-audit/setup/result.json"));
    if (playbackEvidence) console.log(`PASS live playback: ${playbackEvidence.checks.join(", ")}`);
    if (preparationEvidence) console.log(`PASS local preparation: ${preparationEvidence.checks.join(", ")}`);
    console.log(`PASS: ${checks.join(", ")}.`);
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
} catch (error) {
  await page.screenshot({ path: ".reelos-audit/setup/failure.png" }).catch(() => {});
  writeFileSync(".reelos-audit/setup/result.json", JSON.stringify({ capturedAt: new Date().toISOString(), result: "failed", livePlayback, serverMode: builtPreview ? "fresh-built-preview" : "development", error: error.message, runtimeErrors: errors, sources: testedSources }, null, 2));
  writeFileSync(evidencePath, readFileSync(".reelos-audit/setup/result.json"));
  throw error;
} finally { await browser.close(); server?.kill(); }
