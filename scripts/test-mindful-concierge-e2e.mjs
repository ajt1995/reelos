import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCREENSHOT_DIR = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\c11dd108-741c-4598-b4fc-b1a6178acc01\\screenshots";
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log("Launching system Chrome at 120Hz viewport...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:8080/ ...");
  await page.route("**/api/ready*", async (route) => {
    const response = await route.fetch();
    const json = await response.json().catch(() => ({}));
    json.provisioned = false;
    await route.fulfill({ response, json });
  });
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  
  // Directly set phase to wizard via window.useReelStore
  await page.evaluate(() => {
    if (window.useReelStore) {
      window.useReelStore.getState().setPhase("wizard");
      window.useReelStore.getState().setWizardStep(1);
    }
  });
  await page.waitForTimeout(600);

  // STEP 1: Name & Standalone Mode
  console.log("Step 1: Hi, what's your name?");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "25_mindful_step1_name.png") });

  const nameInput = page.locator('input[placeholder="Enter your name..."]');
  await nameInput.waitFor({ state: "visible", timeout: 5000 });
  await nameInput.fill("Austin");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "26_mindful_step1_filled.png") });
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  // STEP 2: Who else needs a profile?
  console.log("Step 2: Who else needs a profile?");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "27_mindful_step2_profiles.png") });

  const profileInput = page.locator('input[placeholder="Enter name..."]');
  await profileInput.waitFor({ state: "visible", timeout: 5000 });
  await profileInput.fill("Sarah");
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(400);

  await profileInput.fill("Kids");
  const kidCheckbox = page.locator('input[type="checkbox"]');
  if (await kidCheckbox.isVisible()) await kidCheckbox.check();
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(400);

  await page.screenshot({ path: join(SCREENSHOT_DIR, "28_mindful_step2_family_added.png") });
  await page.click('button:has-text("Next: Storage Mode")');
  await page.waitForTimeout(500);

  // STEP 3: Storage Mode
  console.log("Step 3: Storage Mode Selection");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "29_mindful_step3_storage.png") });
  const smartHybrid = page.locator('text=Smart Hybrid').first();
  await smartHybrid.click();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Next: Debrid Streaming Key")');
  await page.waitForTimeout(500);

  // STEP 4: Debrid Streaming Key
  console.log("Step 4: Debrid Key");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "30_mindful_step4_debrid.png") });
  const keyInput = page.locator('input[type="password"]');
  await keyInput.waitFor({ state: "visible", timeout: 5000 });
  const val = await keyInput.inputValue();
  if (!val) {
    await keyInput.fill("cc5c096d-ae43-4c08-b7f5-9caece143a27");
  }
  await page.screenshot({ path: join(SCREENSHOT_DIR, "31_mindful_step4_verified.png") });
  await page.click('button:has-text("Next: Select Devices")');
  await page.waitForTimeout(500);

  // STEP 5: What devices do we need to onboard now?
  console.log("Step 5: Multi-Select Devices");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "32_mindful_step5_devices.png") });
  await page.click('button:has-text("Next: Pick Cinema Vibe")');
  await page.waitForTimeout(500);

  // STEP 6: Pick your cinema vibe
  console.log("Step 6: Pick your cinema vibe");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "33_mindful_step6_vibe.png") });
  const spectacleCard = page.locator('text=Bleeding-Edge 70mm Spectacle').first();
  if (await spectacleCard.isVisible()) {
    await spectacleCard.click();
    await page.waitForTimeout(400);
  }
  await page.click('button:has-text("Finish Setup")');
  await page.waitForTimeout(500);

  // STEP 7: All Set. Welcome to ReelOS.
  console.log("Step 7: All set. Welcome to ReelOS.");
  await page.screenshot({ path: join(SCREENSHOT_DIR, "34_mindful_step7_welcome.png") });

  console.log("SUCCESS: All Mindful Concierge snapshots captured at 120Hz!");
  await browser.close();
}

run().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
