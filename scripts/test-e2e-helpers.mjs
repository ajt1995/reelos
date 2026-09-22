import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { findBundledChromium } from "./local-tool-discovery.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Launch Chromium using local installed Chrome or Edge.
 */
export async function launchTestBrowser(options = {}) {
  const artifactRoot = join(ROOT, ".reelos-test-artifacts");
  mkdirSync(artifactRoot, { recursive: true });
  process.env.TEMP = artifactRoot;
  process.env.TMP = artifactRoot;
  const bundled = findBundledChromium(ROOT);
  if (bundled) {
    try {
      const browser = await chromium.launch({
        executablePath: bundled,
        headless: options.headless !== false,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });
      return { browser, channel: "reelos-bundled" };
    } catch {
      // Continue to installed browser channels and Playwright's default cache.
    }
  }
  const channels = ["chrome", "msedge"];
  let lastError = null;

  for (const channel of channels) {
    try {
      const browser = await chromium.launch({
        channel,
        headless: options.headless !== false,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });
      return { browser, channel };
    } catch (err) {
      lastError = err;
    }
  }

  // Fallback to default bundled chromium if available
  try {
    const browser = await chromium.launch({
      headless: options.headless !== false,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    return { browser, channel: "bundled" };
  } catch (err) {
    throw new Error(`Failed to launch browser: ${lastError?.message || err.message}`);
  }
}

/**
 * Set up a page with rigorous error logging, network interception, and viewport sizing.
 */
export async function createTestPage(browser, options = {}) {
  const width = options.width || 1280;
  const height = options.height || 800;
  const page = await browser.newPage({
    viewport: { width, height },
    userAgent: options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 ReelOS-Audit/1.0",
  });

  if (options.seedStorage !== false) {
    await page.addInitScript(() => {
      try {
        if (!localStorage.getItem("reelos-v4")) {
          localStorage.setItem(
            "reelos-v4",
            JSON.stringify({
              state: {
                phase: "ready",
                provisioned: true,
                answers: { quality: "hybrid", source: "symlink", frontend: "jellyfin" },
                residents: [{ id: "res-primary", name: "Primary", isGuest: false, isKids: false, watchlist: [] }],
                activeResidentId: "res-primary",
              },
              version: 0,
            })
          );
        }
      } catch {}
    });
  }

  const errors = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore benign favicon or font 404s in audit
      if (!text.includes("favicon.ico") && !text.includes("font")) {
        errors.consoleErrors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    errors.pageErrors.push(String(err?.message || err));
  });

  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes("favicon") && !url.includes("/api/ping")) {
      errors.failedRequests.push({ url, status, statusText: res.statusText() });
    }
  });

  return { page, errors };
}

/**
 * Checks that the layout has zero horizontal overflow.
 */
export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1,
    };
  });
  return overflow;
}

/**
 * Clicks a selector and awaits the corresponding API network response.
 */
export async function clickAndAssertMutation(page, clickSelector, urlPattern, options = {}) {
  const timeout = options.timeout || 6000;
  const expectedStatus = options.expectedStatus || 200;

  const [response] = await Promise.all([
    page.waitForResponse((res) => {
      const matchUrl = typeof urlPattern === "string" ? res.url().includes(urlPattern) : urlPattern.test(res.url());
      return matchUrl && (!options.method || res.request().method() === options.method);
    }, { timeout }),
    page.locator(clickSelector).first().click(),
  ]);

  const status = response.status();
  let json = null;
  try {
    json = await response.json();
  } catch {}

  return {
    status,
    ok: status === expectedStatus,
    json,
    response,
  };
}

/**
 * Checks for a toast message in the DOM.
 */
export async function waitForToast(page, textOrPattern, timeout = 4000) {
  const locator = page.locator("[data-sonner-toast], .toast, [role='status'], div:has-text('Quality set')");
  try {
    if (textOrPattern) {
      const matcher = typeof textOrPattern === "string" ? new RegExp(textOrPattern, "i") : textOrPattern;
      await page.locator(`text=${matcher}`).first().waitFor({ state: "visible", timeout });
      return true;
    }
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * The Hard Refresh Invariant:
 * Reloads the page and ensures the UI correctly persists the modified state.
 */
export async function assertRefreshInvariant(page, checkFn, timeout = 6000) {
  await page.reload({ waitUntil: "networkidle", timeout });
  await page.waitForTimeout(500);
  return await checkFn(page);
}
