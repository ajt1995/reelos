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

  console.log("Navigating to http://localhost:8080/tv...");
  await page.goto("http://localhost:8080/tv", { waitUntil: "networkidle", timeout: 10000 });
  
  const tvShot = join(outDir, "tv-couch-mode.png");
  await page.screenshot({ path: tvShot });
  console.log(`Saved TV Couch Mode screenshot to: ${tvShot}`);

  console.log("Navigating to http://localhost:8080/settings...");
  await page.goto("http://localhost:8080/settings", { waitUntil: "networkidle", timeout: 10000 });
  const settingsShot = join(outDir, "settings-view.png");
  await page.screenshot({ path: settingsShot });
  console.log(`Saved Settings screenshot to: ${settingsShot}`);

  console.log("Navigating to http://localhost:8080/...");
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle", timeout: 10000 });
  const homeShot = join(outDir, "home-shelf.png");
  await page.screenshot({ path: homeShot });
  console.log(`Saved Home Shelf screenshot to: ${homeShot}`);

  console.log("Navigating to http://localhost:8080/library...");
  await page.goto("http://localhost:8080/library", { waitUntil: "networkidle", timeout: 10000 });
  const libraryShot = join(outDir, "library-view.png");
  await page.screenshot({ path: libraryShot });
  console.log(`Saved Library View screenshot to: ${libraryShot}`);

  await browser.close();
  console.log("Visual snapshot tool ready and operational!");
}

run().catch((err) => {
  console.error("Visual snapshot error:", err);
  process.exit(1);
});
