import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\c11dd108-741c-4598-b4fc-b1a6178acc01\\screenshots";
mkdirSync(outDir, { recursive: true });

async function run() {
  console.log("Starting ReelOS End-to-End Fake Family Test...");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  // 1. Initialize household with Austin (Dad), Sarah, and Kids
  console.log("Seeding fake family into store...");
  await page.route("**/api/ready*", async (route) => {
    const response = await route.fetch();
    const json = await response.json().catch(() => ({}));
    json.provisioned = false;
    await route.fulfill({ response, json });
  });

  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const defaultAnswers = {
      storageMode: "both",
      selectedDisks: ["sda", "sdb"],
      formatDisks: [],
      source: "torbox",
      apiKey: "cc5c096d-ae43-4c08-b7f5-9caece143a27",
      vpnProvider: "mullvad",
      intent: { movies: true, tv: true, kids: true }
    };
    const state = {
      phase: "wizard",
      wizardStep: 6,
      provisioned: false,
      hydrated: true,
      answers: defaultAnswers,
      residents: [
        { id: "res-austin", name: "Austin (Dad)", avatar: "clapperboard", isGuest: false, isKids: false, watchlist: [], watchProgress: {} },
        { id: "res-sarah", name: "Sarah", avatar: "sparkles", isGuest: false, isKids: false, watchlist: [], watchProgress: {} },
        { id: "res-kids", name: "Kids", avatar: "gamepad-2", isGuest: false, isKids: true, watchlist: [], watchProgress: {} }
      ]
    };
    localStorage.setItem("reelos-v4", JSON.stringify({ state, version: 0 }));
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  // 2. Test 5-Second Visual Flash on Austin (Primary)
  console.log("Testing 5-Second Visual Flash for Austin...");
  await page.screenshot({ path: join(outDir, "debug_before_click.png") });
  await page.locator("button:has-text('5-Second Visual Flash')").click({ force: true });
  await page.waitForTimeout(600);

  // Pick 70mm Spectacle
  await page.getByText("Bleeding-Edge 70mm Spectacle").click({ force: true });
  await page.waitForTimeout(1000); // Wait for instant synthesis

  const shot1 = join(outDir, "19_e2e_austin_visual_flash_results.png");
  await page.screenshot({ path: shot1 });
  console.log(`Captured Austin calibration: ${shot1}`);

  // 3. Switch to Sarah and calibrate with Visual Flash (Clinical Cold)
  console.log("Testing Visual Flash for Sarah...");
  await page.locator('span:has-text("Sarah")').first().click({ force: true });
  await page.waitForTimeout(500);

  await page.locator("button:has-text('5-Second Visual Flash')").click({ force: true });
  await page.waitForTimeout(600);

  await page.getByText("Clinical Cold & Mind-Benders").click({ force: true });
  await page.waitForTimeout(1000);

  const shot2 = join(outDir, "20_e2e_sarah_visual_flash_results.png");
  await page.screenshot({ path: shot2 });
  console.log(`Captured Sarah calibration: ${shot2}`);

  // 4. Switch to Kids and test Tinder Deck
  console.log("Testing Kids Profile Tinder Deck...");
  await page.locator('span:has-text("Kids")').first().click({ force: true });
  await page.waitForTimeout(500);

  await page.getByText("45s Tinder Match Deck").click({ force: true });
  await page.waitForTimeout(500);
  await page.getByText("Cozy Storybook & Ghibli").click({ force: true });
  await page.waitForTimeout(1000);

  const shot3 = join(outDir, "21_e2e_kids_tinder_deck.png");
  await page.screenshot({ path: shot3 });
  console.log(`Captured Kids Tinder deck: ${shot3}`);

  // 5. Test Mobile Standalone /calibrate (as scanned by phone camera)
  console.log("Testing mobile standalone /calibrate...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:8080/calibrate", { waitUntil: "domcontentloaded", timeout: 15000 });
  await mobilePage.waitForTimeout(1500);

  const shot4 = join(outDir, "22_e2e_mobile_calibrate.png");
  await mobilePage.screenshot({ path: shot4 });
  console.log(`Captured Mobile standalone calibrate: ${shot4}`);
  await mobileContext.close();

  // 6. Complete Wizard -> Enter Home Shelf
  console.log("Finishing wizard and launching ReelOS Home...");
  await page.evaluate(() => {
    const raw = localStorage.getItem("reelos-v4");
    if (raw) {
      const data = JSON.parse(raw);
      data.state.provisioned = true;
      data.state.phase = "app";
      localStorage.setItem("reelos-v4", JSON.stringify(data));
    }
  });

  await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);

  const shot5 = join(outDir, "23_e2e_home_shelf.png");
  await page.screenshot({ path: shot5 });
  console.log(`Captured Home Shelf: ${shot5}`);

  // 7. Verify TV Couch Mode
  console.log("Navigating to TV Couch Mode (/tv)...");
  await page.goto("http://localhost:8080/tv", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  const shot6 = join(outDir, "24_e2e_tv_couch_mode.png");
  await page.screenshot({ path: shot6 });
  console.log(`Captured TV Couch Mode: ${shot6}`);

  await browser.close();
  console.log("End-to-End Fake Family Test Completed Successfully!");
}

run().catch((err) => {
  console.error("End-to-End Test Failed:", err);
  process.exit(1);
});
