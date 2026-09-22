import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\c11dd108-741c-4598-b4fc-b1a6178acc01\\screenshots";
mkdirSync(outDir, { recursive: true });

async function run() {
  console.log("Launching browser via Playwright...");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  // Intercept the TV scan API to mock a discovered TV
  await page.route("**/api/apps/android/scan", route => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ devices: [{ ip: "192.168.1.95", port: 5555, name: "Living Room Android TV", online: true }] })
    });
  });

  await page.route("**/api/ready*", async (route) => {
    const response = await route.fetch();
    const json = await response.json().catch(() => ({}));
    json.provisioned = false;
    await route.fulfill({ response, json });
  });

  console.log("Navigating to setup wizard...");
  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000); // Wait for hydration and React mounting
  
  await page.evaluate(() => {
    const defaultAnswers = {
      storageMode: "both",
      selectedDisks: ["sda", "sdb"],
      formatDisks: [],
      source: "torbox",
      apiKey: "",
      vpnProvider: "mullvad",
      intent: { movies: true, tv: true, kids: false }
    };
    const state = {
      phase: "wizard",
      wizardStep: 4,
      provisioned: false,
      hydrated: true,
      answers: defaultAnswers,
      residents: [{ id: "res-primary", name: "Primary", avatar: "clapperboard", isGuest: false, isKids: false, watchlist: [], watchProgress: {} }]
    };
    localStorage.setItem("reelos-v4", JSON.stringify({ state, version: 0 }));
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Capture Centered Onboarding Wizard Step 4 Overview
  console.log("Capturing Centered Onboarding Wizard Step 4...");
  const step4Shot = join(outDir, "15_centered_wizard_step4.png");
  await page.screenshot({ path: step4Shot });
  console.log(`Saved Centered Wizard Step 4 screenshot to: ${step4Shot}`);

  // 2. Capture Living Room TV & Mobile Tab
  console.log("Capturing TV tab...");
  await page.evaluate(() => { window.useReelStore.getState().patchAnswers({ apiKey: "test" }) });
  await page.locator('button:has-text("Next: Select Devices")').click({ force: true });
  await page.waitForSelector("text=192.168.1.95:5555");
  await page.waitForTimeout(500);
  const tvTabShot = join(outDir, "16_tv_pairing_tab.png");
  await page.screenshot({ path: tvTabShot });
  console.log(`Saved TV tab screenshot to: ${tvTabShot}`);

  // 3. Capture Tinder Swiper Card Deck
  console.log("Capturing Tinder Swiper Card Deck...");
  await page.locator('button:has-text("45s Family Taste Match")').click({ force: true });
  await page.getByText("Start 45s Match").click({ force: true });
  await page.getByText("Vintage Synth & Warmth").click({ force: true });
  // Wait for the TinderSwiper card to appear
  await page.waitForSelector("text=Taste Match: Swipe for");
  await page.waitForTimeout(1000);
  const tinderShot = join(outDir, "17_tinder_swiper_deck.png");
  await page.screenshot({ path: tinderShot });
  console.log(`Saved Tinder Swiper screenshot to: ${tinderShot}`);

  // 4. Capture /calibrate standalone mobile page (as scanned by QR code on phone)
  console.log("Navigating to /calibrate on mobile viewport...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:8080/calibrate", { waitUntil: "domcontentloaded", timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  const mobileCalibrateShot = join(outDir, "18_mobile_calibrate_standalone.png");
  await mobilePage.screenshot({ path: mobileCalibrateShot });
  console.log(`Saved mobile /calibrate screenshot to: ${mobileCalibrateShot}`);

  await mobileContext.close();
  await browser.close();
  console.log("Visual snapshot tests completed successfully!");
}

run().catch((err) => {
  console.error("Visual snapshot error:", err);
  process.exit(1);
});

