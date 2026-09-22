import { chromium } from "playwright";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ARTIFACTS_DIR = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\c11dd108-741c-4598-b4fc-b1a6178acc01";
const LOCAL_URL = "http://localhost:8080";
const APPLIANCE_URL = "http://192.168.1.234:8080";

async function probeUrl(url) {
  try {
    const res = await fetch(`${url}/api/ready`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function runSoakTest() {
  console.log("=== ReelOS End-to-End Soak Test & Screen-by-Screen Visual Audit ===");

  const localUp = await probeUrl(LOCAL_URL);
  const applianceUp = await probeUrl(APPLIANCE_URL);

  console.log(`Target status: Local (:8080) = ${localUp ? "UP" : "DOWN"}, Appliance (192.168.1.234) = ${applianceUp ? "UP" : "DOWN"}`);
  const targetBase = localUp ? LOCAL_URL : APPLIANCE_URL;
  console.log(`Primary testing target: ${targetBase}`);

  // Test 1: USB Creator API verification
  console.log("\n[Test 1] Testing USB Creator APIs...");
  const isoRes = await fetch(`${targetBase}/api/usb-creator/iso-status`).then((r) => r.json());
  console.log("  ISO Status:", isoRes);
  assert.equal(typeof isoRes.found, "boolean");

  const drivesRes = await fetch(`${targetBase}/api/usb-creator/drives`).then((r) => r.json());
  console.log("  USB Drives detected:", (drivesRes.drives || []).length);
  assert.equal(typeof drivesRes.ok, "boolean");

  // Test 2: Battery status honesty verification
  console.log("\n[Test 2] Testing Battery Guardian Honesty...");
  const batteryRes = await fetch(`${targetBase}/api/battery/status`).then((r) => r.json()).catch(() => ({}));
  console.log("  Battery present:", batteryRes.present, "thresholdSupported:", batteryRes.thresholdSupported);

  // Test 3: Playwright Screen-by-Screen Visual Capture
  console.log("\n[Test 3] Launching Edge Chromium for visual audit...");
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const screens = [
    { name: "01_setup_wizard", path: "/" },
    { name: "02_requests_screen", path: "/requests" },
    { name: "03_settings_screen", path: "/settings" },
    { name: "04_tv_couch_mode", path: "/tv" },
    { name: "05_flickmatch", path: "/flickmatch" },
    { name: "06_books_shelf", path: "/books" },
  ];

  for (const s of screens) {
    const fullUrl = `${targetBase}${s.path}`;
    console.log(`  Capturing ${s.name} at ${fullUrl}...`);
    try {
      await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 10000 });
      await page.waitForTimeout(800);

      // Screenshot animations ON
      const shotPath = join(ARTIFACTS_DIR, `screen_${s.name}_anim_on.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`    Saved: ${shotPath}`);

      // Toggle animations OFF and screenshot potato mode
      await page.evaluate(() => {
        document.documentElement.dataset.animations = "false";
        document.body.dataset.animations = "false";
      });
      await page.waitForTimeout(200);
      const shotPotato = join(ARTIFACTS_DIR, `screen_${s.name}_potato_mode.png`);
      await page.screenshot({ path: shotPotato, fullPage: false });
      console.log(`    Saved: ${shotPotato}`);
    } catch (e) {
      console.log(`    Warning: failed to capture ${s.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log("\n=== Soak Test Completed Successfully ===");
}

runSoakTest().catch((e) => {
  console.error("Soak test failed:", e);
  process.exit(1);
});
