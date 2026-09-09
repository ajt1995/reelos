/**
 * Phone + desktop captures of Tron chrome and Books download.
 *
 *   node scripts/tron-previews.mjs
 */
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/tron-previews");
const ART = "/opt/cursor/artifacts";
const ORIGIN = process.env.TRON_PREVIEW_ORIGIN || "http://127.0.0.1:8080";

const TITLES = [
  t("night-harbor", "movie", "Night Harbor", 2024),
  t("ember-season", "movie", "Ember Season", 2025),
  t("glass-orchard", "movie", "Glass Orchard", 2024),
  t("iron-parish", "movie", "Iron Parish", 2023),
  t("station-line", "tv", "Station Line", 2024),
  t("hollow-broadcast", "tv", "Hollow Broadcast", 2023),
];

function t(id, kind, title, year) {
  return {
    id,
    kind,
    title,
    year,
    rating: 8,
    genres: ["Drama"],
    overview: "",
    poster: `/posters/${id}.jpg`,
    maxQuality: "4k",
    popularity: 80,
  };
}

const BOOKS = [
  {
    id: "gutenberg-84",
    title: "Frankenstein",
    author: "Mary Wollstonecraft Shelley",
    source: "Project Gutenberg",
    year: 1818,
    format: "EPUB",
    downloadUrl: "https://www.gutenberg.org/ebooks/84.epub.images",
  },
  {
    id: "se-dracula",
    title: "Dracula",
    author: "Bram Stoker",
    source: "Standard Ebooks",
    year: 1897,
    format: "EPUB",
    downloadUrl: "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/dracula.epub",
  },
];

const SHELF_BOOKS = [
  {
    id: "shelf-demo",
    title: "Frankenstein",
    author: "Mary Shelley",
    source: "On this box",
    format: "EPUB",
    downloadUrl: "/api/books/file?id=shelf-demo",
  },
];

function persistBlob(extra = {}) {
  const now = Date.now();
  const req = (titleId, status, more = {}) => ({
    id: `req-${titleId}`,
    titleId,
    status,
    progress: status === "available" ? 100 : status === "downloading" ? 62 : 0,
    createdAt: now - 86_400_000,
    updatedAt: now,
    requester: "Ada",
    ...more,
  });
  return {
    state: {
      phase: "running",
      wizardStep: 7,
      answers: {
        storageMode: "both",
        selectedDisks: ["sda", "sdb"],
        formatDisks: [],
        source: "real-debrid",
        apiKey: "RD-LAB-KEY-7F3A",
        vpnProvider: "mullvad",
        intent: {
          movies: true,
          tv: true,
          anime: true,
          uhd: true,
          kids: true,
          music: false,
          books: true,
        },
        quality: "hybrid",
        frontend: "jellyfin",
        plexClaim: "",
        adminName: "Ada",
        adminPassword: "household",
        access: "lan",
        tunnelToken: "",
      },
      build: [],
      buildLogOpen: false,
      provisioned: true,
      requests: [
        req("night-harbor", "available", { via: "cache" }),
        req("station-line", "downloading", { via: "uncached", progress: 62, season: 2, reason: "searching" }),
        req("ember-season", "waiting"),
      ],
      library: ["night-harbor", "ember-season", "iron-parish"],
      shelf: TITLES.slice(0, 4),
      shelfReady: true,
      shelfError: null,
      watchProgress: { "night-harbor": 0.42, "iron-parish": 0.71 },
      activity: [],
      users: [{ id: "u-ada", name: "Ada", role: "admin" }],
      settings: {
        hideAdvanced: false,
        autoApprove: true,
        notifyAvailable: true,
        notifyFailed: true,
        autoUpdate: true,
        stackImages: false,
        connectDone: true,
      },
      adapter: {
        kind: "decypharr",
        provider: "real-debrid",
        status: "healthy",
        account: "lab",
        mount: "/mnt/debrid",
        pingMs: 41,
        cacheHits: 3,
        transfers: 1,
        lastPing: now,
        daysLeft: 38,
      },
      indexers: [],
      remoteTitles: TITLES,
      ...extra,
    },
    version: 0,
  };
}

function wizardBlob() {
  const blob = persistBlob();
  blob.state.phase = "wizard";
  blob.state.wizardStep = 3;
  blob.state.provisioned = false;
  blob.state.settings.connectDone = false;
  blob.state.answers.intent.books = false;
  blob.state.answers.intent.music = false;
  return blob;
}

function posterSvg(id) {
  const title = TITLES.find((x) => x.id === id)?.title || id;
  const hue = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="336" height="504" viewBox="0 0 336 504">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 70%, 18%)"/>
      <stop offset="1" stop-color="#03060c"/>
    </linearGradient>
  </defs>
  <rect width="336" height="504" fill="url(#g)"/>
  <rect x="12" y="12" width="312" height="480" fill="none" stroke="#00e5ff" stroke-opacity="0.28"/>
  <text x="24" y="460" fill="#e8f4ff" font-family="Share Tech Mono, ui-monospace, monospace" font-size="22">${escapeXml(title)}</text>
</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

async function mockApis(page) {
  await page.route("**/api/box**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provisioned: true,
        ipv4: "192.168.1.40",
        watch: "http://192.168.1.40:8096",
        seerr: "http://192.168.1.40:5055",
        jellyfin: { state: "green", detail: "Live" },
        frontend: "jellyfin",
        access: "lan",
        adminName: "Ada",
        adminPassword: "household",
        answers: persistBlob().state.answers,
      }),
    }),
  );
  await page.route("**/api/library**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ titles: TITLES.slice(0, 4), error: null }),
    }),
  );
  await page.route("**/api/discover**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        movies: TITLES.filter((x) => x.kind === "movie").slice(0, 4),
        tv: TITLES.filter((x) => x.kind === "tv"),
        error: null,
      }),
    }),
  );
  await page.route("**/api/lookup**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ titles: TITLES.slice(0, 3), error: null }),
    }),
  );
  await page.route("**/api/books**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ results: BOOKS, unavailable: [] }),
    }),
  );
  await page.route("**/api/books/file**", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/epub+zip",
        "content-disposition": 'attachment; filename="Frankenstein.epub"',
      },
      body: "epub-bytes",
    }),
  );
  await page.route("**/api/books/fetch**", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/epub+zip",
        "content-disposition": 'attachment; filename="Dracula.epub"',
      },
      body: "epub-bytes",
    }),
  );
  await page.route("**/api/books/shelf**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ books: SHELF_BOOKS }),
    }),
  );
  await page.route("**/api/books/opds**", (route) =>
    route.fulfill({
      contentType: "application/atom+xml",
      body: "<feed xmlns='http://www.w3.org/2005/Atom'><title>ReelOS Books</title></feed>",
    }),
  );
  await page.route("**/api/request**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ requests: persistBlob().state.requests }),
    }),
  );
  await page.route("**/api/intent**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
  await page.route("**/posters/**", (route) => {
    const id = decodeURIComponent(route.request().url().split("/").pop() || "").replace(/\.jpg$/, "");
    route.fulfill({ contentType: "image/svg+xml", body: posterSvg(id) });
  });
}

async function shot(page, name) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(ART, "screenshots"), { recursive: true });
  const dest = join(OUT, name);
  await page.screenshot({ path: dest, type: "png", fullPage: false });
  copyFileSync(dest, join(ART, "screenshots", name));
  console.log("wrote", dest);
}

async function waitHeading(page, text) {
  await page.getByRole("heading", { name: text, exact: true }).first().waitFor({ timeout: 15000 });
}

async function withBlob(page, blob) {
  await page.addInitScript((data) => {
    localStorage.setItem("reelos-v4", JSON.stringify(data));
  }, blob);
}

async function main() {
  const launch = { args: ["--font-render-hinting=none", "--disable-dev-shm-usage"] };
  let browser;
  try {
    browser = await chromium.launch({ ...launch, channel: "chrome" });
  } catch {
    browser = await chromium.launch(launch);
  }

  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await withBlob(phone, persistBlob());
  await mockApis(phone);

  await phone.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  await phone.getByText("On the shelf").waitFor({ timeout: 15000 });
  await phone.getByRole("heading", { name: "Books" }).scrollIntoViewIfNeeded();
  await shot(phone, "home.png");

  await phone.getByRole("link", { name: "Discover" }).click();
  await waitHeading(phone, "Discover");
  await shot(phone, "discover.png");

  const search = phone.getByLabel("Search movies, shows, and books");
  await search.click();
  await search.fill("dracula");
  await phone.locator("ul").getByText("Dracula").first().waitFor({ timeout: 10000 });
  await shot(phone, "discover-typeahead.png");
  await phone.locator("ul").getByRole("link").filter({ hasText: "Dracula" }).first().click();
  await waitHeading(phone, "Books");
  await phone.getByRole("link", { name: "Download" }).first().waitFor();
  await shot(phone, "books.png");

  await phone.getByRole("link", { name: "Requests" }).click();
  await waitHeading(phone, "Requests");
  await phone.getByRole("button", { name: "Grabbing" }).click();
  await phone.waitForTimeout(250);
  await shot(phone, "requests.png");

  await phone.getByRole("link", { name: "Library" }).click();
  await waitHeading(phone, "Library");
  await shot(phone, "library.png");

  await phone.getByRole("link", { name: "Settings" }).first().click();
  await waitHeading(phone, "Settings");
  await phone.getByRole("button", { name: /How to watch/ }).click();
  await phone.getByText("Download the file from the Books tab").scrollIntoViewIfNeeded();
  await shot(phone, "settings.png");

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await withBlob(desktop, persistBlob());
  await mockApis(desktop);
  await desktop.goto(`${ORIGIN}/books?q=Dracula`, { waitUntil: "networkidle" });
  await waitHeading(desktop, "Books");
  await desktop.getByRole("link", { name: "Download" }).first().waitFor();
  await shot(desktop, "books-desktop.png");
  await desktop.goto(`${ORIGIN}/discover`, { waitUntil: "networkidle" });
  await waitHeading(desktop, "Discover");
  await shot(desktop, "discover-desktop.png");

  const wiz = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await withBlob(wiz, wizardBlob());
  await mockApis(wiz);
  await wiz.route("**/api/box**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ provisioned: false }),
    }),
  );
  await wiz.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  await wiz.getByText("What are you collecting?").waitFor({ timeout: 15000 });
  const booksChip = wiz.getByRole("button", { name: "Books" });
  await booksChip.click();
  await wiz.waitForTimeout(400);
  await shot(wiz, "wizard-books.png");

  await browser.close();
  writeFileSync(
    join(OUT, "README.md"),
    [
      "# Tron-night + Books previews",
      "",
      "Captured from the live Vite shell (phone 390×844 and desktop 1280×800).",
      "Books primary CTA is Download (file attachment). Kavita is a secondary library-on-the-box link.",
      "",
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
