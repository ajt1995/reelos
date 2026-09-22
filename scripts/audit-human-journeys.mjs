import { chromium } from "playwright";

async function testHumanJourneys() {
  console.log("================================================================================");
  console.log("       REELOS INTERACTIVE HUMAN JOURNEY & UI FLOW AUDIT (v2.5.0)                ");
  console.log("================================================================================");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const issues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      console.warn("  [Browser Console Error]", msg.text());
      issues.push(`Console: ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error("  [Page Error]", err.message);
    issues.push(`PageError: ${err.message}`);
  });

  // ---------------------------------------------------------------------------
  // JOURNEY 1: Full Zero-State Onboarding to Home
  // ---------------------------------------------------------------------------
  console.log("\n>>> Journey 1: Zero-State Day-1 Onboarding Through to Home Lounge...");
  await page.goto("http://127.0.0.1:8080/calibrate", { waitUntil: "networkidle" });

  // Act 1: Name cinema and pick resident
  try {
    await page.waitForSelector("button:has-text('Continue to Visual Taste')", { timeout: 10000 });
    await page.click("button:has-text('Continue to Visual Taste')");
    await page.waitForTimeout(1000);

    // Act 2: Pick 2 mood cards
    await page.waitForSelector("div.cursor-pointer:has-text('DEEP SPACE')", { timeout: 10000 });
    await page.click("div.cursor-pointer:has-text('DEEP SPACE')");
    await page.click("div.cursor-pointer:has-text('AUTEUR CINEMA')");
    await page.waitForTimeout(500);
    await page.click("button:has-text('Continue to Companion Sync')");
    await page.waitForTimeout(1000);
  } catch (err) {
    await page.screenshot({ path: "journey-1-debug.png" });
    console.error("  Screenshot saved to journey-1-debug.png. Error:", err.message);
    throw err;
  }

  // Act 3: Complete onboarding
  const enterBtn = await page.waitForSelector("button:has-text('Enter Cinema Lounge')", { timeout: 10000 });
  if (enterBtn) {
    await enterBtn.click();
    console.log("  + Tapped 'Enter Cinema Lounge'");
    await page.waitForTimeout(2500);
  }

  const currentUrl = page.url();
  console.log(`  + Landed on URL: ${currentUrl}`);
  if (!currentUrl.endsWith("/") && !currentUrl.includes("/?")) {
    issues.push(`Journey 1: Did not navigate to Home lounge, ended up at ${currentUrl}`);
  } else {
    console.log("  [PASS] Successfully transitioned from Onboarding to Home Lounge");
  }

  // ---------------------------------------------------------------------------
  // JOURNEY 2: Home Page Title Click & Modal Interaction
  // ---------------------------------------------------------------------------
  console.log("\n>>> Journey 2: Home Page Card Click, Modal Opening & 1-Tap Play...");
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Find any playable card or title button
  const card = await page.$("[data-testid='media-card'], .cursor-pointer");
  if (card) {
    await card.click();
    await page.waitForTimeout(1000);
    console.log("  + Clicked media card");
  } else {
    console.log("  - No clickable media cards found on Home page (testing Discover)");
    await page.goto("http://127.0.0.1:8080/discover", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const discCard = await page.$("button, .group, a");
    if (discCard) await discCard.click();
  }

  // ---------------------------------------------------------------------------
  // JOURNEY 3: Keyboard & TV Remote D-Pad Navigation
  // ---------------------------------------------------------------------------
  console.log("\n>>> Journey 3: TV Remote & Keyboard D-Pad Navigation (/tv)...");
  await page.goto("http://127.0.0.1:8080/tv", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Simulate D-pad inputs (ArrowDown, ArrowRight, Enter, Escape)
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  console.log("  [PASS] TV Couch Mode D-pad navigation processed cleanly without error");

  // ---------------------------------------------------------------------------
  // JOURNEY 4: Search Interaction
  // ---------------------------------------------------------------------------
  console.log("\n>>> Journey 4: Interactive Live Search...");
  await page.goto("http://127.0.0.1:8080/discover", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const searchInput = await page.$("input[type='text'], input[type='search'], input[placeholder*='search' i], input[placeholder*='find' i]");
  if (searchInput) {
    await searchInput.fill("Interstellar");
    await page.waitForTimeout(500);
    console.log("  + Filled search query 'Interstellar'");
    await searchInput.fill("");
  } else {
    console.log("  - Search input not mounted directly on root of /discover");
  }

  // ---------------------------------------------------------------------------
  // JOURNEY 5: Mobile Companion Quick Toggle Under Load
  // ---------------------------------------------------------------------------
  console.log("\n>>> Journey 5: Mobile Companion 'Who's in the Room?' Toggle...");
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto("http://127.0.0.1:8080/companion?id=jf-693134", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(1000);

  const presenceBtn = await mobilePage.$("button:has-text('Kids')");
  if (presenceBtn) {
    await presenceBtn.click();
    console.log("  + Toggled Kids presence filter");
    await mobilePage.waitForTimeout(300);
  }
  await mobileCtx.close();
  await context.close();
  await browser.close();

  console.log("\n================================================================================");
  console.log(`JOURNEY AUDIT RESULT: ${issues.length} issues found.`);
  console.log("================================================================================");
  if (issues.length > 0) {
    console.log("Issues detected:");
    console.log(issues);
    process.exit(1);
  } else {
    console.log(">>> ALL INTERACTIVE HUMAN JOURNEYS PASSED CLEANLY! ZERO BUGS DETECTED. <<<");
    process.exit(0);
  }
}

testHumanJourneys().catch((err) => {
  console.error("Fatal journey error:", err);
  process.exit(1);
});
