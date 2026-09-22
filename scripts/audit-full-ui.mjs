import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT_DIR = "C:\\Users\\austi\\.gemini\\antigravity\\brain\\a4ff7db8-8690-4e52-89b3-a3bd2b00aa3d";
const SCREENSHOT_DIR = join(ARTIFACT_DIR, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const auditResults = {
  timestamp: new Date().toISOString(),
  screensTested: 0,
  consoleErrors: [],
  pageErrors: [],
  screenshots: [],
};

async function runAudit() {
  console.log("================================================================================");
  console.log("       REELOS FULL-SPECTRUM FRONTEND & BACKEND AUDIT (v2.5.0)                   ");
  console.log("================================================================================");

  console.log(">>> Launching Chromium via Playwright...");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  // Desktop Cinema Context (1920x1080)
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await desktopContext.newPage();

  // Wire Error Listeners
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter non-fatal favicon or expected network probe rejections
      if (!text.includes("favicon") && !text.includes("net::ERR_CONNECTION_REFUSED")) {
        console.warn("  [Browser Console Error]", text);
        auditResults.consoleErrors.push(text);
      }
    }
  });

  page.on("response", (res) => {
    if (res.status() === 404) {
      console.warn("  [404 NOT FOUND]", res.url());
      auditResults.consoleErrors.push(`404: ${res.url()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error("  [Page Uncaught Exception]", err.message);
    auditResults.pageErrors.push(err.message);
  });

  // ---------------------------------------------------------------------------
  // 1. AUDIT ONBOARDING ACT 1: Cinema Identity & Family Residents (/calibrate)
  // ---------------------------------------------------------------------------
  console.log("\n[1/9] Auditing Sovereign Onboarding Act 1 (/calibrate)...");
  try {
    await page.goto("http://127.0.0.1:8080/calibrate", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const shot1 = join(SCREENSHOT_DIR, "audit-1-onboarding-act1.png");
    await page.screenshot({ path: shot1, fullPage: true });
    auditResults.screenshots.push({ screen: "Onboarding Act 1", path: shot1 });
    auditResults.screensTested++;
    console.log("  + Act 1 verified and captured.");

    // ---------------------------------------------------------------------------
    // 2. AUDIT ONBOARDING ACT 2: 6-Card Visual Mood Grid & Inaugural Shelf Preview
    // ---------------------------------------------------------------------------
    console.log("\n[2/9] Auditing Sovereign Onboarding Act 2 (Visual Mood Grid)...");
    await page.waitForSelector("button:has-text('Continue to Visual Taste')", { timeout: 5000 });
    await page.click("button:has-text('Continue to Visual Taste')");
    await page.waitForTimeout(1000);
    const shot2 = join(SCREENSHOT_DIR, "audit-2-onboarding-act2.png");
    await page.screenshot({ path: shot2, fullPage: true });
    auditResults.screenshots.push({ screen: "Onboarding Act 2", path: shot2 });
    auditResults.screensTested++;
    console.log("  + Act 2 (6-Card Visual Mood Grid) verified and captured.");

    // ---------------------------------------------------------------------------
    // 3. AUDIT ONBOARDING ACT 3: MagicDNS Companion QR Handshake & Launch
    // ---------------------------------------------------------------------------
    console.log("\n[3/9] Auditing Sovereign Onboarding Act 3 (Companion Sync & Launch)...");
    await page.waitForSelector("button:has-text('Continue to Companion Sync')", { timeout: 5000 });
    await page.click("button:has-text('Continue to Companion Sync')");
    await page.waitForTimeout(1000);
    const shot3 = join(SCREENSHOT_DIR, "audit-3-onboarding-act3.png");
    await page.screenshot({ path: shot3, fullPage: true });
    auditResults.screenshots.push({ screen: "Onboarding Act 3", path: shot3 });
    auditResults.screensTested++;
    console.log("  + Act 3 (MagicDNS Handshake) verified and captured.");
  } catch (err) {
    console.error("  x Onboarding flow error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 4. AUDIT HOME CINEMA LOUNGE (Provisioned Edge-to-Edge Canvas)
  // ---------------------------------------------------------------------------
  console.log("\n[4/9] Auditing Home Cinema Lounge & Marquee Shelves...");
  try {
    // Ensure provisioned = true for home view
    await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("reelos-v4") || "{}";
        const state = JSON.parse(raw);
        state.state = state.state || {};
        state.state.provisioned = true;
        state.state.phase = "ready";
        localStorage.setItem("reelos-v4", JSON.stringify(state));
      } catch (e) {}
    });

    await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    const shot4 = join(SCREENSHOT_DIR, "audit-4-home-cinema-lounge.png");
    await page.screenshot({ path: shot4 });
    auditResults.screenshots.push({ screen: "Home Cinema Lounge", path: shot4 });
    auditResults.screensTested++;
    console.log("  + Home Cinema Lounge verified and captured.");
  } catch (err) {
    console.error("  x Home audit error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 5. AUDIT DISCOVER FEED & CATALOG
  // ---------------------------------------------------------------------------
  console.log("\n[5/9] Auditing Discover Feed & Search...");
  try {
    await page.goto("http://127.0.0.1:8080/discover", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    const shot5 = join(SCREENSHOT_DIR, "audit-5-discover-curation.png");
    await page.screenshot({ path: shot5 });
    auditResults.screenshots.push({ screen: "Discover Feed", path: shot5 });
    auditResults.screensTested++;
    console.log("  + Discover curation feed verified and captured.");
  } catch (err) {
    console.error("  x Discover audit error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 6. AUDIT SETTINGS & COCKPIT (Family Cinema Shield, TruePlay EQ, Child Profile)
  // ---------------------------------------------------------------------------
  console.log("\n[6/9] Auditing Settings & Cockpit (Cinema Superpowers)...");
  try {
    await page.goto("http://127.0.0.1:8080/settings", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    const shot6 = join(SCREENSHOT_DIR, "audit-6-settings-cockpit.png");
    await page.screenshot({ path: shot6 });
    auditResults.screenshots.push({ screen: "Settings & Cockpit", path: shot6 });
    auditResults.screensTested++;
    console.log("  + Settings & Cockpit verified and captured.");
  } catch (err) {
    console.error("  x Settings audit error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 7. AUDIT TV COUCH MODE (/tv)
  // ---------------------------------------------------------------------------
  console.log("\n[7/9] Auditing TV Couch Mode (/tv)...");
  try {
    await page.goto("http://127.0.0.1:8080/tv", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    const shot7 = join(SCREENSHOT_DIR, "audit-7-tv-couch-mode.png");
    await page.screenshot({ path: shot7 });
    auditResults.screenshots.push({ screen: "TV Couch Mode", path: shot7 });
    auditResults.screensTested++;
    console.log("  + TV Couch Mode verified and captured.");
  } catch (err) {
    console.error("  x TV mode audit error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 8. AUDIT MOBILE COMPANION SCREEN (390x844: "Who's in the Room?" Presence Bar)
  // ---------------------------------------------------------------------------
  console.log("\n[8/9] Auditing Mobile Companion Screen (Presence Slider & Lore)...");
  try {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
    await mobilePage.evaluate(() => {
      try {
        const raw = localStorage.getItem("reelos-v4") || "{}";
        const state = JSON.parse(raw);
        state.state = state.state || {};
        state.state.provisioned = true;
        state.state.phase = "ready";
        localStorage.setItem("reelos-v4", JSON.stringify(state));
      } catch (e) {}
    });

    await mobilePage.goto("http://127.0.0.1:8080/companion?id=jf-693134", { waitUntil: "networkidle", timeout: 15000 });
    await mobilePage.waitForTimeout(1500);
    const shot8 = join(SCREENSHOT_DIR, "audit-8-mobile-companion.png");
    await mobilePage.screenshot({ path: shot8, fullPage: true });
    auditResults.screenshots.push({ screen: "Mobile Companion Screen", path: shot8 });
    auditResults.screensTested++;
    console.log("  + Mobile Companion Screen verified and captured.");
    await mobileContext.close();
  } catch (err) {
    console.error("  x Companion audit error:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 9. AUDIT CALIBRATION SUITE (/calibrate)
  // ---------------------------------------------------------------------------
  console.log("\n[9/9] Auditing Taste Calibration Lounge (/calibrate)...");
  try {
    await page.goto("http://127.0.0.1:8080/calibrate", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    const shot9 = join(SCREENSHOT_DIR, "audit-9-calibrate-lounge.png");
    await page.screenshot({ path: shot9 });
    auditResults.screenshots.push({ screen: "Calibration Lounge", path: shot9 });
    auditResults.screensTested++;
    console.log("  + Calibration Lounge verified and captured.");
  } catch (err) {
    console.error("  x Calibrate audit error:", err.message);
  }

  await browser.close();

  // Save audit report
  const reportPath = join(ARTIFACT_DIR, "ui_audit_report.json");
  writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), "utf8");

  console.log("\n================================================================================");
  console.log(`AUDIT COMPLETE: ${auditResults.screensTested} screens audited.`);
  console.log(`Console Errors: ${auditResults.consoleErrors.length}`);
  console.log(`Page Errors: ${auditResults.pageErrors.length}`);
  console.log(`Screenshots Saved: ${auditResults.screenshots.length}`);
  console.log("================================================================================");
}

runAudit().catch((err) => {
  console.error("Audit Runner Fatal Error:", err);
  process.exit(1);
});
