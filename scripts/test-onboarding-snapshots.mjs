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

  console.log("Navigating to http://localhost:8080/calibrate...");
  try {
    await page.goto("http://localhost:8080/calibrate", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1000);
    const calibShot = join(outDir, "11_calibrate_taste_match_retina.png");
    await page.screenshot({ path: calibShot });
    console.log(`Saved /calibrate screenshot to: ${calibShot}`);
  } catch (err) {
    console.error("Calibrate snapshot error:", err);
  }

  console.log("Navigating to http://localhost:8080/setup (Wizard Step 4)...");
  try {
    // Reset store to step 4 in localStorage
    await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("reelos-v4") || "{}";
        const state = JSON.parse(raw);
        state.state = state.state || {};
        state.state.provisioned = false;
        state.state.phase = "wizard";
        state.state.wizardStep = 4;
        localStorage.setItem("reelos-v4", JSON.stringify(state));
      } catch (e) {}
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const step4Shot = join(outDir, "12_wizard_step4_family_match_retina.png");
    await page.screenshot({ path: step4Shot });
    console.log(`Saved Wizard Step 4 (Trainer) screenshot to: ${step4Shot}`);

    // Click on the Android TV tab
    const tvTab = await page.$("button:has-text('Living Room TV & Mobile')");
    if (tvTab) {
      await tvTab.click();
      await page.waitForTimeout(1000);
      const tvTabShot = join(outDir, "13_wizard_step4_android_tv_retina.png");
      await page.screenshot({ path: tvTabShot });
      console.log(`Saved Wizard Step 4 (Android TV) screenshot to: ${tvTabShot}`);
    }

    // Switch back to trainer tab and start the match
    const trainerTab = await page.$("button:has-text('45s Family Taste Match')");
    if (trainerTab) await trainerTab.click();
    await page.waitForTimeout(500);

    const startMatchBtn = await page.$("button:has-text('Start 45s Match')");
    if (startMatchBtn) await startMatchBtn.click();
    await page.waitForTimeout(600);

    // Pick a vibe
    const vibeBtn = await page.$("text=Vintage Synth & Warmth");
    if (vibeBtn) await vibeBtn.click();
    await page.waitForTimeout(600);

    const showdownShot = join(outDir, "14_45s_match_showdown_round_retina.png");
    await page.screenshot({ path: showdownShot });
    console.log(`Saved 45s Showdown Round screenshot to: ${showdownShot}`);
  } catch (err) {
    console.error("Wizard Step 4 snapshot error:", err);
  }

  await browser.close();
  console.log("All visual snapshots captured successfully!");
}

run().catch((err) => {
  console.error("Snapshot run error:", err);
  process.exit(1);
});
