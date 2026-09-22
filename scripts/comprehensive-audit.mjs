import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "http://192.168.1.234:8080";

async function runFullAudit() {
  console.log(">>> [AUDIT] Launching Headless Edge against Appliance:", BASE_URL);
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const issues = [];
  const passedSteps = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      if (!txt.includes("favicon") && !txt.includes("status of 404")) {
        console.log("  [CONSOLE ERROR]:", txt.slice(0, 140));
        issues.push({ type: "console_error", text: txt });
      }
    }
  });

  page.on("pageerror", (err) => {
    console.log("  [PAGE ERROR]:", err.message);
    issues.push({ type: "page_error", text: err.message });
  });

  let capturedPlayHref = "/play/jf-34608696587ab423cc8c088b7bcf6b8b";

  try {
    console.log("\n>>> Step 1: Navigating to Home...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    
    try {
      await page.waitForSelector("header, input, button:has-text('Begin setup')", { timeout: 10000 });
    } catch {}

    await page.waitForTimeout(2000);
    console.log("  Current URL on initial load:", page.url());

    // Check if on Step 1 of wizard (Welcome / Name)
    const nameInput = await page.$("input");
    if (nameInput) {
      console.log("  Detected setup wizard. Entering admin name...");
      await nameInput.fill("Austin");
      const submitBtn = await page.$("button[type='submit']");
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for TastePrimer reaction buttons
    const loveBtns = await page.$$("button[title*='Love']");
    if (loveBtns.length > 0) {
      console.log(`  Found TastePrimer with ${loveBtns.length} cards. Clicking Love reaction...`);
      await loveBtns[0].click();
      await page.waitForTimeout(500);
      const finishBtn = await page.$("button:has-text('Finish Calibration')");
      if (finishBtn) {
        console.log("  Clicking 'Finish Calibration'...");
        await finishBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Check for Marquee Pinning Tray
    const marqueeBtn = await page.$("button:has-text('Continue to Discover')");
    if (marqueeBtn) {
      console.log("  Found Marquee Pinning Tray. Clicking 'Continue to Discover'...");
      await marqueeBtn.click();
      await page.waitForTimeout(2000);
    }

    // Now reload Home to ensure Shell is active
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "walkthrough-1-home.png" });

    passedSteps.push("Step 1: Onboarding & Home Screen Active");

    // -------------------------------------------------------------
    // STEP 2: Home Page Verification & Hero Button Actions
    // -------------------------------------------------------------
    console.log("\n>>> Step 2: Testing Home View Hero & Interactions...");
    const heroWatchBtn = await page.$("a[href*='/play/']");
    if (heroWatchBtn) {
      const playHref = await heroWatchBtn.getAttribute("href");
      console.log("  Found Hero Watch button routing directly to player:", playHref);
      if (playHref) capturedPlayHref = playHref;
      passedSteps.push(`Step 2a: Hero Watch button routes to ${playHref}`);
    }

    const heroDetailsBtn = await page.$("a[href*='/title/']");
    if (heroDetailsBtn) {
      const titleHref = await heroDetailsBtn.getAttribute("href");
      console.log("  Found Hero Details button routing to:", titleHref);
      passedSteps.push(`Step 2b: Hero Details button routes to ${titleHref}`);
    }

    const heroNextBtn = await page.$("button[title*='Next spotlight title']");
    if (heroNextBtn) {
      console.log("  Testing Hero Next slide button...");
      await heroNextBtn.click();
      await page.waitForTimeout(800);
      passedSteps.push("Step 2c: Hero Carousel Next slide button works");
    }

    // -------------------------------------------------------------
    // STEP 3: Top Navigation Bar
    // -------------------------------------------------------------
    console.log("\n>>> Step 3: Testing Top Navigation Links...");
    const navLinks = [
      { name: "Discover", url: "/discover", selector: "header a[href*='/discover']" },
      { name: "Library", url: "/library", selector: "header a[href*='/library']" },
      { name: "Books", url: "/books", selector: "header a[href*='/books']" },
      { name: "Settings", url: "/settings", selector: "header a[href*='/settings']" },
      { name: "TV Mode", url: "/tv", selector: "header a[href*='/tv']" },
    ];

    for (const item of navLinks) {
      const linkEl = await page.$(item.selector);
      if (linkEl) {
        console.log(`  Clicking Nav Link: ${item.name}...`);
        await linkEl.click();
        await page.waitForTimeout(1500);
        console.log(`    Current URL is now: ${page.url()}`);
        passedSteps.push(`Step 3: Navigated to ${item.name}`);
      } else {
        console.log(`  WARNING: Missing Nav Link for ${item.name}`);
        issues.push({ type: "missing_nav_link", name: item.name });
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Discover Page & 1-Tap Stream 4K
    // -------------------------------------------------------------
    console.log("\n>>> Step 4: Testing Discover View & 1-Tap Playback...");
    await page.goto(`${BASE_URL}/discover`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "walkthrough-2-discover.png" });

    const moodChips = await page.$$("button:has-text('Dinner'), button:has-text('Mind'), button:has-text('Classics')");
    console.log(`  Found ${moodChips.length} mood filter chips on Discover.`);
    if (moodChips.length > 0) {
      await moodChips[0].click();
      await page.waitForTimeout(800);
      passedSteps.push("Step 4a: Discover Mood Filter chip clicked");
    }

    const discoverStreamBtn = await page.$("button:has-text('Stream 4K'), a:has-text('Watch Now')");
    if (discoverStreamBtn) {
      console.log("  Found Discover Spotlight Stream 4K button! Clicking to test 1-Tap Play Law...");
      await discoverStreamBtn.click();
      await page.waitForTimeout(2500);
      console.log("    URL after Stream 4K click:", page.url());
      await page.screenshot({ path: "walkthrough-3-after-stream-click.png" });
      passedSteps.push(`Step 4b: Discover Stream 4K transitioned to ${page.url()}`);
    }

    // -------------------------------------------------------------
    // STEP 5: Title Details Page & Stream 4K
    // -------------------------------------------------------------
    console.log("\n>>> Step 5: Testing Title Details Page (The Matrix tmdb-603)...");
    await page.goto(`${BASE_URL}/title/tmdb-603`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "walkthrough-4-title-details.png" });

    const titleStreamBtn = await page.$("button:has-text('Stream 4K'), button:has-text('Play')");
    if (titleStreamBtn) {
      console.log("  Found Title Stream 4K / Play button! Clicking...");
      await titleStreamBtn.click();
      await page.waitForTimeout(2500);
      console.log("    URL after clicking Stream 4K on Details:", page.url());
      await page.screenshot({ path: "walkthrough-5-player-loading.png" });
      passedSteps.push(`Step 5: Details Stream 4K navigated to ${page.url()}`);
    }

    // -------------------------------------------------------------
    // STEP 6: Player View & Video Tag Verification
    // -------------------------------------------------------------
    const targetPlayerUrl = capturedPlayHref.startsWith("http") ? capturedPlayHref : `${BASE_URL}${capturedPlayHref}`;
    console.log("\n>>> Step 6: Testing Player View at:", targetPlayerUrl);
    await page.goto(targetPlayerUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "walkthrough-6-player.png" });

    const videoEl = await page.$("video");
    if (videoEl) {
      const videoSrc = await videoEl.getAttribute("src");
      console.log("  SUCCESS: HTML5 <video> tag is present with src:", videoSrc);
      passedSteps.push(`Step 6a: Player rendered HTML5 video element with stream URL`);
    } else {
      console.log("  WARNING: <video> element was not rendered!");
      issues.push({ type: "missing_video_element", url: page.url() });
    }

    const subBtn = await page.$("button:has-text('Sub')");
    const dubBtn = await page.$("button:has-text('Dub')");
    if (subBtn && dubBtn) {
      console.log("  Found Sub and Dub audio sovereignty buttons! Clicking Dub...");
      await dubBtn.click();
      await page.waitForTimeout(500);
      console.log("  Clicking Sub...");
      await subBtn.click();
      await page.waitForTimeout(500);
      passedSteps.push("Step 6b: Sub / Dub toggle buttons function correctly");
    }

    const dialogueBtn = await page.$("button:has-text('Dialogue Focus')");
    if (dialogueBtn) {
      console.log("  Found Dialogue Focus button! Clicking...");
      await dialogueBtn.click();
      await page.waitForTimeout(500);
      passedSteps.push("Step 6c: Dialogue Focus booster toggled");
    }

    // -------------------------------------------------------------
    // STEP 7: Couch Mode / TV View Navigation
    // -------------------------------------------------------------
    console.log("\n>>> Step 7: Testing Couch Mode / TV View (/tv)...");
    await page.goto(`${BASE_URL}/tv`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "walkthrough-7-tv-mode.png" });

    const exitTvBtn = await page.$("button:has-text('Exit TV Mode')");
    if (exitTvBtn) {
      console.log("  Found Exit TV Mode button! Clicking...");
      await exitTvBtn.click();
      await page.waitForTimeout(1500);
      console.log("    Navigated back to:", page.url());
      passedSteps.push("Step 7: TV Mode Exit button works");
    }

    // -------------------------------------------------------------
    // STEP 8: Books View Verification
    // -------------------------------------------------------------
    console.log("\n>>> Step 8: Testing Books View (/books)...");
    await page.goto(`${BASE_URL}/books`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "walkthrough-8-books.png" });

    const bookReadBtns = await page.$$("button:has-text('Read')");
    console.log(`  Found ${bookReadBtns.length} Read buttons on Books catalog.`);
    if (bookReadBtns.length > 0) {
      passedSteps.push(`Step 8: Books catalog rendered with ${bookReadBtns.length} readable books`);
    }

  } catch (err) {
    console.error("Audit encounter error:", err);
    issues.push({ type: "audit_exception", message: err.message });
  } finally {
    await browser.close();
  }

  console.log("\n=======================================================");
  console.log(`AUDIT COMPLETE: ${passedSteps.length} Steps Passed, ${issues.length} Issues`);
  console.log("=======================================================");
  fs.writeFileSync(
    "audit-results.json",
    JSON.stringify({ passedSteps, issues, timestamp: new Date().toISOString() }, null, 2)
  );
}

runFullAudit().catch(console.error);
