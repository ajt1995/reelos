import { chromium } from "playwright";
import fs from "fs";

async function runAudit() {
  console.log(">>> Launching Headless Edge for Full-Stack User Walkthrough...");
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const issues = [];
  
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      issues.push({ type: "console_error", text: msg.text() });
      console.log("  [CONSOLE ERROR]:", msg.text().slice(0, 120));
    }
  });

  page.on("pageerror", (err) => {
    issues.push({ type: "page_error", text: err.message });
    console.log("  [PAGE ERROR]:", err.message);
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      issues.push({ type: "network_error", url: res.url(), status: res.status() });
      console.log(`  [HTTP ${res.status()}]:`, res.url());
    }
  });

  console.log(">>> [1/5] Loading Day-1 Fresh Install at http://192.168.1.234:8080/ ...");
  await context.addInitScript(() => {
    localStorage.clear();
  });

  await page.goto("http://192.168.1.234:8080/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "audit-1-fresh-boot.png" });
  console.log("  Step 1 URL:", page.url());

  // Check if we are on Step 1 (Welcome / Name)
  const nameInput = await page.$("input");
  if (nameInput) {
    console.log(">>> [2/5] Entering name 'Austin' and submitting Step 1...");
    await nameInput.fill("Austin");
    await page.waitForTimeout(500);
    const continueBtn = await page.$("button[type='submit']");
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "audit-2-after-step1.png" });
    }
  }

  // Now we should be on Step 2 (Taste Primer)
  console.log(">>> [3/5] Testing Taste Primer Buttons & Reactions...");
  await page.screenshot({ path: "audit-3-taste-primer.png" });
  
  // Find all reaction buttons
  const loveBtns = await page.$$("button[title*='Love']");
  const likeBtns = await page.$$("button[title*='Like']");
  const comfyBtns = await page.$$("button[title*='Comfy']");
  const dismissBtns = await page.$$("button[title*='Dismiss']");
  console.log(`  Found: ${loveBtns.length} Love, ${likeBtns.length} Like, ${comfyBtns.length} Comfy, ${dismissBtns.length} Dismiss buttons`);

  if (loveBtns.length > 0) {
    console.log("  Clicking Love on 1st card...");
    await loveBtns[0].click();
    await page.waitForTimeout(1000);
  }
  if (likeBtns.length > 1) {
    console.log("  Clicking Like on 2nd card...");
    await likeBtns[1].click();
    await page.waitForTimeout(1000);
  }
  if (comfyBtns.length > 2) {
    console.log("  Clicking Comfy on 3rd card...");
    await comfyBtns[2].click();
    await page.waitForTimeout(1000);
  }
  if (dismissBtns.length > 3) {
    console.log("  Clicking Dismiss on 4th card...");
    await dismissBtns[3].click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: "audit-4-after-reactions.png" });

  // Test "Finish Calibration Whenever" button
  console.log(">>> [4/5] Clicking 'Finish Calibration Whenever' button...");
  const finishBtn = await page.$("button:has-text('Finish Calibration')");
  if (finishBtn) {
    console.log("  Found Finish button, clicking...");
    await finishBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "audit-5-after-finish.png" });
  } else {
    console.log("  WARNING: Could not find 'Finish Calibration' button!");
  }

  console.log(">>> [5/5] Checking final screen state after setup...");
  console.log("  Current URL:", page.url());
  await page.screenshot({ path: "audit-6-final-screen.png" });

  await browser.close();
  console.log(`>>> Audit complete with ${issues.length} issues captured.`);
  fs.writeFileSync("audit-issues.json", JSON.stringify(issues, null, 2));
}

runAudit().catch(console.error);
